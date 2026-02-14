// ============================================
import { MatchOdds } from '@/lib/odds-provider';
import { LiveMatch, MatchStatistics, ApiResponse } from '@/lib/types';

// R$Q FOOTBALL SCANNER - API Football Client
// ============================================
// This file handles all communications with API-Football
// Learn: API calls, async/await, TypeScript types, error handling

// ============================================
// PARTEA 1: CONFIGURARE
// ============================================

// Luăm cheia API din .env.local
// NEXT_PUBLIC_ înseamnă că poate fi folosită și în browser
const API_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
const API_HOST = process.env.NEXT_PUBLIC_API_FOOTBALL_HOST || 'v3.football.api-sports.io';

// Verificăm că avem cheia! Dacă nu, aruncăm eroare
if (!API_KEY) {
  throw new Error('❌ API_FOOTBALL_KEY is missing from .env.local!');
}

// ============================================
// TYPES ARE NOW UNIFIED IN lib/types.ts
// ============================================

// ============================================
// PARTEA 3: HELPER FUNCTIONS (Funcții ajutătoare)
// ============================================

/**
 * Funcție care face request-uri către API-Football
 * 
 * @param endpoint - Ce endpoint vrem să apelăm (ex: "/fixtures")
 * @param params - Parametrii (ex: { live: "all" })
 * @returns Promise cu datele
 * 
 * EXPLICAȚIE async/await:
 * - async = funcția asta face ceva care durează (așteaptă răspuns de la API)
 * - await = "stai aici până primești răspuns"
 */
async function makeRequest<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  
  // 1. Construim URL-ul complet
  // Ex: https://v3.football.api-sports.io/fixtures?live=all
  const queryString = new URLSearchParams(params).toString();
  const url = `https://${API_HOST}${endpoint}${queryString ? '?' + queryString : ''}`;
  
  console.log('📡 API Request:', url); // Log pentru debugging
  
  try {
    // 2. Facem request-ul (fetch = "du-te și cere date")
    const response = await fetch(url, {
      method: 'GET',          // Tipul de request (GET = citește date)
      headers: {
        'x-rapidapi-key': API_KEY!,         // Cheia noastră API
        'x-rapidapi-host': API_HOST,        // Host-ul API
      },
    });
    
    // 3. Verificăm dacă am primit răspuns OK (status 200)
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    // 4. Extragem datele JSON din răspuns
    const data: ApiResponse<T> = await response.json();

    // 4.5. Log rate limit info from headers
    const rateLimit = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    if (rateLimit !== null) {
      console.log(`📊 API Rate Limit: ${rateLimit} requests remaining (resets: ${rateLimitReset})`);
    }

    // 5. Verificăm dacă sunt erori în răspuns
    if (data.errors && data.errors.length > 0) {
      console.error('❌ API Errors:', data.errors);
      throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
    }
    
    // 6. Log pentru a vedea ce am primit
    console.log(`✅ API Success: ${data.results} results`);

    // Log dacă primim 0 rezultate dar ne așteptam la meciuri live
    if (data.results === 0 && url.includes('live=all')) {
      console.warn('⚠️ API returned 0 live matches - check if there are actually games or if API limit reached');
      console.warn('📊 API Response:', {
        results: data.results,
        errors: data.errors,
        rateLimit: data.paging
      });
    }
    
    // 7. Returnăm datele
    return data.response;
    
  } catch (error) {
    // Dacă ceva merge prost, prindem eroarea și o afișăm
    console.error('❌ API Request failed:', error);
    throw error; // Aruncăm eroarea mai departe pentru a fi prinsă de apelant
  }
}

// ============================================
// PARTEA 4: FUNCȚII PUBLICE (Ce poți folosi din alte fișiere)
// ============================================

/**
 * Obține toate meciurile LIVE în acest moment
 * 
 * @returns Array cu meciuri live
 * 
 * USAGE EXAMPLE:
 * const matches = await getLiveMatches();
 * console.log(matches); // [{ fixture: {...}, teams: {...}, ... }]
 */
export async function getLiveMatches(): Promise<LiveMatch[]> {
  return makeRequest<LiveMatch>('/fixtures', { live: 'all' });
}

/**
 * Obține meciurile dintr-o ligă specifică care sunt LIVE
 * 
 * @param leagueId - ID-ul ligii (ex: 39 = Premier League)
 * @returns Array cu meciuri live din acea ligă
 * 
 * LEAGUE IDS:
 * - 39 = Premier League (England)
 * - 140 = La Liga (Spain)
 * - 78 = Bundesliga (Germany)
 * - 135 = Serie A (Italy)
 * - 61 = Ligue 1 (France)
 */
export async function getLiveMatchesByLeague(leagueId: number): Promise<LiveMatch[]> {
  return makeRequest<LiveMatch>('/fixtures', { 
    live: 'all',
    league: leagueId.toString() 
  });
}

/**
 * Obține detalii complete despre UN meci specific
 * 
 * @param fixtureId - ID-ul meciului (ex: 12345)
 * @returns Detalii despre meci
 */
export async function getMatchById(fixtureId: number): Promise<LiveMatch | null> {
  const matches = await makeRequest<LiveMatch>('/fixtures', { 
    id: fixtureId.toString() 
  });
  
  // Returnăm primul meci din array (ar trebui să fie unul singur)
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Obține statisticile detaliate ale unui meci
 * 
 * @param fixtureId - ID-ul meciului
 * @returns Array cu statistici pentru fiecare echipă
 * 
 * STATISTICI DISPONIBILE:
 * - Shots on Goal
 * - Shots off Goal
 * - Total Shots
 * - Blocked Shots
 * - Shots insidebox
 * - Shots outsidebox
 * - Fouls
 * - Corner Kicks
 * - Offsides
 * - Ball Possession
 * - Yellow Cards
 * - Red Cards
 * - Goalkeeper Saves
 * - Total passes
 * - Passes accurate
 * - Passes %
 */
export async function getMatchStatistics(fixtureId: number): Promise<MatchStatistics[]> {
  return makeRequest<MatchStatistics>('/fixtures/statistics', { 
    fixture: fixtureId.toString() 
  });
}

/**
 * Helper function: Extrage o statistică specifică din array
 * 
 * @param statistics - Array cu toate statisticile
 * @param type - Tipul statisticii căutat (ex: "Corner Kicks")
 * @returns Valoarea statisticii sau null dacă nu există
 * 
 * USAGE:
 * const stats = await getMatchStatistics(12345);
 * const homeStats = stats[0]; // Echipa gazdă
 * const corners = getStatValue(homeStats.statistics, "Corner Kicks");
 * console.log(corners); // "8"
 */
export function getStatValue(
  statistics: MatchStatistics['statistics'],
  type: string
): number | string | null {
  const stat = statistics.find(s => s.type === type);
  return stat ? stat.value : null;
}

/**
 * Helper function: Parsează statistici într-un format ușor de folosit
 * 
 * @param statistics - Array cu statistici de la API
 * @returns Obiect cu statistici formatate
 */
export function parseMatchStats(statistics: MatchStatistics[]) {
  // Dacă nu avem date, returnăm null
  if (!statistics || statistics.length === 0) {
    return null;
  }
  
  // Obținem statisticile pentru fiecare echipă
  const homeStats = statistics[0]?.statistics || [];
  const awayStats = statistics[1]?.statistics || [];
  
  // Helper pentru a extrage valori numerice
  const getNumValue = (stats: any[], type: string): number => {
    const value = getStatValue(stats, type);
    if (value === null) return 0;
    if (typeof value === 'number') return value;
    // Dacă e string (ex: "58%"), extragem numărul
    return parseInt(value.toString().replace(/[^0-9]/g, '')) || 0;
  };
  
  // Returnăm un obiect frumos formatat
  return {
    corners: {
      home: getNumValue(homeStats, 'Corner Kicks'),
      away: getNumValue(awayStats, 'Corner Kicks'),
      total: getNumValue(homeStats, 'Corner Kicks') + getNumValue(awayStats, 'Corner Kicks'),
    },
    shots_on_target: {
      home: getNumValue(homeStats, 'Shots on Goal'),
      away: getNumValue(awayStats, 'Shots on Goal'),
    },
    shots_off_target: {
      home: getNumValue(homeStats, 'Shots off Goal'),
      away: getNumValue(awayStats, 'Shots off Goal'),
    },
    total_shots: {
      home: getNumValue(homeStats, 'Total Shots'),
      away: getNumValue(awayStats, 'Total Shots'),
    },
    possession: {
      home: getNumValue(homeStats, 'Ball Possession'),
      away: getNumValue(awayStats, 'Ball Possession'),
    },
    yellow_cards: {
      home: getNumValue(homeStats, 'Yellow Cards'),
      away: getNumValue(awayStats, 'Yellow Cards'),
    },
    red_cards: {
      home: getNumValue(homeStats, 'Red Cards'),
      away: getNumValue(awayStats, 'Red Cards'),
    },
    fouls: {
      home: getNumValue(homeStats, 'Fouls'),
      away: getNumValue(awayStats, 'Fouls'),
    },
  };
}

/**
 * Check API status and connectivity
 */
export async function checkAPIStatus(): Promise<{ success: boolean; message: string }> {
  if (!API_KEY) {
    return {
      success: false,
      message: 'API key not configured',
    };
  }
  
  try {
    const response = await fetch(`https://${API_HOST}/timezone`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': API_KEY,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `API-Football connected (${data.results || 0} timezones available)`,
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        message: error.message || `API error: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// ENHANCED FUNCTIONS: With Odds and Stats
// ============================================

/**
 * Get match details with statistics and odds
 * Fetches live match, stats, and odds all at once
 */
export async function getMatchWithDetails(fixtureId: number) {
  try {
    const [fixtureData, statsData] = await Promise.all([
      makeRequest<LiveMatch>('/fixtures', { id: fixtureId.toString() }),
      getMatchStatistics(fixtureId),
    ]);

    const fixture = fixtureData[0];
    const stats = statsData || [];

    return {
      fixture,
      statistics: stats,
      success: true,
    };
  } catch (error) {
    console.error('❌ Error fetching match details:', error);
    return {
      fixture: null,
      statistics: [],
      success: false,
    };
  }
}

/**
 * Batch fetch matches with their statistics
 * Useful for showing live matches with stats on dashboard
 */
export async function getMatchesWithStats(matchIds: number[]): Promise<Map<number, any>> {
  const results = new Map();

  // Fetch all stats in parallel with rate limiting
  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    try {
      const stats = await getMatchStatistics(matchId);
      results.set(matchId, stats);

      // Add small delay to avoid rate limiting
      if (i < matchIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn(`⚠️ Could not fetch stats for match ${matchId}`);
    }
  }

  return results;
}

// ============================================
// GATA! Acest fișier poate fi folosit acum!
// ============================================

// USAGE EXAMPLES (în alte fișiere):
/*
import { getLiveMatches, getMatchStatistics, getMatchWithDetails, getMatchesWithStats } from '@/lib/api-football';

// 1. Obține meciuri live
const matches = await getLiveMatches();
console.log('Meciuri live:', matches.length);

// 2. Obține statistici pentru un meci
const stats = await getMatchStatistics(12345);
const parsed = parseMatchStats(stats);
console.log('Corners:', parsed.corners.total);

// 3. Obține detalii complete ale meciului (cu stats și odds)
const matchDetails = await getMatchWithDetails(12345);
console.log('Match:', matchDetails.fixture.teams.home.name);
console.log('Stats:', matchDetails.statistics);

// 4. Obține stats pentru mai multe meciuri
const statsMap = await getMatchesWithStats([12345, 67890, 11111]);
*/
