// ============================================
// R$Q - UNIFIED FOOTBALL API
// ============================================
// Wrapper with automatic fallback:
// 1. Supabase (ESPN data synced every 1 minute) - PRIMARY
// 2. Football-Data.org (FREE 14,400/day) - FALLBACK
// 3. API-Football (FREE 100/day) - FALLBACK

import * as FootballData from './football-data';
import * as APIFootball from './api-football';
// Note: Do NOT import server-only modules (espn-sync) here — this file
// is used by client components. We'll fetch synced data via the server API
// endpoint `/api/espn/matches` to avoid bundling server secrets.

export type { LiveMatch, MatchStatistics } from './football-data';

// ============================================
// CONFIG
// ============================================

const PRIMARY_API: 'supabase' | 'api-football' | 'football-data' = 'supabase';
const ENABLE_FALLBACK = true;

// ============================================
// UNIFIED API FUNCTIONS
// ============================================

/**
 * Get live matches - tries Supabase (ESPN synced) first, then fallback APIs
 */
export async function getLiveMatches() {
  console.log('🔍 Fetching live matches (with fallback)...');

  // Try server-synced Supabase data first via API endpoint
  try {
    console.log('📡 Trying server /api/espn/matches (synced data)...');
    const res = await fetch('/api/espn/matches');
    if (res.ok) {
      const body = await res.json();
      // Support both old format (body.matches) and new format (body.live.matches + body.upcoming.matches)
      if (body?.live?.matches && body?.upcoming?.matches) {
        const allMatches = [...(body.live.matches || []), ...(body.upcoming.matches || [])];
        console.log(`✅ /api/espn/matches SUCCESS: ${allMatches.length} matches (${body.live.count} live, ${body.upcoming.count} upcoming)`);
        return allMatches;
      } else if (body?.matches && body.matches.length > 0) {
        console.log(`✅ /api/espn/matches SUCCESS: ${body.matches.length} matches`);
        return body.matches;
      }
    } else {
      console.warn('⚠️ /api/espn/matches returned', res.status);
    }
  } catch (err) {
    console.warn('⚠️ Server-synced lookup failed, trying fallback...', err);
  }

  // Fallback to API-Football or Football-Data
  if (ENABLE_FALLBACK) {
    try {
      console.log('📡 Trying API-Football (FALLBACK)...');
      const matches = await APIFootball.getLiveMatches();
      console.log(`✅ API-Football FALLBACK SUCCESS: ${matches.length} matches`);
      return matches;
    } catch (apiError) {
      console.error('❌ API-Football failed:', apiError);
      
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
    throw new Error('Supabase unavailable and fallback disabled.');
  }
}

/**
 * Get separated live and upcoming matches
 */
export async function getLiveAndUpcomingMatches() {
  try {
    console.log('📡 Fetching live and upcoming matches...');
    const res = await fetch('/api/espn/matches');
    if (res.ok) {
      const body = await res.json();
      if (body?.live && body?.upcoming) {
        console.log(`✅ Got ${body.live.count} live and ${body.upcoming.count} upcoming matches`);
        return {
          live: body.live.matches || [],
          upcoming: body.upcoming.matches || [],
          teamForm: body.teamForm || {},
        };
      }
    }
  } catch (err) {
    console.error('Error fetching separated matches:', err);
  }

  return { live: [], upcoming: [], teamForm: {} };
}

/**
 * Get match statistics - încearcă PRIMARY apoi FALLBACK
 */
export async function getMatchStatistics(matchId: number) {
  try {
    if (PRIMARY_API === 'football-data') {
      return await FootballData.getMatchStatistics(matchId);
    } else {
      return await APIFootball.getMatchStatistics(matchId);
    }
  } catch (primaryError) {
    console.error('❌ Statistics fetch failed:', primaryError);
    
    if (ENABLE_FALLBACK) {
      try {
        if (PRIMARY_API === 'football-data') {
          return await APIFootball.getMatchStatistics(matchId);
        } else {
          return await FootballData.getMatchStatistics(matchId);
        }
      } catch (fallbackError) {
        console.error('❌ Statistics fallback also failed');
        // Return empty rather than throw
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
    if (PRIMARY_API === 'football-data') {
      return await FootballData.getMatchById(parseInt(String(matchId)));
    } else {
      return await APIFootball.getMatchById(parseInt(String(matchId)));
    }
  } catch (primaryError) {
    console.error('❌ Match fetch failed:', primaryError);
    
    if (ENABLE_FALLBACK) {
      try {
        if (PRIMARY_API === 'football-data') {
          return await APIFootball.getMatchById(parseInt(String(matchId)));
        } else {
          return await FootballData.getMatchById(parseInt(String(matchId)));
        }
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
    primary: PRIMARY_API,
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
