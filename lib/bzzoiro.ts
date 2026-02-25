/**
 * Bzzoiro Sports Data API client
 * Free REST API — CatBoost ML predictions, live scores, player stats
 * Base URL: https://sports.bzzoiro.com
 * Auth:     Authorization: Token <BZZOIRO_API_TOKEN>
 *
 * Actual response structure (confirmed):
 *   GET /api/predictions/?upcoming=true
 *   → { count, next, results: [{ id, event: { home_team, away_team, event_date, league, ... }, prob_home_win, prob_draw, ... }] }
 */

const BASE_URL = 'https://sports.bzzoiro.com';

// ============================================
// RAW API TYPES (as returned by Bzzoiro)
// ============================================

interface BzzoiroLeague {
  id: number;
  name: string;
  country: string;
}

interface BzzoiroRawEvent {
  id: number;
  api_id: number;
  league: BzzoiroLeague;
  home_team: string;
  away_team: string;
  event_date: string;         // ISO with timezone, e.g. "2026-02-25T23:45:00+04:00"
  status: string;             // "notstarted" | "live" | "finished"
  home_score: number | null;
  away_score: number | null;
  // Bookmaker odds (bonus data we can use)
  odds_home?: number;
  odds_draw?: number;
  odds_away?: number;
  odds_over_25?: number;
  odds_btts_yes?: number;
}

interface BzzoiroRawPrediction {
  id: number;
  event: BzzoiroRawEvent;
  created_at: string;
  // 1X2 probabilities (0-100)
  prob_home_win: number;
  prob_draw: number;
  prob_away_win: number;
  predicted_result: 'H' | 'D' | 'A';
  // Goals O/U probabilities (0-100)
  prob_over_15: number;
  prob_over_25: number;
  prob_over_35: number;
  // BTTS (0-100)
  prob_btts_yes: number;
  // Expected goals (continuous, like xG)
  expected_home_goals: number;
  expected_away_goals: number;
  // Quality fields
  confidence: number;           // = favorite team's probability (0-100)
  model_version: string;        // e.g. "v4.1"
  most_likely_score: string;    // e.g. "1-0"
  favorite: 'H' | 'D' | 'A';
  favorite_prob: number;
  // Recommendation flags
  winner_recommend: boolean;
  over_15_recommend: boolean;
  over_25_recommend: boolean;
  over_35_recommend: boolean;
  btts_recommend: boolean;
}

interface BzzoiroPaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BzzoiroRawPrediction[];
}

// ============================================
// NORMALIZED TYPES (flat, easy to use)
// ============================================

export interface BzzoiroPrediction {
  // Identification
  id: number;
  event_id: number;
  home_team: string;
  away_team: string;
  league_name: string;
  match_date: string;           // ISO date string (UTC-normalized)
  // 1X2 probabilities (0-100)
  prob_home_win: number;
  prob_draw: number;
  prob_away_win: number;
  predicted_result: 'H' | 'D' | 'A';
  // Goals probabilities (0-100)
  prob_over_15: number;
  prob_over_25: number;
  prob_over_35: number;
  // BTTS (0-100)
  prob_btts_yes: number;
  // Expected goals
  expected_home_goals: number;
  expected_away_goals: number;
  // Confidence: 0-1 (normalized from the 0-100 favorite_prob)
  confidence: number;
  model_version: string;
  most_likely_score: string;
  // Recommendation flags
  over_25_recommend: boolean;
  btts_recommend: boolean;
  winner_recommend: boolean;
  // Raw bookmaker odds (bonus)
  odds_home?: number;
  odds_draw?: number;
  odds_away?: number;
}

export interface BzzoiroMatchedPrediction extends BzzoiroPrediction {
  matchScore: number; // 0-1, how well team names matched
}

// ============================================
// NORMALIZE: raw → flat BzzoiroPrediction
// ============================================

function normalizePrediction(raw: BzzoiroRawPrediction): BzzoiroPrediction {
  return {
    id: raw.id,
    event_id: raw.event.id,
    home_team: raw.event.home_team,
    away_team: raw.event.away_team,
    league_name: raw.event.league?.name || '',
    match_date: raw.event.event_date,
    prob_home_win: raw.prob_home_win,
    prob_draw: raw.prob_draw,
    prob_away_win: raw.prob_away_win,
    predicted_result: raw.predicted_result,
    prob_over_15: raw.prob_over_15,
    prob_over_25: raw.prob_over_25,
    prob_over_35: raw.prob_over_35,
    prob_btts_yes: raw.prob_btts_yes,
    expected_home_goals: raw.expected_home_goals,
    expected_away_goals: raw.expected_away_goals,
    // Normalize confidence to 0-1
    confidence: Math.min(raw.favorite_prob ?? raw.confidence, 100) / 100,
    model_version: raw.model_version,
    most_likely_score: raw.most_likely_score || '',
    over_25_recommend: raw.over_25_recommend,
    btts_recommend: raw.btts_recommend,
    winner_recommend: raw.winner_recommend,
    odds_home: raw.event.odds_home,
    odds_draw: raw.event.odds_draw,
    odds_away: raw.event.odds_away,
  };
}

// ============================================
// API CALLS
// ============================================

function getHeaders(): HeadersInit {
  const token = process.env.BZZOIRO_API_TOKEN;
  if (!token) throw new Error('BZZOIRO_API_TOKEN not set');
  return { Authorization: `Token ${token}` };
}

/**
 * Fetch ALL upcoming + live predictions, handling pagination automatically.
 * Upcoming: paginated, up to 3 pages (~300 predictions for future matches)
 * Live:     single call, returns in-progress matches (so live matches aren't missed)
 * Both are merged and deduplicated by event_id.
 */
export async function fetchBzzoiroPredictions(): Promise<BzzoiroPrediction[]> {
  const byEventId = new Map<number, BzzoiroPrediction>();

  // Fetch upcoming (paginated)
  let url: string | null = `${BASE_URL}/api/predictions/?upcoming=true`;
  let page = 0;
  const MAX_PAGES = 3;

  while (url && page < MAX_PAGES) {
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`Bzzoiro predictions error: ${res.status}`);
    const data: BzzoiroPaginatedResponse = await res.json();
    for (const raw of data.results) {
      const p = normalizePrediction(raw);
      byEventId.set(p.event_id, p);
    }
    url = data.next;
    page++;
  }

  // Also fetch live matches so predictions for in-progress games aren't missed
  try {
    const liveRes = await fetch(`${BASE_URL}/api/predictions/?status=live`, {
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (liveRes.ok) {
      const liveData: BzzoiroPaginatedResponse = await liveRes.json();
      for (const raw of liveData.results || []) {
        const p = normalizePrediction(raw);
        if (!byEventId.has(p.event_id)) byEventId.set(p.event_id, p);
      }
    }
  } catch {
    // Live fetch is best-effort — upcoming is enough for pre-match
  }

  return [...byEventId.values()];
}

/**
 * Fetch live matches with incidents
 */
export async function fetchBzzoiroLive(): Promise<BzzoiroPrediction[]> {
  const res = await fetch(`${BASE_URL}/api/live/`, {
    headers: getHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Bzzoiro live error: ${res.status}`);
  const data: BzzoiroPaginatedResponse = await res.json();
  return (data.results || []).map(normalizePrediction);
}

// ============================================
// TEAM NAME MATCHING
// ============================================

/**
 * Normalize a team name for fuzzy comparison
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(fc|afc|cf|sc|fk|sk|ac|as|us|ss|cd|bk|if|ff|hif|ik|united|city|town)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamNameScore(a: string, b: string): number {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);

  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = new Set(na.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  if (union === 0) return 0;
  const jaccard = intersection / union;

  const firstA = [...wordsA][0];
  const firstB = [...wordsB][0];
  const firstWordBonus = firstA && firstB && firstA === firstB ? 0.15 : 0;

  return Math.min(1, jaccard + firstWordBonus);
}

/**
 * Find the best Bzzoiro prediction for a home/away name pair.
 * Returns null if no match scores above the threshold.
 */
export function findBzzoiroPrediction(
  homeName: string,
  awayName: string,
  predictions: BzzoiroPrediction[],
  matchDate?: string,
  minScore = 0.55
): BzzoiroMatchedPrediction | null {
  // Narrow to ±1 day window when date is provided
  const candidates = matchDate
    ? predictions.filter(p => {
        const diff = Math.abs(
          new Date(p.match_date).getTime() - new Date(matchDate).getTime()
        );
        return diff <= 2 * 86400000;
      })
    : predictions;

  let best: BzzoiroMatchedPrediction | null = null;
  let bestScore = -1;

  for (const p of candidates) {
    const homeScore = teamNameScore(homeName, p.home_team);
    const awayScore = teamNameScore(awayName, p.away_team);
    const combined = (homeScore + awayScore) / 2;
    if (combined > bestScore && homeScore >= 0.45 && awayScore >= 0.45) {
      bestScore = combined;
      best = { ...p, matchScore: combined };
    }
  }

  return best && bestScore >= minScore ? best : null;
}
