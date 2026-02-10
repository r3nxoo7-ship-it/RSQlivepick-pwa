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
 * Returns 3 sections: live, today (all today's scheduled), scheduled (next 7 days)
 * Also returns recent form for teams in live + today matches
 */
export async function GET(request: NextRequest) {
  try {
    // Get live, today's scheduled, and 7-day scheduled matches
    const liveRaw = await espnSync.getLiveMatchesOnly();
    const todayRaw = await espnSync.getUpcomingMatches();
    let scheduledRaw = await espnSync.getScheduledMatchesRange(7);

    // On-demand sync: if no scheduled matches exist, fetch them now
    if (scheduledRaw.length === 0) {
      console.log('📅 No scheduled matches found, syncing upcoming 7 days on-demand...');
      try {
        await espnSync.syncUpcomingDays(7);
        scheduledRaw = await espnSync.getScheduledMatchesRange(7);
        console.log(`📅 On-demand sync complete: ${scheduledRaw.length} scheduled matches`);
      } catch (syncErr) {
        console.error('⚠️ On-demand upcoming sync failed:', syncErr);
      }
    }

    const validFilter = (row: any) =>
      row.sport === 'soccer' &&
      row.league !== 'multi' &&
      row.home_team_name &&
      row.home_team_name !== 'Unknown' &&
      row.away_team_name &&
      row.away_team_name !== 'Unknown' &&
      row.id;

    const liveMatches = liveRaw.filter(validFilter).map(row => espnSync.convertESPNMatchToLiveMatch(row));
    const todayMatches = todayRaw.filter(validFilter).map(row => espnSync.convertESPNMatchToLiveMatch(row));
    const scheduledMatches = scheduledRaw.filter(validFilter).map(row => espnSync.convertESPNMatchToLiveMatch(row));

    // Fetch recent form for teams in live + today matches only (skip scheduled for perf)
    const currentMatches = [...liveRaw, ...todayRaw];
    const teamIds = new Set<string>();
    currentMatches.forEach(m => {
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
        count: todayMatches.length,
        matches: todayMatches,
      },
      scheduled: {
        count: scheduledMatches.length,
        matches: scheduledMatches,
      },
      teamForm: teamForm,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=5',
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
        scheduled: { count: 0, matches: [] },
        teamForm: {},
      },
      { status: 500 }
    );
  }
}
