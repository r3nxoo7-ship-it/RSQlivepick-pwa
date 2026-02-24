/**
 * GET /api/h2h?home=Team+Name&away=Team+Name&limit=20
 *
 * Cache-first H2H endpoint:
 * 1. Check h2h_cache table in Supabase
 * 2. If hit (and not stale) → return cached matches immediately (0 API calls)
 * 3. If miss or stale → fetch from TheSportsDB searchevents, store in cache
 *
 * Past match data is immutable. Cache is permanent for FT matches.
 * Only refreshes after 7 days to catch new meetings since last fetch.
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getH2HEvents, calculateFormFromCache, type CachedMatch } from '@/lib/thesportsdb';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function makeCacheKey(home: string, away: string): string {
  // Always alphabetical order so "Arsenal vs Chelsea" = "Chelsea vs Arsenal"
  const [a, b] = [home.toLowerCase().trim(), away.toLowerCase().trim()].sort();
  return `${a}||${b}`;
}

export async function GET(request: NextRequest) {
  const home = request.nextUrl.searchParams.get('home')?.trim();
  const away = request.nextUrl.searchParams.get('away')?.trim();
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 30);

  if (!home || !away) {
    return NextResponse.json({ error: 'home and away team names are required' }, { status: 400 });
  }

  const cacheKey = makeCacheKey(home, away);

  try {
    // 1. Check cache
    const { data: cached } = await supabaseAdmin
      .from('h2h_cache')
      .select('matches, match_count, source, fetched_at, refresh_after')
      .eq('cache_key', cacheKey)
      .single();

    const now = new Date();
    const isStale = cached ? new Date(cached.refresh_after) < now : true;

    if (cached && !isStale) {
      // Cache hit — serve immediately
      const matches: CachedMatch[] = (cached.matches as CachedMatch[]).slice(0, limit);
      const h2hSummary = computeH2HSummary(matches, home, away);
      console.log(`[H2H] Cache hit for "${home}" vs "${away}" — ${matches.length} matches`);
      return NextResponse.json({
        home,
        away,
        matches,
        h2hSummary,
        match_count: cached.match_count,
        source: cached.source,
        cached: true,
        fetched_at: cached.fetched_at,
      }, { headers: { 'Cache-Control': 'private, max-age=300' } });
    }

    // 2. Cache miss or stale — fetch from TheSportsDB
    console.log(`[H2H] Cache ${cached ? 'stale' : 'miss'} for "${home}" vs "${away}" — fetching TheSportsDB`);
    const freshMatches = await getH2HEvents(home, away);

    let finalMatches = freshMatches;

    // If TheSportsDB returned nothing, keep the old cached data if we have it
    if (freshMatches.length === 0 && cached && cached.matches) {
      console.log(`[H2H] TheSportsDB returned 0 results, keeping stale cache`);
      finalMatches = cached.matches as CachedMatch[];
    } else if (freshMatches.length > 0) {
      // Upsert into cache
      const refreshAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await supabaseAdmin
        .from('h2h_cache')
        .upsert({
          cache_key: cacheKey,
          home_team_name: home,
          away_team_name: away,
          matches: freshMatches,
          match_count: freshMatches.length,
          source: 'thesportsdb',
          fetched_at: now.toISOString(),
          refresh_after: refreshAfter.toISOString(),
        }, { onConflict: 'cache_key' });
      console.log(`[H2H] Cached ${freshMatches.length} matches for "${home}" vs "${away}"`);
    }

    const matches = finalMatches.slice(0, limit);
    const h2hSummary = computeH2HSummary(matches, home, away);

    return NextResponse.json({
      home,
      away,
      matches,
      h2hSummary,
      match_count: finalMatches.length,
      source: 'thesportsdb',
      cached: false,
      fetched_at: now.toISOString(),
    }, { headers: { 'Cache-Control': 'private, max-age=300' } });

  } catch (err) {
    console.error('[H2H] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch H2H data' }, { status: 500 });
  }
}

function computeH2HSummary(matches: CachedMatch[], home: string, away: string) {
  let homeWins = 0, draws = 0, awayWins = 0, homeGoals = 0, awayGoals = 0;
  const homeLower = home.toLowerCase();

  for (const m of matches) {
    const mHomeIsHome = m.home_team_name.toLowerCase().includes(homeLower) ||
                        homeLower.includes(m.home_team_name.toLowerCase().split(' ')[0]);
    const h = mHomeIsHome ? m.home_score : m.away_score;
    const a = mHomeIsHome ? m.away_score : m.home_score;
    homeGoals += h;
    awayGoals += a;
    if (h > a) homeWins++;
    else if (h === a) draws++;
    else awayWins++;
  }

  return {
    total: matches.length,
    homeWins,
    draws,
    awayWins,
    homeGoals,
    awayGoals,
  };
}
