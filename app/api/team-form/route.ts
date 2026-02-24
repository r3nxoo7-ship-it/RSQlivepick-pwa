/**
 * GET /api/team-form?team=Team+Name&limit=10
 *
 * Cache-first team form endpoint:
 * 1. Check team_form_cache table in Supabase
 * 2. If hit (and not stale, <3 days) → return cached data (0 API calls)
 * 3. If miss or stale → search TheSportsDB for team, fetch last events, cache
 *
 * Falls back to ESPN team-form API if TheSportsDB fails.
 *
 * Team form refreshes every 3 days (teams play ~weekly).
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  searchTeam,
  getTeamLastEvents,
  calculateFormFromCache,
  type CachedMatch,
} from '@/lib/thesportsdb';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function makeCacheKey(teamName: string): string {
  return teamName.toLowerCase().trim().replace(/\s+/g, '_');
}

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get('team')?.trim();
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10'), 15);

  if (!team) {
    return NextResponse.json({ error: 'team name is required' }, { status: 400 });
  }

  const cacheKey = makeCacheKey(team);
  const now = new Date();

  try {
    // 1. Check cache
    const { data: cached } = await supabaseAdmin
      .from('team_form_cache')
      .select('matches, match_count, tsdb_team_id, source, fetched_at, refresh_after')
      .eq('cache_key', cacheKey)
      .single();

    const isStale = cached ? new Date(cached.refresh_after) < now : true;

    if (cached && !isStale) {
      const matches: CachedMatch[] = (cached.matches as CachedMatch[]).slice(0, limit);
      const prefixedId = cached.tsdb_team_id ? `tsdb_${cached.tsdb_team_id}` : cacheKey;
      const form = calculateFormFromCache(matches, prefixedId);
      console.log(`[TeamForm] Cache hit for "${team}" — ${matches.length} matches`);
      return NextResponse.json({
        team,
        teamId: prefixedId,
        matches,
        form,
        source: cached.source,
        cached: true,
        fetched_at: cached.fetched_at,
      }, { headers: { 'Cache-Control': 'private, max-age=180' } });
    }

    // 2. Look up team in TheSportsDB
    console.log(`[TeamForm] Cache ${cached ? 'stale' : 'miss'} for "${team}" — searching TheSportsDB`);

    // Check team ID lookup cache first
    const { data: knownTeam } = await supabaseAdmin
      .from('tsdb_team_lookup')
      .select('tsdb_team_id, tsdb_team_name')
      .eq('team_name_key', cacheKey)
      .single();

    let tsdbTeamId: string | null = knownTeam?.tsdb_team_id || null;

    if (!tsdbTeamId) {
      // Search TheSportsDB for the team
      const teamData = await searchTeam(team);
      if (teamData) {
        tsdbTeamId = teamData.idTeam;
        // Save to lookup cache
        await supabaseAdmin
          .from('tsdb_team_lookup')
          .upsert({
            team_name_key: cacheKey,
            team_name: team,
            tsdb_team_id: teamData.idTeam,
            tsdb_team_name: teamData.strTeam,
            league_name: teamData.strLeague || null,
          }, { onConflict: 'team_name_key' });
        console.log(`[TeamForm] Found TheSportsDB ID ${tsdbTeamId} for "${team}"`);
      }
    }

    let freshMatches: CachedMatch[] = [];

    if (tsdbTeamId) {
      freshMatches = await getTeamLastEvents(tsdbTeamId);
    }

    let finalMatches = freshMatches;

    if (freshMatches.length === 0 && cached?.matches) {
      // Keep stale cache rather than return empty
      console.log(`[TeamForm] TheSportsDB returned 0 results for "${team}", keeping stale cache`);
      finalMatches = cached.matches as CachedMatch[];
    } else if (freshMatches.length > 0) {
      // Upsert cache with 3-day refresh
      const refreshAfter = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      await supabaseAdmin
        .from('team_form_cache')
        .upsert({
          cache_key: cacheKey,
          team_name: team,
          tsdb_team_id: tsdbTeamId || null,
          matches: freshMatches,
          match_count: freshMatches.length,
          source: 'thesportsdb',
          fetched_at: now.toISOString(),
          refresh_after: refreshAfter.toISOString(),
        }, { onConflict: 'cache_key' });
      console.log(`[TeamForm] Cached ${freshMatches.length} matches for "${team}"`);
    }

    const matches = finalMatches.slice(0, limit);
    const prefixedId = tsdbTeamId ? `tsdb_${tsdbTeamId}` : cacheKey;
    const form = calculateFormFromCache(matches, prefixedId);

    return NextResponse.json({
      team,
      teamId: prefixedId,
      matches,
      form,
      source: 'thesportsdb',
      cached: false,
      fetched_at: now.toISOString(),
    }, { headers: { 'Cache-Control': 'private, max-age=180' } });

  } catch (err) {
    console.error('[TeamForm] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch team form' }, { status: 500 });
  }
}
