/**
 * API Route: /api/match-result
 * 
 * Fetch the current/final result for a match by match_id
 * GET /api/match-result?match_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const matchId = request.nextUrl.searchParams.get('match_id');
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'match_id parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Match Result] Fetching result for match ${matchId}`);

    // Create Supabase client with service role for backend access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKeyAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKeyAdmin);

    const normalizeTeamName = (name: string) => name
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const roughlyMatches = (a: string, b: string) => {
      const na = normalizeTeamName(a);
      const nb = normalizeTeamName(b);
      if (!na || !nb) return false;
      if (na === nb) return true;
      return na.includes(nb) || nb.includes(na);
    };

    // Query the espn_matches table for the current match data
    const { data: matches, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('id', matchId)
      .limit(1);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      );
    }

    // Fetch triggered_matches context for collision detection and fallback
    const { data: tmAnyRows } = await supabase
      .from('triggered_matches')
      .select('home_team, away_team, final_score_home, final_score_away, score_home, score_away, match_status, league_name')
      .eq('match_id', matchId)
      .limit(1);

    const tmAny = tmAnyRows && tmAnyRows.length > 0 ? tmAnyRows[0] : null;

    if (!matches || matches.length === 0) {
      console.log(`⚠️ [Match Result] Match ${matchId} not found in espn_matches — trying triggered_matches fallback`);

      // Fallback: look up final score from triggered_matches table
      // (triggered_matches uses API-Football IDs; espn_matches uses ESPN IDs — they differ)
      if (tmAny && tmAny.final_score_home != null && tmAny.final_score_away != null) {
        const tm = tmAny;
        return NextResponse.json({
          matchId,
          homeTeam: tm.home_team,
          awayTeam: tm.away_team,
          scoreHome: tm.final_score_home,
          scoreAway: tm.final_score_away,
          status: tm.match_status === 'finished' ? 'FT' : tm.match_status,
          statusLong: tm.match_status === 'finished' ? 'Match Finished' : 'In Progress',
          league: tm.league_name,
          source: 'triggered_matches_fallback',
        });
      }

      return NextResponse.json(
        { 
          error: 'Match not found', 
          matchId,
          note: 'Match data not yet synced from ESPN or triggered_matches'
        },
        { status: 404 }
      );
    }

    // Match found in database
    const match = matches[0];

    // Collision guard:
    // If this matchId is actually a non-ESPN provider ID (API-Football / SofaScore), it can collide with an ESPN event id.
    // If we have a triggered_matches row for the same match_id and the teams don't match, prefer triggered_matches.
    if (
      tmAny &&
      (!roughlyMatches(tmAny.home_team, match.home_team_name) || !roughlyMatches(tmAny.away_team, match.away_team_name))
    ) {
      console.warn(
        `⚠️ [Match Result] ESPN id collision detected for ${matchId} — preferring triggered_matches (${tmAny.home_team} vs ${tmAny.away_team}) over ESPN (${match.home_team_name} vs ${match.away_team_name})`
      );

      if (tmAny.final_score_home != null && tmAny.final_score_away != null) {
        return NextResponse.json({
          matchId,
          homeTeam: tmAny.home_team,
          awayTeam: tmAny.away_team,
          scoreHome: tmAny.final_score_home,
          scoreAway: tmAny.final_score_away,
          status: tmAny.match_status === 'finished' ? 'FT' : tmAny.match_status,
          statusLong: tmAny.match_status === 'finished' ? 'Match Finished' : 'In Progress',
          league: tmAny.league_name,
          source: 'triggered_matches_preferred_over_espn',
        });
      }

      return NextResponse.json(
        {
          error: 'Match found in ESPN but does not match triggered match context',
          matchId,
          note: 'Possible provider ID collision; final score not yet available for triggered match',
        },
        { status: 404 }
      );
    }
    
    console.log(`✅ [Match Result] Found match: ${match.home_team_name} ${match.home_score} - ${match.away_score} ${match.away_team_name}`);
    
    const result = {
      matchId: match.id,
      homeTeam: match.home_team_name,
      awayTeam: match.away_team_name,
      scoreHome: match.home_score,
      scoreAway: match.away_score,
      status: match.status === 'completed' ? 'FT' : match.status,
      statusLong: match.status === 'completed' ? 'Match Finished' : 
                  match.status === 'in_progress' ? 'In Progress' : 'Scheduled',
      league: match.league,
      date: match.date,
      source: 'espn_synced',
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('Error fetching match result:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}
