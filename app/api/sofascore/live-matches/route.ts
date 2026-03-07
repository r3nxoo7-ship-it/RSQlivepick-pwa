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
import * as APIFootball from '@/lib/api-football';
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

/** Top leagues to check directly — covers 95%+ of user interest and stays within Vercel 10s timeout */
const TOP_LEAGUES: Array<{ sport: string; league: string; name: string }> = [
  // Top 5
  { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
  { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
  { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
  { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
  { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
  // UEFA
  { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
  { sport: 'soccer', league: 'uefa.europa', name: 'Europa League' },
  { sport: 'soccer', league: 'uefa.europa.conf', name: 'Conference League' },
  // Other top leagues
  { sport: 'soccer', league: 'ned.1', name: 'Eredivisie' },
  { sport: 'soccer', league: 'por.1', name: 'Primeira Liga' },
  { sport: 'soccer', league: 'bel.1', name: 'Belgian Pro League' },
  { sport: 'soccer', league: 'tur.1', name: 'Turkish Super Lig' },
  { sport: 'soccer', league: 'sco.1', name: 'Scottish Premiership' },
  { sport: 'soccer', league: 'gre.1', name: 'Greek Super League' },
  { sport: 'soccer', league: 'aut.1', name: 'Austrian Bundesliga' },
  { sport: 'soccer', league: 'den.1', name: 'Danish Superliga' },
  { sport: 'soccer', league: 'swe.1', name: 'Allsvenskan' },
  { sport: 'soccer', league: 'nor.1', name: 'Eliteserien' },
  { sport: 'soccer', league: 'cze.1', name: 'Czech First League' },
  { sport: 'soccer', league: 'rou.1', name: 'Romanian Liga 1' },
  { sport: 'soccer', league: 'pol.1', name: 'Polish Ekstraklasa' },
  { sport: 'soccer', league: 'sui.1', name: 'Swiss Super League' },
  { sport: 'soccer', league: 'hrv.1', name: 'Croatian First League' },
  { sport: 'soccer', league: 'svn.1', name: 'Slovenian PrvaLiga' },
  // Second divisions
  { sport: 'soccer', league: 'eng.2', name: 'Championship' },
  { sport: 'soccer', league: 'ger.2', name: '2. Bundesliga' },
  { sport: 'soccer', league: 'ita.2', name: 'Serie B' },
  { sport: 'soccer', league: 'esp.2', name: 'La Liga 2' },
  { sport: 'soccer', league: 'fra.2', name: 'Ligue 2' },
  { sport: 'soccer', league: 'pol.2', name: 'Polish I Liga' },
  { sport: 'soccer', league: 'tur.2', name: 'TFF 1. Lig' },
  // Domestic cups
  { sport: 'soccer', league: 'eng.fa', name: 'FA Cup' },
  { sport: 'soccer', league: 'eng.league_cup', name: 'EFL Cup' },
  { sport: 'soccer', league: 'ger.dfb_pokal', name: 'DFB-Pokal' },
  { sport: 'soccer', league: 'ita.coppa_italia', name: 'Coppa Italia' },
  { sport: 'soccer', league: 'esp.copa_del_rey', name: 'Copa del Rey' },
  { sport: 'soccer', league: 'fra.coupe_de_france', name: 'Coupe de France' },
  { sport: 'soccer', league: 'tur.cup', name: 'Turkish Cup' },
  { sport: 'soccer', league: 'pol.cup', name: 'Polish Cup' },
  { sport: 'soccer', league: 'ned.cup', name: 'KNVB Beker' },
  { sport: 'soccer', league: 'por.cup', name: 'Taça de Portugal' },
  { sport: 'soccer', league: 'bel.cup', name: 'Belgian Cup' },
  { sport: 'soccer', league: 'sco.fa', name: 'Scottish Cup' },
  { sport: 'soccer', league: 'sco.league_cup', name: 'Scottish League Cup' },
  { sport: 'soccer', league: 'nor.cup', name: 'Norwegian Cup' },
  // South America
  { sport: 'soccer', league: 'bra.1', name: 'Brasileirao Serie A' },
  { sport: 'soccer', league: 'arg.1', name: 'Argentine Primera' },
  { sport: 'soccer', league: 'conmebol.libertadores', name: 'Copa Libertadores' },
  { sport: 'soccer', league: 'conmebol.sudamericana', name: 'Copa Sudamericana' },
  // North America
  { sport: 'soccer', league: 'usa.1', name: 'MLS' },
  { sport: 'soccer', league: 'mex.1', name: 'Liga MX' },
  { sport: 'soccer', league: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
];

/**
 * Fetch live matches directly from ESPN API (real-time, bypasses stale Supabase cache).
 * Only returns matches with status === 'in_progress'.
 */
async function fetchLiveFromESPNAPI(): Promise<any[]> {
  const results = await Promise.allSettled(
    TOP_LEAGUES.map(cfg => ESPNAPI.getLeagueMatches(cfg.sport, cfg.league))
  );

  const liveMatches: any[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    for (const m of r.value) {
      if (m.status === 'in_progress') {
        liveMatches.push(espnMatchToLiveMatch(m, TOP_LEAGUES[i].name));
      }
    }
  }

  console.log(`[ESPN API Direct] Found ${liveMatches.length} live matches across ${TOP_LEAGUES.length} leagues`);
  return liveMatches;
}

export async function GET() {
  try {
    let matches = await getLiveMatchesFromSofascore();
    let source = 'sofascore';

    // Fallback chain when SofaScore is blocked/unavailable:
    // 1. API-Football (has full match statistics — corners, shots, attacks, dangerous attacks, etc.)
    // 2. ESPN API (match list only, no detailed stats)
    // 3. Supabase cache (last resort)
    if (!matches || matches.length === 0) {
      // Fallback #1: API-Football — best fallback because it provides stats for filter matching
      try {
        const apiFootballMatches = await APIFootball.getLiveMatches();
        if (apiFootballMatches && apiFootballMatches.length > 0) {
          // /fixtures?live=all does NOT include embedded statistics —
          // fetch per-match stats in parallel so the live page can display them.
          const liveOnly = apiFootballMatches.filter((m: any) => {
            const s = m.fixture?.status?.short;
            return s && s !== 'NS' && s !== 'TBD' && s !== 'PST' && s !== 'CANC';
          });
          await Promise.allSettled(
            liveOnly.slice(0, 15).map(async (m: any) => {
              try {
                const stats = await APIFootball.getMatchStatistics(m.fixture.id);
                if (stats && stats.length > 0) m.statistics = stats;
              } catch { /* non-fatal */ }
            })
          );
          matches = apiFootballMatches;
          source = 'api-football';
          const withStats = liveOnly.filter((m: any) => m.statistics?.length > 0).length;
          console.log(`[/api/sofascore/live-matches] API-Football fallback: ${apiFootballMatches.length} matches (${withStats} with stats)`);
        }
      } catch (apiErr) {
        console.warn('[/api/sofascore/live-matches] API-Football fallback failed:', apiErr instanceof Error ? apiErr.message : apiErr);
      }

      // Fallback #2: ESPN API — has match listing but no detailed stats
      if (!matches || matches.length === 0) {
        try {
          const espnLive = await fetchLiveFromESPNAPI();
          if (espnLive.length > 0) {
            matches = espnLive;
            source = 'espn-api';
          }
        } catch (espnErr) {
          console.warn('[/api/sofascore/live-matches] ESPN API fallback failed:', espnErr);
        }
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
