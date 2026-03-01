// ============================================
// R$Q - UNIFIED FOOTBALL API
// ============================================
// Wrapper with automatic fallback:
// 1. SofaScore (best stats: xG, big chances, shots in box) - PRIMARY
// 2. Supabase (ESPN data synced every 1 minute) - FALLBACK #1
// 3. API-Football (FREE 100/day) - FALLBACK #2
// 4. Football-Data.org (FREE 14,400/day) - FALLBACK #3

import * as FootballData from './football-data';
import * as APIFootball from './api-football';
import * as SofaScore from './sofascore-api';
// Note: Do NOT import server-only modules (espn-sync) here — this file
// is used by client components. We'll fetch synced data via the server API
// endpoint `/api/espn/matches` to avoid bundling server secrets.

export type { LiveMatch, MatchStatistics } from '@/lib/types';

// ============================================
// CONFIG
// ============================================

const ENABLE_FALLBACK = true;

// ============================================
// UNIFIED API FUNCTIONS
// ============================================

/**
 * Get live matches - PRIMARY: SofaScore (best stats), FALLBACK: ESPN, API-Football, Football-Data
 * SofaScore provides superior stat coverage (xG, big chances, etc.) for more accurate filtering
 */
export async function getLiveMatches() {
  console.log('🔍 Fetching live matches (SofaScore PRIMARY)...');

  // 1. PRIMARY: Try SofaScore first (best real-time stats, xG, big chances, coverage)
  try {
    console.log('📡 Trying SofaScore (PRIMARY)...');
    const matches = await SofaScore.getLiveMatchesFromSofascore();
    if (matches && matches.length > 0) {
      console.log(`✅ SofaScore PRIMARY SUCCESS: ${matches.length} matches with enriched stats`);
      return matches;
    } else {
      console.warn('⚠️ SofaScore returned no matches, trying fallbacks...');
    }
  } catch (err) {
    console.warn('⚠️ SofaScore fetch failed:', err instanceof Error ? err.message : err);
  }

  // 2. FALLBACK: Server-synced Supabase data (ESPN)
  try {
    console.log('📡 Trying server /api/espn/matches (synced data)...');
    const res = await fetch('/api/espn/matches');
    if (res.ok) {
      const body = await res.json();
      // Support both formats
      if (body?.live?.matches && body?.upcoming?.matches) {
        const allMatches = [...(body.live.matches || []), ...(body.upcoming.matches || [])];
        console.log(`✅ /api/espn/matches FALLBACK SUCCESS: ${allMatches.length} matches`);
        return allMatches;
      } else if (body?.matches && body.matches.length > 0) {
        console.log(`✅ /api/espn/matches FALLBACK SUCCESS: ${body.matches.length} matches`);
        return body.matches;
      }
    } else {
      console.warn('⚠️ /api/espn/matches returned', res.status);
    }
  } catch (err) {
    console.warn('⚠️ Server-synced lookup failed, trying more fallbacks...', err);
  }

  // 3. FALLBACK: API-Football
  if (ENABLE_FALLBACK) {
    try {
      console.log('📡 Trying API-Football (FALLBACK)...');
      const matches = await APIFootball.getLiveMatches();
      console.log(`✅ API-Football FALLBACK SUCCESS: ${matches.length} matches`);
      return matches;
    } catch (apiError) {
      console.error('❌ API-Football failed:', apiError);

      // 4. FALLBACK: Football-Data.org
      try {
        console.log('🔄 Trying Football-Data.org (FALLBACK)...');
        const matches = await FootballData.getLiveMatches();
        console.log(`✅ Football-Data FALLBACK SUCCESS: ${matches.length} matches`);
        return matches;
      } catch (fallbackError) {
        console.error('❌ FALLBACK APIs also failed:', fallbackError);
        throw new Error('All APIs failed. Check your API keys and limits.');
      }
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
  // 1. PRIMARY: SofaScore (better stats)
  try {
    console.log('📡 Fetching live and upcoming matches (SofaScore PRIMARY)...');
    const allMatches = await SofaScore.getLiveMatchesFromSofascore();
    if (allMatches && allMatches.length > 0) {
      const live = allMatches.filter((m: any) => {
        const s = m.fixture?.status;
        if (!s) return false;
        // status can be an object {short, long, elapsed} or a string
        const short = typeof s === 'object' ? s.short : s;
        return ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(short) ||
          (typeof s === 'string' && s === 'inprogress');
      });
      const upcoming = allMatches.filter((m: any) => {
        const s = m.fixture?.status;
        if (!s) return false;
        const short = typeof s === 'object' ? s.short : s;
        return short === 'NS' || short === 'TBD' ||
          (typeof s === 'string' && s === 'notstarted');
      });
      console.log(`✅ SofaScore: ${live.length} live, ${upcoming.length} upcoming`);
      return {
        live,
        upcoming,
        scheduled: [],
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
        console.log(`✅ ESPN FALLBACK: ${body.live.count} live, ${body.upcoming.count} upcoming, ${body.scheduled?.count || 0} scheduled`);
        return {
          live: body.live.matches || [],
          upcoming: body.upcoming.matches || [],
          scheduled: body.scheduled?.matches || [],
          teamForm: body.teamForm || {},
        };
      }
    }
  } catch (err) {
    console.error('Error fetching separated matches:', err);
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
