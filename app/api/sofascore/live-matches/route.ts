/**
 * GET /api/sofascore/live-matches
 *
 * Server-side proxy for SofaScore live + scheduled matches.
 * This route MUST stay server-side — SofaScore blocks direct browser requests (403).
 *
 * Fallback chain: SofaScore → API-Football (stats) → ESPN API (no stats) → Supabase (cached)
 *
 * Response: { matches: LiveMatch[], count: number, source: string }
 */

import { NextResponse } from 'next/server';
import { getLiveMatchesFromSofascore } from '@/lib/sofascore-api';
import * as ESPNAPI from '@/lib/espn-api';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';

/**
 * Convert an ESPNMatch (from live API) to the LiveMatch format expected by the frontend.
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
    elapsed = m.minute || null;
  }

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
      halftime: { home: null, away: null },
      fulltime: { home: m.homeScore ?? null, away: m.awayScore ?? null },
    },
    statistics: [],
    odds: m.odds || null,
  };
}



/**
 * Fetch live matches directly from ESPN API (real-time, bypasses stale Supabase cache).
 * Uses getActiveTodayLeagues() which dynamically detects leagues with matches today,
 * so all leagues (not just a curated subset) are covered.
 */
async function fetchLiveFromESPNAPI(): Promise<any[]> {
  // getActiveTodayLeagues() caches results per hour — cheap after first call
  const activeLeagues = await ESPNAPI.getActiveTodayLeagues();

  const results = await Promise.allSettled(
    activeLeagues.map(cfg => ESPNAPI.getLeagueMatches(cfg.sport, cfg.league))
  );

  const liveMatches: any[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    for (const m of r.value) {
      if (m.status === 'in_progress') {
        liveMatches.push(espnMatchToLiveMatch(m, activeLeagues[i].name));
      }
    }
  }

  console.log(`[ESPN API Direct] Found ${liveMatches.length} live matches across ${activeLeagues.length} active leagues`);
  return liveMatches;
}

export async function GET() {
  try {
    let matches = await getLiveMatchesFromSofascore();
    let source = 'sofascore';

    // Fallback chain when SofaScore is blocked/unavailable:
    // 1. ESPN API (all active leagues today — no league restriction)
    // 2. Supabase cache (last resort)
    if (!matches || matches.length === 0) {
      // Fallback #1: ESPN API — covers all active leagues today
      try {
        const espnLive = await fetchLiveFromESPNAPI();
        if (espnLive.length > 0) {
          matches = espnLive;
          source = 'espn-api';
        }
      } catch (espnErr) {
        console.warn('[/api/sofascore/live-matches] ESPN API fallback failed:', espnErr);
      }

      // Fallback #3: Supabase cache — last resort
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
