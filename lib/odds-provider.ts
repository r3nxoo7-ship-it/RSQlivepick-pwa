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

export interface MatchOdds {
  fixture_id: number;
  odds: Odds[];
  timestamp: number;
  bookmakers: {
    home_win?: number;
    draw?: number;
    away_win?: number;
    over_2_5?: number;
    under_2_5?: number;
  };
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
 * Parse odds data from API response
 * Extract most common markets (1X2, Over/Under)
 */
function parseOdds(oddsData: any): MatchOdds {
  const bookmakers: any = {
    home_win: undefined,
    draw: undefined,
    away_win: undefined,
    over_2_5: undefined,
    under_2_5: undefined,
  };

  // Get first bookmaker's odds (usually the best consensus)
  if (oddsData.bookmakers && oddsData.bookmakers.length > 0) {
    const bets = oddsData.bookmakers[0].bets || [];

    // Find 1X2 odds
    const matchWinner = bets.find((bet: any) => bet.name === 'Match Winner');
    if (matchWinner) {
      matchWinner.values.forEach((odd: any) => {
        if (odd.value === 'Home') bookmakers.home_win = odd.odd;
        if (odd.value === 'Draw') bookmakers.draw = odd.odd;
        if (odd.value === 'Away') bookmakers.away_win = odd.odd;
      });
    }

    // Find Over/Under 2.5 goals
    const goalsOverUnder = bets.find((bet: any) =>
      bet.name.includes('Goals Over/Under') || bet.name.includes('Total Goals')
    );
    if (goalsOverUnder) {
      goalsOverUnder.values.forEach((odd: any) => {
        if (odd.value === 'Over 2.5') bookmakers.over_2_5 = odd.odd;
        if (odd.value === 'Under 2.5') bookmakers.under_2_5 = odd.odd;
      });
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
