/**
 * Odds Provider - Fetch live odds from API-Football
 * Supports 1X2 (Win/Draw/Lose), Over/Under, Asian Handicap
 */

const API_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
const API_HOST = process.env.NEXT_PUBLIC_API_FOOTBALL_HOST || 'v3.football.api-sports.io';

export interface Odds {
  id?: string;
  bookmaker?: string;
  bets?: Array<{
    id: number;
    name: string; // "Match Winner", "Goals Over/Under"
    values: Array<{
      value: string; // "Home", "Draw", "Away", "Over X.5", "Under X.5"
      odd: number; // 2.15, 3.50, etc.
    }>;
  }>;
}

export interface ParsedBookmakerOdds {
  // Result (1X2)
  home_win?: number;
  draw?: number;
  away_win?: number;
  // Double Chance
  double_chance_1x?: number;
  double_chance_x2?: number;
  double_chance_12?: number;
  // Goals Over/Under
  goals_over_0_5?: number;
  goals_under_0_5?: number;
  goals_over_1_5?: number;
  goals_under_1_5?: number;
  goals_over_2_5?: number;
  goals_under_2_5?: number;
  goals_over_3_5?: number;
  goals_under_3_5?: number;
  goals_over_4_5?: number;
  goals_under_4_5?: number;
  // First Half Goals
  first_half_over_0_5?: number;
  first_half_under_0_5?: number;
  first_half_over_1_5?: number;
  first_half_under_1_5?: number;
  first_half_over_2_5?: number;
  first_half_under_2_5?: number;
  // Corners Over/Under
  corners_over_7_5?: number;
  corners_under_7_5?: number;
  corners_over_8_5?: number;
  corners_under_8_5?: number;
  corners_over_9_5?: number;
  corners_under_9_5?: number;
  corners_over_10_5?: number;
  corners_under_10_5?: number;
  corners_over_11_5?: number;
  corners_under_11_5?: number;
  // Cards Over/Under
  cards_over_2_5?: number;
  cards_under_2_5?: number;
  cards_over_3_5?: number;
  cards_under_3_5?: number;
  cards_over_4_5?: number;
  cards_under_4_5?: number;
  cards_over_5_5?: number;
  cards_under_5_5?: number;
  // BTTS
  btts_yes?: number;
  btts_no?: number;
  // Allow dynamic access
  [key: string]: number | undefined;
}

export interface MatchOdds {
  fixture_id: number;
  odds: Odds[];
  timestamp: number;
  bookmakers: ParsedBookmakerOdds;
}

/**
 * Fetch odds for a specific match fixture
 */
export async function getOddsForMatch(fixtureId: number): Promise<MatchOdds | null> {
  if (!API_KEY) {
    console.warn('❌ API_FOOTBALL_KEY is missing!');
    return null;
  }

  try {
    const params = new URLSearchParams({
      fixture: fixtureId.toString(),
    }).toString();

    const response = await fetch(
      `https://${API_HOST}/odds?${params}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        },
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ Odds API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.response || data.response.length === 0) {
      return null;
    }

    const oddData = data.response[0];
    const matchOdds = parseOdds(oddData);

    return matchOdds;
  } catch (error) {
    console.error('❌ Error fetching odds:', error);
    return null;
  }
}

/**
 * Normalize an Over/Under value string to a key suffix (e.g. "Over 2.5" -> "2_5")
 */
function normalizeOUValue(val: string): string {
  return val.replace('.', '_');
}

/**
 * Parse odds data from API response
 * Extract all available markets: 1X2, Goals O/U, Corners O/U, Cards O/U, BTTS, etc.
 */
function parseOdds(oddsData: any): MatchOdds {
  const bookmakers: ParsedBookmakerOdds = {};

  // Get first bookmaker's odds (usually the best consensus)
  if (oddsData.bookmakers && oddsData.bookmakers.length > 0) {
    const bets = oddsData.bookmakers[0].bets || [];

    for (const bet of bets) {
      const name: string = bet.name || '';
      const values: Array<{ value: string; odd: number }> = bet.values || [];

      // 1X2 (Match Winner)
      if (name === 'Match Winner') {
        for (const v of values) {
          if (v.value === 'Home') bookmakers.home_win = v.odd;
          if (v.value === 'Draw') bookmakers.draw = v.odd;
          if (v.value === 'Away') bookmakers.away_win = v.odd;
        }
      }

      // Double Chance
      if (name === 'Double Chance') {
        for (const v of values) {
          if (v.value === 'Home/Draw' || v.value === '1X') bookmakers.double_chance_1x = v.odd;
          if (v.value === 'Draw/Away' || v.value === 'X2') bookmakers.double_chance_x2 = v.odd;
          if (v.value === 'Home/Away' || v.value === '12') bookmakers.double_chance_12 = v.odd;
        }
      }

      // Goals Over/Under (all lines)
      if (name.includes('Goals Over/Under') || name === 'Over/Under' || name.includes('Total Goals')) {
        for (const v of values) {
          const match = v.value.match(/^(Over|Under)\s+([\d.]+)$/);
          if (match) {
            const type = match[1].toLowerCase();
            const line = normalizeOUValue(match[2]);
            bookmakers[`goals_${type}_${line}`] = v.odd;
          }
        }
      }

      // First Half Goals Over/Under
      if (name.includes('First Half') && (name.includes('Over/Under') || name.includes('Goals'))) {
        for (const v of values) {
          const match = v.value.match(/^(Over|Under)\s+([\d.]+)$/);
          if (match) {
            const type = match[1].toLowerCase();
            const line = normalizeOUValue(match[2]);
            bookmakers[`first_half_${type}_${line}`] = v.odd;
          }
        }
      }

      // Corners Over/Under
      if (name.includes('Corners') && (name.includes('Over/Under') || name.includes('Total'))) {
        for (const v of values) {
          const match = v.value.match(/^(Over|Under)\s+([\d.]+)$/);
          if (match) {
            const type = match[1].toLowerCase();
            const line = normalizeOUValue(match[2]);
            bookmakers[`corners_${type}_${line}`] = v.odd;
          }
        }
      }

      // Cards Over/Under
      if ((name.includes('Cards') || name.includes('Booking')) && (name.includes('Over/Under') || name.includes('Total'))) {
        for (const v of values) {
          const match = v.value.match(/^(Over|Under)\s+([\d.]+)$/);
          if (match) {
            const type = match[1].toLowerCase();
            const line = normalizeOUValue(match[2]);
            bookmakers[`cards_${type}_${line}`] = v.odd;
          }
        }
      }

      // Both Teams To Score
      if (name === 'Both Teams Score' || name === 'Both Teams to Score' || name === 'BTTS') {
        for (const v of values) {
          if (v.value === 'Yes') bookmakers.btts_yes = v.odd;
          if (v.value === 'No') bookmakers.btts_no = v.odd;
        }
      }
    }
  }

  return {
    fixture_id: oddsData.fixture_id,
    odds: oddsData.bookmakers || [],
    timestamp: Date.now(),
    bookmakers,
  };
}

/**
 * Get odds for multiple matches at once
 */
export async function getOddsForMatches(fixtureIds: number[]): Promise<Map<number, MatchOdds>> {
  const oddsMap = new Map<number, MatchOdds>();

  // Fetch odds in parallel, but with delay to avoid rate limiting
  const promises = fixtureIds.map((id, index) =>
    new Promise((resolve) => {
      setTimeout(async () => {
        const odds = await getOddsForMatch(id);
        if (odds) {
          oddsMap.set(id, odds);
        }
        resolve(null);
      }, index * 100); // Stagger requests by 100ms
    })
  );

  await Promise.all(promises);
  return oddsMap;
}

/**
 * Format odds for display
 * Example: 2.15 -> "2.15" or "-110" (US format)
 */
export function formatOdds(odd: number | undefined, format: 'decimal' | 'us' = 'decimal'): string {
  if (!odd) return '-';

  if (format === 'us') {
    // Convert decimal to US moneyline
    if (odd >= 2) {
      return `+${Math.round((odd - 1) * 100)}`;
    } else {
      return `${Math.round(-100 / (odd - 1))}`;
    }
  }

  return odd.toFixed(2);
}

/**
 * Calculate implied probability from odds
 * Example: 2.0 odds = 50% implied probability
 */
export function getImpliedProbability(odd: number | undefined): number {
  if (!odd || odd <= 0) return 0;
  return Math.round((1 / odd) * 100);
}

/**
 * Find best odds for a bet (compare across bookmakers)
 */
export function getBestOdds(oddsList: (number | undefined)[]): number | undefined {
  const validOdds = oddsList.filter((o): o is number => o !== undefined);
  return validOdds.length > 0 ? Math.max(...validOdds) : undefined;
}
