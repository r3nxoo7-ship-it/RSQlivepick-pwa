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
      console.log(`⚠️ [Match Result] Match ${matchId} not found in database`);
      return NextResponse.json(
        { 
          error: 'Match not found', 
          matchId,
          note: 'Match data not yet synced from ESPN'
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
