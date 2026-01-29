// ============================================
// R$Q - UNIFIED FOOTBALL API
// ============================================
// Wrapper inteligent cu fallback automat între:
// 1. Football-Data.org (PRIMARY - FREE 14,400/day)
// 2. API-Football (FALLBACK - FREE 100/day)

import * as FootballData from './football-data';
import * as APIFootball from './api-football';

export type { LiveMatch, MatchStatistics } from './football-data';

// ============================================
// CONFIG
// ============================================

const PRIMARY_API = 'football-data'; // sau 'api-football'
const ENABLE_FALLBACK = true;

// ============================================
// UNIFIED API FUNCTIONS
// ============================================

/**
 * Get live matches - încearcă PRIMARY apoi FALLBACK
 */
export async function getLiveMatches() {
  console.log('🔍 Fetching live matches (with fallback)...');
  
  // Încearcă PRIMARY API
  try {
    if (PRIMARY_API === 'football-data') {
      console.log('📡 Trying Football-Data.org (PRIMARY)...');
      const matches = await FootballData.getLiveMatches();
      console.log(`✅ Football-Data SUCCESS: ${matches.length} matches`);
      return matches;
    } else {
      console.log('📡 Trying API-Football (PRIMARY)...');
      const matches = await APIFootball.getLiveMatches();
      console.log(`✅ API-Football SUCCESS: ${matches.length} matches`);
      return matches;
    }
  } catch (primaryError) {
    console.error('❌ PRIMARY API failed:', primaryError);
    
    // If fallback is enabled, try the second API
    if (ENABLE_FALLBACK) {
      try {
        if (PRIMARY_API === 'football-data') {
          console.log('🔄 Trying API-Football (FALLBACK)...');
          const matches = await APIFootball.getLiveMatches();
          console.log(`✅ API-Football FALLBACK SUCCESS: ${matches.length} matches`);
          return matches;
        } else {
          console.log('🔄 Trying Football-Data.org (FALLBACK)...');
          const matches = await FootballData.getLiveMatches();
          console.log(`✅ Football-Data FALLBACK SUCCESS: ${matches.length} matches`);
          return matches;
        }
      } catch (fallbackError) {
        console.error('❌ FALLBACK API also failed:', fallbackError);
        throw new Error('Both APIs failed. Check your API keys and limits.');
      }
    } else {
      throw primaryError;
    }
  }
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
