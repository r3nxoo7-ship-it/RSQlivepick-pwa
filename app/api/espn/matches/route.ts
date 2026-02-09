// ============================================
// GET LIVE MATCHES FROM SUPABASE
// ============================================
// GET /api/espn/matches
// Users read from here, not from ESPN directly
// Data is synced every 1 minute via cron

import { NextRequest, NextResponse } from 'next/server';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/espn/matches
 * Get live + upcoming soccer matches from Supabase (FIFA only)
 * Also returns recent form for each team
 * Returns data synced in the last minute, filtered for soccer sport
 */
export async function GET(request: NextRequest) {
  try {
    // Get live and upcoming matches separately
    const liveRaw = await espnSync.getLiveMatchesOnly();
    const upcomingRaw = await espnSync.getUpcomingMatches();
    
    // Convert to LiveMatch format
    const liveMatches = liveRaw
      .filter(row => 
        row.sport === 'soccer' && 
        row.league !== 'multi' &&
        row.home_team_name && 
        row.home_team_name !== 'Unknown' &&
        row.away_team_name &&
        row.away_team_name !== 'Unknown' &&
        row.id
      )
      .map(row => espnSync.convertESPNMatchToLiveMatch(row));

    const upcomingMatches = upcomingRaw
      .filter(row => 
        row.sport === 'soccer' && 
        row.league !== 'multi' &&
        row.home_team_name && 
        row.home_team_name !== 'Unknown' &&
        row.away_team_name &&
        row.away_team_name !== 'Unknown' &&
        row.id
      )
      .map(row => espnSync.convertESPNMatchToLiveMatch(row));

    // Fetch recent form for teams in current matches (live + upcoming)
    const allCurrentMatches = [...liveRaw, ...upcomingRaw];
    const teamIds = new Set<string>();
    allCurrentMatches.forEach(m => {
      if (m.home_team_id) teamIds.add(m.home_team_id);
      if (m.away_team_id) teamIds.add(m.away_team_id);
    });

    const teamForm: Record<string, any> = {};
    for (const teamId of teamIds) {
      const recentMatches = await espnSync.getTeamRecentMatches(teamId, 5);
      const form = espnSync.calculateTeamForm(recentMatches, teamId);
      teamForm[teamId] = form;
    }

    return NextResponse.json({
      success: true,
      live: {
        count: liveMatches.length,
        matches: liveMatches,
      },
      upcoming: {
        count: upcomingMatches.length,
        matches: upcomingMatches,
      },
      teamForm: teamForm,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=5', // Can cache for 5 seconds
        'X-Data-Source': 'Supabase (synced from ESPN)',
      }
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch matches',
        live: { count: 0, matches: [] },
        upcoming: { count: 0, matches: [] },
        teamForm: {},
      },
      { status: 500 }
    );
  }
}
