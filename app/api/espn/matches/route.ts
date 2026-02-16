// ============================================
// GET LIVE MATCHES FROM SUPABASE
// ============================================
// GET /api/espn/matches
// Users read from here, not from ESPN directly
// Data is synced every 1 minute via cron

import { NextRequest, NextResponse } from 'next/server';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';
// Cache for 30 seconds to reduce Supabase load while keeping data relatively fresh
export const revalidate = 10;

/**
 * GET /api/espn/matches
 * Returns 3 sections: live, today (all today's scheduled), scheduled (next 7 days)
 * Also returns recent form for teams in live + today matches
 */
export async function GET(request: NextRequest) {
  try {
    // Get live, today's scheduled, and 7-day scheduled matches
    let liveRaw = await espnSync.getLiveMatchesOnly();
    let todayRaw = await espnSync.getUpcomingMatches();
    let scheduledRaw = await espnSync.getScheduledMatchesRange(7);

    // On-demand sync: if ALL are empty, sync everything right now
    if (liveRaw.length === 0 && todayRaw.length === 0 && scheduledRaw.length === 0) {
      console.log('📊 [API] No matches found, triggering full on-demand sync...');
      try {
        await espnSync.syncAllMatches(); // This syncs live + today's scheduled
        await espnSync.syncUpcomingDays(7); // Schedule for next 7 days
        
        // Re-fetch after sync
        liveRaw = await espnSync.getLiveMatchesOnly();
        todayRaw = await espnSync.getUpcomingMatches();
        scheduledRaw = await espnSync.getScheduledMatchesRange(7);
        
        console.log(`✅ Full sync complete: ${liveRaw.length} live, ${todayRaw.length} today, ${scheduledRaw.length} scheduled`);
      } catch (syncErr) {
        console.error('⚠️ Full on-demand sync failed:', syncErr);
      }
    }

    // On-demand sync: if no completed matches exist, sync past 7 days for team history
    const completedCheck = await espnSync.getCompletedMatchCount();
    if (completedCheck === 0) {
      console.log('📅 No completed matches in DB, syncing past 7 days on-demand...');
      try {
        await espnSync.syncRecentDays(7);
        console.log('📅 Past matches sync complete');
      } catch (syncErr) {
        console.error('⚠️ On-demand past sync failed:', syncErr);
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

    // Limit to the curated leagues (using display names as stored in DB)
    const allowedLeagues = new Set([
      'Premier League', 'Bundesliga', 'Serie A', 'La Liga',
      'Champions League', 'Europa League', 'Conference League',
      'Primeira Liga', 'Eredivisie', 'Belgian Pro League',
      'Ligue 1', 'Turkish Super Lig', 'Austrian Bundesliga',
    ]);

    const filterByAllowed = (row: any) => validFilter(row) && (!row.league || allowedLeagues.has(row.league));

    const liveMatches = liveRaw.filter(filterByAllowed).map(row => espnSync.convertESPNMatchToLiveMatch(row));
    const todayMatches = todayRaw.filter(filterByAllowed).map(row => espnSync.convertESPNMatchToLiveMatch(row));
    const scheduledMatches = scheduledRaw.filter(filterByAllowed).map(row => espnSync.convertESPNMatchToLiveMatch(row));

    // Fetch recent form for teams in live + today matches (parallel, not sequential)
    const currentMatches = [...liveRaw, ...todayRaw];
    const teamIds = new Set<string>();
    currentMatches.forEach(m => {
      if (m.home_team_id) teamIds.add(m.home_team_id);
      if (m.away_team_id) teamIds.add(m.away_team_id);
    });

    const teamForm: Record<string, any> = {};
    if (teamIds.size > 0) {
      const formResults = await Promise.allSettled(
        Array.from(teamIds).map(async (teamId) => {
          const recentMatches = await espnSync.getTeamRecentMatches(teamId, 5);
          return { teamId, form: espnSync.calculateTeamForm(recentMatches, teamId) };
        })
      );
      for (const r of formResults) {
        if (r.status === 'fulfilled') {
          teamForm[r.value.teamId] = r.value.form;
        }
      }
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
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
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
