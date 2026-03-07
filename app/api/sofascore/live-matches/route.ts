/**
 * GET /api/sofascore/live-matches
 *
 * Server-side proxy for live + scheduled matches.
 * Primary: ESPN API (free, no-key, works from Vercel).
 * Secondary: SofaScore (blocked by Vercel IPs, kept for future).
 * Fallback: Supabase cache.
 *
 * Stats are fetched via ESPN summary endpoint per live match so the
 * filter engine (which reads sofascore_stats) has corners, shots, possession etc.
 *
 * Response: { matches: LiveMatch[], count: number, source: string }
 */

import { NextResponse } from 'next/server';
import { getLiveMatchesFromSofascore } from '@/lib/sofascore-api';
import * as ESPNAPI from '@/lib/espn-api';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';

/**
 * Convert an ESPNMatch to the LiveMatch format expected by the frontend.
 * Populates sofascore_stats from ESPN fields so the filter engine works.
 */
function espnMatchToLiveMatch(m: ESPNAPI.ESPNMatch, leagueName: string): any {
  const dateStr = m.date || new Date().toISOString();
  const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);

  let statusLong = 'Not Started';
  let statusShort = 'NS';
  let elapsed: number | null = null;

  if (m.status === 'in_progress') {
    statusLong = 'Match in Progress';
    statusShort = 'LIVE';
    elapsed = m.minute || null;
  } else if (m.status === 'completed') {
    statusLong = 'Match Finished';
    statusShort = 'FT';
    elapsed = 90;
  }

  // Build sofascore_stats shape from ESPN match fields — the filter engine
  // reads this directly when statistics[] is empty.
  const sofascore_stats = {
    homeCorners: m.homeCorners ?? 0,
    awayCorners: m.awayCorners ?? 0,
    homeShotsOnTarget: m.homeShotsOnTarget ?? 0,
    awayShotsOnTarget: m.awayShotsOnTarget ?? 0,
    homeTotalShots: m.homeTotalShots ?? 0,
    awayTotalShots: m.awayTotalShots ?? 0,
    homePossession: m.homePossession ?? 0,
    awayPossession: m.awayPossession ?? 0,
    homeYellowCards: m.homeYellowCards ?? 0,
    awayYellowCards: m.awayYellowCards ?? 0,
    homeRedCards: m.homeRedCards ?? 0,
    awayRedCards: m.awayRedCards ?? 0,
    homeFouls: m.homeFouls ?? 0,
    awayFouls: m.awayFouls ?? 0,
    homeOffsides: m.homeOffsides ?? 0,
    awayOffsides: m.awayOffsides ?? 0,
    homeHalfScore: m.homeHalfScore,
    awayHalfScore: m.awayHalfScore,
    fetchedAt: Date.now(),
  };

  return {
    fixture: {
      id: m.id,
      date: dateStr,
      timestamp,
      status: { long: statusLong, short: statusShort, elapsed },
    },
    league: {
      id: 0,
      name: leagueName,
      country: '',
      logo: '',
      flag: '',
    },
    teams: {
      home: {
        id: m.homeTeam.id,
        name: m.homeTeam.displayName || m.homeTeam.name,
        logo: m.homeTeam.logo || '',
      },
      away: {
        id: m.awayTeam.id,
        name: m.awayTeam.displayName || m.awayTeam.name,
        logo: m.awayTeam.logo || '',
      },
    },
    goals: {
      home: m.homeGoals ?? m.homeScore ?? null,
      away: m.awayGoals ?? m.awayScore ?? null,
    },
    score: {
      halftime: { home: m.homeHalfScore ?? null, away: m.awayHalfScore ?? null },
      fulltime: { home: m.homeScore ?? null, away: m.awayScore ?? null },
    },
    statistics: [],
    sofascore_stats,
    odds: m.odds || null,
    _source: 'espn',
  };
}



/**
 * Fetch live + upcoming matches from ESPN.
 * - Uses getActiveTodayLeagues() so ALL leagues with matches today are covered.
 * - Fetches summary stats for up to 25 live matches so the filter engine works.
 * - Includes both in_progress (live) and scheduled (upcoming) matches.
 */
async function fetchFromESPNAPI(): Promise<any[]> {
  const activeLeagues = await ESPNAPI.getActiveTodayLeagues();

  // Build a 7-day date range so upcoming matches (next week) are included.
  // ESPN accepts dates=YYYYMMDD-YYYYMMDD on the scoreboard endpoint.
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const weekLaterStr = new Date(now + 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, '');
  const dateRange = `${todayStr}-${weekLaterStr}`;

  // Fetch all matches across active leagues in parallel (7-day window)
  const leagueResults = await Promise.allSettled(
    activeLeagues.map(cfg => ESPNAPI.getLeagueMatches(cfg.sport, cfg.league, dateRange))
  );

  // Collect all non-completed matches, tracking which league config each belongs to
  type MatchWithCfg = { match: ESPNAPI.ESPNMatch; cfg: ESPNAPI.LeagueConfig };
  const collected: MatchWithCfg[] = [];
  for (let i = 0; i < leagueResults.length; i++) {
    const r = leagueResults[i];
    if (r.status !== 'fulfilled') continue;
    for (const m of r.value) {
      if (m.status !== 'completed') {
        collected.push({ match: m, cfg: activeLeagues[i] });
      }
    }
  }

  // Enrich live (in_progress) matches with summary stats — capped to 25 to stay within timeout
  const liveItems = collected.filter(({ match }) => match.status === 'in_progress').slice(0, 25);
  await Promise.allSettled(
    liveItems.map(async ({ match, cfg }) => {
      try {
        const summary = await ESPNAPI.getMatchSummary(cfg.sport, cfg.league, match.id, 5000);
        if (summary) Object.assign(match, ESPNAPI.enrichMatchWithSummary(match, summary));
      } catch { /* non-fatal */ }
    })
  );

  const converted = collected.map(({ match, cfg }) => espnMatchToLiveMatch(match, cfg.name));
  const liveCount = collected.filter(({ match }) => match.status === 'in_progress').length;
  console.log(`[ESPN API] ${converted.length} matches (${liveCount} live) from ${activeLeagues.length} active leagues`);
  return converted;
}

export async function GET() {
  try {
    // Try SofaScore first — it may work if IP blocking changes.
    // It currently returns [] from Vercel (403 on all domains) so this is fast.
    let matches = await getLiveMatchesFromSofascore();
    let source = 'sofascore';

    // ESPN: works from Vercel, free, covers all leagues, includes stats via summary API.
    // Returns both live (in_progress) and upcoming (scheduled) matches.
    if (!matches || matches.length === 0) {
      try {
        const espnMatches = await fetchFromESPNAPI();
        if (espnMatches.length > 0) {
          matches = espnMatches;
          source = 'espn-api';
        }
      } catch (espnErr) {
        console.warn('[/api/sofascore/live-matches] ESPN fallback failed:', espnErr);
      }

      // Last resort: Supabase cache
      if (!matches || matches.length === 0) {
        try {
          const liveRaw = await espnSync.getLiveMatchesOnly();
          if (liveRaw.length > 0) {
            matches = liveRaw.map((row: any) => espnSync.convertESPNMatchToLiveMatch(row));
            source = 'espn-supabase';
          }
        } catch (dbErr) {
          console.warn('[/api/sofascore/live-matches] Supabase fallback failed:', dbErr);
        }
      }
    }

    return NextResponse.json(
      { matches: matches ?? [], count: matches?.length ?? 0, source },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
        },
      }
    );
  } catch (err) {
    console.error('[/api/sofascore/live-matches] Error:', err);
    return NextResponse.json(
      { matches: [], count: 0, source: 'error', error: err instanceof Error ? err.message : 'Failed' },
      { status: 200 }
    );
  }
}
