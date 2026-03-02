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

    if (!matches || matches.length === 0) {
      console.log(`⚠️ [Match Result] Match ${matchId} not found in espn_matches — trying triggered_matches fallback`);

      // Fallback: look up final score from triggered_matches table
      // (triggered_matches uses API-Football IDs; espn_matches uses ESPN IDs — they differ)
      const { data: tmRows } = await supabase
        .from('triggered_matches')
        .select('home_team, away_team, final_score_home, final_score_away, score_home, score_away, match_status, league_name')
        .eq('match_id', matchId)
        .not('final_score_home', 'is', null)
        .limit(1);

      if (tmRows && tmRows.length > 0) {
        const tm = tmRows[0];
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

      // Last resort: return trigger-time score if match exists at all
      const { data: tmAny } = await supabase
        .from('triggered_matches')
        .select('home_team, away_team, score_home, score_away, match_status, league_name')
        .eq('match_id', matchId)
        .limit(1);

      if (tmAny && tmAny.length > 0) {
        const tm = tmAny[0];
        return NextResponse.json({
          matchId,
          homeTeam: tm.home_team,
          awayTeam: tm.away_team,
          scoreHome: tm.score_home,
          scoreAway: tm.score_away,
          status: tm.match_status,
          statusLong: tm.match_status === 'finished' ? 'Match Finished' : 'In Progress',
          league: tm.league_name,
          source: 'triggered_matches_trigger_time',
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
