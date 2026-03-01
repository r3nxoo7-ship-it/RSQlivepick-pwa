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

interface BzzoiroRawLeague {
  id: number;
  name: string;
  country: string;
}

interface BzzoiroRawEvent {
  id: number;
  api_id: number;
  league: BzzoiroRawLeague;
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
  // Helper to safely parse numbers (handles string inputs from API)
  const parseNum = (val: any, defaultVal = 0): number => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) || num == null ? defaultVal : num;
  };

  return {
    id: parseNum(raw.id),
    event_id: parseNum(raw.event.id),
    home_team: raw.event.home_team,
    away_team: raw.event.away_team,
    league_name: raw.event.league?.name || '',
    match_date: raw.event.event_date,
    prob_home_win: parseNum(raw.prob_home_win),
    prob_draw: parseNum(raw.prob_draw),
    prob_away_win: parseNum(raw.prob_away_win),
    predicted_result: raw.predicted_result,
    prob_over_15: parseNum(raw.prob_over_15),
    prob_over_25: parseNum(raw.prob_over_25),
    prob_over_35: parseNum(raw.prob_over_35),
    prob_btts_yes: parseNum(raw.prob_btts_yes),
    expected_home_goals: parseNum(raw.expected_home_goals),
    expected_away_goals: parseNum(raw.expected_away_goals),
    // Normalize confidence to 0-1
    confidence: Math.min(parseNum(raw.favorite_prob ?? raw.confidence, 0), 100) / 100,
    model_version: raw.model_version,
    most_likely_score: raw.most_likely_score || '',
    over_25_recommend: raw.over_25_recommend,
    btts_recommend: raw.btts_recommend,
    winner_recommend: raw.winner_recommend,
    odds_home: parseNum(raw.event.odds_home, 0) || undefined,
    odds_draw: parseNum(raw.event.odds_draw, 0) || undefined,
    odds_away: parseNum(raw.event.odds_away, 0) || undefined,
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
// LEAGUES, TEAMS & EVENTS
// ============================================

export interface BzzoiroLeague {
  id: number;
  name: string;
  country: string;
  slug?: string;
}

export interface BzzoiroTeam {
  id: number;
  name: string;
  country: string;
  slug?: string;
  logo?: string;
}

export interface BzzoiroEvent {
  id: number;
  api_id: number;
  league: BzzoiroLeague;
  home_team: string;
  away_team: string;
  event_date: string;
  status: 'notstarted' | 'live' | 'finished' | string;
  home_score: number | null;
  away_score: number | null;
  odds_home?: number;
  odds_draw?: number;
  odds_away?: number;
  odds_over_25?: number;
  odds_btts_yes?: number;
}

interface BzzoiroPaginatedList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Fetch all leagues from Bzzoiro.
 * Cached 6 hours — league list is almost static.
 */
export async function fetchBzzoiroLeagues(): Promise<BzzoiroLeague[]> {
  const res = await fetch(`${BASE_URL}/api/leagues/`, {
    headers: getHeaders(),
    next: { revalidate: 21600 },
  });
  if (!res.ok) throw new Error(`Bzzoiro leagues error: ${res.status}`);
  const data: BzzoiroPaginatedList<BzzoiroLeague> = await res.json();
  return data.results || [];
}

/**
 * Fetch teams, optionally filtered by country.
 * Cached 6 hours.
 */
export async function fetchBzzoiroTeams(country?: string): Promise<BzzoiroTeam[]> {
  const url = country
    ? `${BASE_URL}/api/teams/?country=${encodeURIComponent(country)}`
    : `${BASE_URL}/api/teams/`;
  const res = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 21600 },
  });
  if (!res.ok) throw new Error(`Bzzoiro teams error: ${res.status}`);
  const data: BzzoiroPaginatedList<BzzoiroTeam> = await res.json();
  return data.results || [];
}

/**
 * Fetch events (matches) for a date range.
 * Defaults to today ± 1 day (catches live + upcoming + recently finished).
 * Includes bookmaker odds: home/draw/away, over 2.5, btts.
 */
export async function fetchBzzoiroEvents(
  dateFrom?: string,
  dateTo?: string
): Promise<BzzoiroEvent[]> {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const from = dateFrom || fmt(new Date(today.getTime() - 86400000));
  const to = dateTo || fmt(new Date(today.getTime() + 86400000));

  const allEvents: BzzoiroEvent[] = [];
  let url: string | null = `${BASE_URL}/api/events/?date_from=${from}&date_to=${to}`;
  let page = 0;
  const MAX_PAGES = 5;

  while (url && page < MAX_PAGES) {
    const res = await fetch(url, {
      headers: getHeaders(),
      cache: 'no-store', // events change frequently (scores, live odds)
    });
    if (!res.ok) throw new Error(`Bzzoiro events error: ${res.status}`);
    const data: BzzoiroPaginatedList<BzzoiroEvent> = await res.json();
    allEvents.push(...(data.results || []));
    url = data.next;
    page++;
  }

  return allEvents;
}

/**
 * Build an enriched prediction map keyed by normalised "home|away" string.
 * Merges static ML predictions + live event odds so each entry contains:
 *   - All ML probability fields (from /api/predictions/)
 *   - Live bookmaker odds from /api/events/ (home, draw, away, over_2.5, btts)
 *   - Live score & status from /api/events/ (for cross-validation)
 *
 * This is the primary helper used by the background scanner and filter engine.
 */
export interface BzzoiroEnrichedPrediction extends BzzoiroPrediction {
  // Live event data (may be null if match not in events endpoint)
  live_home_score: number | null;
  live_away_score: number | null;
  live_status: string | null;
  // Bookmaker odds (merged from events if missing from predictions)
  resolved_odds_home: number | null;
  resolved_odds_draw: number | null;
  resolved_odds_away: number | null;
  resolved_odds_over_25: number | null;
  resolved_odds_btts_yes: number | null;
}

let _enrichedCache: { data: Map<string, BzzoiroEnrichedPrediction>; fetchedAt: number } | null = null;
const ENRICHED_CACHE_TTL = 15 * 60 * 1000; // 15 min — shorter than predictions (30 min)

/**
 * Return a home|away keyed Map of enriched predictions.
 * Uses module-level cache; pass force=true to bypass.
 */
export async function getBzzoiroEnrichedMap(
  force = false
): Promise<Map<string, BzzoiroEnrichedPrediction>> {
  if (!force && _enrichedCache && Date.now() - _enrichedCache.fetchedAt < ENRICHED_CACHE_TTL) {
    return _enrichedCache.data;
  }

  // Fetch predictions + today's events in parallel
  const [predictions, events] = await Promise.all([
    fetchBzzoiroPredictions(),
    fetchBzzoiroEvents().catch(() => [] as BzzoiroEvent[]),
  ]);

  // Index events by normalised "home|away" key
  const eventMap = new Map<string, BzzoiroEvent>();
  for (const ev of events) {
    const key = `${normalizeTeamName(ev.home_team)}|${normalizeTeamName(ev.away_team)}`;
    eventMap.set(key, ev);
    // Also index by api_id for precise lookup
    eventMap.set(`apiid:${ev.api_id}`, ev);
  }

  const resultMap = new Map<string, BzzoiroEnrichedPrediction>();

  // Helper to safely parse odds values (handles string inputs from API)
  const parseOdds = (val: any): number | null => {
    if (val == null) return null;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? null : num;
  };

  for (const pred of predictions) {
    const predKey = `${normalizeTeamName(pred.home_team)}|${normalizeTeamName(pred.away_team)}`;
    const event =
      eventMap.get(predKey) ||
      eventMap.get(`apiid:${pred.event_id}`) ||
      null;

    const enriched: BzzoiroEnrichedPrediction = {
      ...pred,
      live_home_score: event?.home_score ?? null,
      live_away_score: event?.away_score ?? null,
      live_status: event?.status ?? null,
      resolved_odds_home: parseOdds(event?.odds_home) ?? pred.odds_home ?? null,
      resolved_odds_draw: parseOdds(event?.odds_draw) ?? pred.odds_draw ?? null,
      resolved_odds_away: parseOdds(event?.odds_away) ?? pred.odds_away ?? null,
      resolved_odds_over_25: parseOdds(event?.odds_over_25) ?? null,
      resolved_odds_btts_yes: parseOdds(event?.odds_btts_yes) ?? null,
    };

    resultMap.set(predKey, enriched);
  }

  _enrichedCache = { data: resultMap, fetchedAt: Date.now() };
  return resultMap;
}

/**
 * Find a Bzzoiro enriched prediction for a live match by team names.
 */
export function findBzzoiroEnriched(
  homeName: string,
  awayName: string,
  map: Map<string, BzzoiroEnrichedPrediction>
): BzzoiroEnrichedPrediction | null {
  // Exact normalised key first
  const key = `${normalizeTeamName(homeName)}|${normalizeTeamName(awayName)}`;
  if (map.has(key)) return map.get(key)!;

  // Fuzzy fallback: iterate and find best match
  let best: BzzoiroEnrichedPrediction | null = null;
  let bestScore = 0;
  for (const [, pred] of map) {
    const hs = teamNameScore(homeName, pred.home_team);
    const as_ = teamNameScore(awayName, pred.away_team);
    const combined = (hs + as_) / 2;
    if (combined > bestScore && hs >= 0.45 && as_ >= 0.45 && combined >= 0.55) {
      bestScore = combined;
      best = pred;
    }
  }
  return best;
}

// Expose teamNameScore for fuzzy matching in other modules
export { teamNameScore };

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
