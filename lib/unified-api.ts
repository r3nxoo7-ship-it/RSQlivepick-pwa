// ============================================
// R$Q - UNIFIED FOOTBALL API
// ============================================
// Wrapper with automatic fallback:
// 1. SofaScore (best stats: xG, big chances, shots in box) - PRIMARY
// 2. API-Football (has match stats: corners, shots, attacks, DA) - FALLBACK #1
// 3. Supabase (ESPN data synced every 1 minute, no stats) - FALLBACK #2
// 4. Football-Data.org (FREE 14,400/day) - FALLBACK #3

import * as FootballData from './football-data';
import * as APIFootball from './api-football';
// Note: Do NOT import server-only modules (sofascore-api, espn-sync) here —
// this file is used by client components. SofaScore is accessed via the
// server-side proxy /api/sofascore/live-matches to avoid 403 browser blocks.

export type { LiveMatch, MatchStatistics } from '@/lib/types';

// ============================================
// CONFIG
// ============================================

const ENABLE_FALLBACK = true;

const LIVE_SHORT_STATUSES = new Set(['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'PAUSED']);
const FINISHED_SHORT_STATUSES = new Set(['FT', 'AET', 'PEN']);

function getStatusParts(status: any) {
  if (!status) {
    return { short: '', long: '', elapsed: null as number | null, raw: '' };
  }

  if (typeof status === 'string') {
    return {
      short: status.toUpperCase(),
      long: status.toLowerCase(),
      elapsed: null as number | null,
      raw: status.toLowerCase(),
    };
  }

  const short = String(status.short ?? '').toUpperCase();
  const long = String(status.long ?? '').toLowerCase();
  const elapsed = typeof status.elapsed === 'number' ? status.elapsed : null;
  return { short, long, elapsed, raw: `${short} ${long}`.toLowerCase() };
}

function isLiveStatus(status: any): boolean {
  const { short, long, elapsed, raw } = getStatusParts(status);
  if (!short && !long) return false;
  if (LIVE_SHORT_STATUSES.has(short)) return true;
  if (raw.includes('inprogress') || raw.includes('in progress')) return true;
  if (long.includes('first half') || long.includes('second half') || long.includes('halftime')) return true;
  if (long.includes('extra time') || long.includes('penalties')) return true;
  if (elapsed !== null && elapsed > 0 && !FINISHED_SHORT_STATUSES.has(short) && short !== 'NS' && short !== 'TBD') return true;
  return false;
}

function isUpcomingStatus(status: any): boolean {
  const { short, raw } = getStatusParts(status);
  if (isLiveStatus(status)) return false;
  if (FINISHED_SHORT_STATUSES.has(short)) return false;
  if (short === 'NS' || short === 'TBD') return true;
  if (raw.includes('notstarted') || raw.includes('not started') || raw.includes('scheduled')) return true;
  return !short;
}

// ============================================
// UNIFIED API FUNCTIONS
// ============================================

/**
 * Get live matches - PRIMARY: SofaScore (best stats), FALLBACK: ESPN, API-Football, Football-Data
 * SofaScore provides superior stat coverage (xG, big chances, etc.) for more accurate filtering
 */
export async function getLiveMatches() {
  console.log('🔍 Fetching live matches (SofaScore PRIMARY)...');

  // 1. PRIMARY: SofaScore via server-side proxy (avoids 403 browser blocks)
  try {
    console.log('📡 Trying SofaScore (PRIMARY via /api/sofascore/live-matches)...');
    const res = await fetch('/api/sofascore/live-matches', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const matches = data.matches as any[];
      if (matches && matches.length > 0) {
        console.log(`✅ SofaScore PRIMARY SUCCESS: ${matches.length} matches with enriched stats`);
        return matches;
      } else {
        console.warn('⚠️ SofaScore returned no matches, trying fallbacks...');
      }
    }
  } catch (err) {
    console.warn('⚠️ SofaScore fetch failed:', err instanceof Error ? err.message : err);
  }

  // 2. FALLBACK: API-Football (provides full match statistics — corners, shots, attacks, DA, etc.)
  if (ENABLE_FALLBACK) {
    try {
      console.log('📡 Trying API-Football (FALLBACK #2 — has stats)...');
      const matches = await APIFootball.getLiveMatches();
      if (matches && matches.length > 0) {
        console.log(`✅ API-Football FALLBACK SUCCESS: ${matches.length} matches with stats`);
        return matches;
      }
    } catch (apiError) {
      console.warn('⚠️ API-Football failed:', apiError instanceof Error ? apiError.message : apiError);
    }
  }

  // 3. FALLBACK: Server-synced Supabase data (ESPN — no detailed stats)
  try {
    console.log('📡 Trying server /api/espn/matches (synced data, no stats)...');
    const res = await fetch('/api/espn/matches');
    if (res.ok) {
      const body = await res.json();
      // Support both formats
      if (body?.live?.matches && body?.upcoming?.matches) {
        const allMatches = [...(body.live.matches || []), ...(body.upcoming.matches || [])];
        console.log(`✅ /api/espn/matches FALLBACK SUCCESS: ${allMatches.length} matches (no stats)`);
        return allMatches;
      } else if (body?.matches && body.matches.length > 0) {
        console.log(`✅ /api/espn/matches FALLBACK SUCCESS: ${body.matches.length} matches (no stats)`);
        return body.matches;
      }
    } else {
      console.warn('⚠️ /api/espn/matches returned', res.status);
    }
  } catch (err) {
    console.warn('⚠️ Server-synced lookup failed:', err instanceof Error ? err.message : err);
  }

  // 4. FALLBACK: Football-Data.org
  if (ENABLE_FALLBACK) {
    try {
      console.log('🔄 Trying Football-Data.org (FALLBACK)...');
      const matches = await FootballData.getLiveMatches();
      console.log(`✅ Football-Data FALLBACK SUCCESS: ${matches.length} matches`);
      return matches;
    } catch (fallbackError) {
      console.error('❌ All fallback APIs failed:', fallbackError);
      throw new Error('All APIs failed. Check your API keys and limits.');
    }
  } else {
    throw new Error('SofaScore unavailable and fallback disabled.');
  }
}

/**
 * Get separated live and upcoming matches
 * Uses SofaScore as primary and ESPN as fallback
 */
export async function getLiveAndUpcomingMatches() {
  // Helper: is this match's date today (local timezone)?
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  function isToday(m: any): boolean {
    const d = m.fixture?.date;
    if (!d) return true; // no date → treat as today
    const matchDay = new Date(d);
    const key = `${matchDay.getFullYear()}-${String(matchDay.getMonth() + 1).padStart(2, '0')}-${String(matchDay.getDate()).padStart(2, '0')}`;
    return key === todayKey;
  }

  // 1. PRIMARY: SofaScore via server-side proxy (avoids 403 browser blocks)
  try {
    console.log('📡 Fetching live and upcoming matches (SofaScore PRIMARY via proxy)...');
    const res = await fetch('/api/sofascore/live-matches', { signal: AbortSignal.timeout(8000) });
    const allMatches = res.ok ? (await res.json()).matches as any[] : null;
    if (allMatches && allMatches.length > 0) {
      const live = allMatches.filter((m: any) => isLiveStatus(m.fixture?.status));
      const allUpcoming = allMatches.filter((m: any) => isUpcomingStatus(m.fixture?.status));
      // Split upcoming into today vs future days
      const upcoming = allUpcoming.filter(isToday);
      const scheduled = allUpcoming.filter(m => !isToday(m));
      console.log(`✅ SofaScore: ${live.length} live, ${upcoming.length} upcoming today, ${scheduled.length} scheduled future`);
      return {
        live,
        upcoming,
        scheduled,
        teamForm: {},
      };
    }
  } catch (err) {
    console.warn('⚠️ SofaScore live+upcoming failed:', err instanceof Error ? err.message : err);
  }

  // 2. FALLBACK: ESPN
  try {
    console.log('📡 Trying server /api/espn/matches (FALLBACK)...');
    const res = await fetch('/api/espn/matches');
    if (res.ok) {
      const body = await res.json();
      if (body?.live && body?.upcoming) {
        let liveMatches = body.live.matches || [];

        // Emergency fallback: if both SofaScore and ESPN report zero live,
        // ask API-Football directly for live fixtures so Live tab is not empty.
        if (liveMatches.length === 0) {
          try {
            const apiLive = await APIFootball.getLiveMatches();
            if (apiLive.length > 0) {
              console.log(`✅ API-Football emergency live fallback: ${apiLive.length} matches`);
              liveMatches = apiLive;
            }
          } catch (apiErr) {
            console.warn('⚠️ API-Football emergency live fallback failed:', apiErr);
          }
        }

        console.log(`✅ ESPN FALLBACK: ${body.live.count} live, ${body.upcoming.count} upcoming, ${body.scheduled?.count || 0} scheduled`);
        return {
          live: liveMatches,
          upcoming: body.upcoming.matches || [],
          scheduled: body.scheduled?.matches || [],
          teamForm: body.teamForm || {},
        };
      }
    }
  } catch (err) {
    console.error('Error fetching separated matches:', err);
  }

  // Final fallback: at least return live fixtures from API-Football.
  try {
    const live = await APIFootball.getLiveMatches();
    if (live.length > 0) {
      console.log(`✅ Final live fallback (API-Football): ${live.length} matches`);
      return { live, upcoming: [], scheduled: [], teamForm: {} };
    }
  } catch (apiErr) {
    console.warn('⚠️ Final API-Football live fallback failed:', apiErr);
  }

  return { live: [], upcoming: [], scheduled: [], teamForm: {} };
}

/**
 * Get match statistics - tries API-Football first, Football-Data as fallback
 */
export async function getMatchStatistics(matchId: number) {
  try {
    return await APIFootball.getMatchStatistics(matchId);
  } catch (primaryError) {
    console.error('❌ Statistics fetch failed:', primaryError);
    
    if (ENABLE_FALLBACK) {
      try {
        return await FootballData.getMatchStatistics(matchId);
      } catch (fallbackError) {
        console.error('❌ Statistics fallback also failed');
        return [];
      }
    } else {
      return [];
    }
  }
}

/**
 * Get a specific match by ID
 */
export async function getMatchById(matchId: string | number) {
  try {
    return await APIFootball.getMatchById(parseInt(String(matchId)));
  } catch (primaryError) {
    console.error('❌ Match fetch failed:', primaryError);
    
    if (ENABLE_FALLBACK) {
      try {
        return await FootballData.getMatchById(parseInt(String(matchId)));
      } catch (fallbackError) {
        console.error('❌ Match fetch fallback also failed');
        throw new Error('Could not fetch match details');
      }
    } else {
      throw primaryError;
    }
  }
}

/**
 * Check which API is working
 */
export async function checkAPIStatus() {
  const results = {
    footballData: { success: false, message: '' },
    apiFootball: { success: false, message: '' },
    primary: 'sofascore' as const,
  };
  
  // Check Football-Data
  try {
    results.footballData = await FootballData.checkAPIStatus();
  } catch (err) {
    results.footballData = {
      success: false,
      message: 'Not configured or error',
    };
  }
  
  // Check API-Football
  try {
    results.apiFootball = await APIFootball.checkAPIStatus();
  } catch (err) {
    results.apiFootball = {
      success: false,
      message: 'Not configured or error',
    };
  }
  
  console.log('📊 API Status:', results);
  
  return results;
}

// ============================================
// EXPORT
// ============================================

const unifiedFootballApi = {
  getLiveMatches,
  getMatchStatistics,
  checkAPIStatus,
};

export default unifiedFootballApi;
