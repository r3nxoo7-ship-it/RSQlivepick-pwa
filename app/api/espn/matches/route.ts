// ============================================
// GET LIVE MATCHES FROM SUPABASE
// ============================================
// GET /api/espn/matches
// Users read from here, not from ESPN directly
// Data is synced every 1 minute via cron

import { NextRequest, NextResponse } from 'next/server';
import * as espnSync from '@/lib/espn-sync';
import { ALL_EUROPEAN_SOCCER_LEAGUES } from '@/lib/espn-api';

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

    // On-demand sync: if no live and no upcoming today, sync today's matches
    // (scheduled future matches may exist from old syncs but today needs fresh data)
    if (liveRaw.length === 0 && todayRaw.length === 0) {
      console.log('📊 [API] No live/upcoming matches for today, triggering on-demand sync...');
      try {
        await espnSync.syncAllMatches(); // Syncs live + today's scheduled

        // Re-fetch today's data
        liveRaw = await espnSync.getLiveMatchesOnly();
        todayRaw = await espnSync.getUpcomingMatches();

        console.log(`✅ Today sync complete: ${liveRaw.length} live, ${todayRaw.length} upcoming`);
      } catch (syncErr) {
        console.error('⚠️ On-demand sync failed:', syncErr);
      }
    }

    // On-demand sync: if few scheduled matches for next 7 days, fetch them
    // Threshold of 50 ensures all leagues (39 × 7 days) are represented, not just a handful
    if (scheduledRaw.length < 50) {
      console.log('📅 [API] No scheduled matches, syncing upcoming 7 days...');
      try {
        await espnSync.syncUpcomingDays(7);
        scheduledRaw = await espnSync.getScheduledMatchesRange(7);
        console.log(`✅ Upcoming sync complete: ${scheduledRaw.length} scheduled`);
      } catch (syncErr) {
        console.error('⚠️ Upcoming sync failed:', syncErr);
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

    const normalizeLeagueName = (name: string) =>
      name
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Derive allowed leagues from canonical list and add a few robust aliases
    const allowedLeagues = new Set(
      ALL_EUROPEAN_SOCCER_LEAGUES.map(l => normalizeLeagueName(l.name))
    );
    const allowedAliases = [
      'swiss super league',
      'super league switzerland',
      'norwegian cup',
      'nm cup',
      'norway cup',
    ];
    for (const alias of allowedAliases) allowedLeagues.add(alias);

    const filterByAllowed = (row: any) => {
      if (!validFilter(row)) return false;
      if (!row.league) return true;
      const normalized = normalizeLeagueName(String(row.league));
      return allowedLeagues.has(normalized);
    };

    const liveMatches = liveRaw.filter(filterByAllowed).map(row => espnSync.convertESPNMatchToLiveMatch(row));
    const todayMatches = todayRaw.filter(filterByAllowed).map(row => espnSync.convertESPNMatchToLiveMatch(row));
    const scheduledMatches = scheduledRaw.filter(filterByAllowed).map(row => espnSync.convertESPNMatchToLiveMatch(row));

    // Fetch recent form for teams in live + today + first 2 days of scheduled matches
    const scheduledSample = scheduledRaw.slice(0, 40); // limit to avoid excessive DB queries
    const currentMatches = [...liveRaw, ...todayRaw, ...scheduledSample];
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
