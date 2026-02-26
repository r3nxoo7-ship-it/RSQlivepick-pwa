/**
 * SofaScore Unofficial API Client
 *
 * Base URL: https://www.sofascore.com/api/v1/
 * No API key required — public undocumented REST.
 * Rate-limit: cache aggressively; revalidate every 5 minutes.
 *
 * Key endpoints:
 *   /sport/football/scheduled-events/{YYYY-MM-DD}   — all events for a day
 *   /team/{teamId}/events/last/{page}               — team form (page 0 = most recent)
 *   /event/{eventId}/statistics                     — 30+ metrics with period splits (404 on some cups)
 *   /event/{eventId}/h2h                            — aggregate W/D/L only
 *   /event/{eventId}/h2h/events                     — full H2H event list (may return 404)
 */

const BASE = 'https://www.sofascore.com/api/v1';

const FETCH_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Referer: 'https://www.sofascore.com/',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SofascoreTeam {
  id: number;
  name: string;
  slug: string;
  shortName?: string;
  nameCode: string;
  country?: { alpha2: string; alpha3?: string; name: string };
  teamColors?: { primary: string; secondary: string; text: string };
}

export interface SofascoreScore {
  current?: number;
  display?: number;
  period1?: number;
  period2?: number;
  normaltime?: number;
  overtime?: number;
}

export interface SofascoreEvent {
  id: number;
  slug: string;
  homeTeam: SofascoreTeam;
  awayTeam: SofascoreTeam;
  homeScore: SofascoreScore;
  awayScore: SofascoreScore;
  /** status.code 100 = finished; status.type "finished" | "inprogress" | "notstarted" */
  status: { code: number; description: string; type: string };
  startTimestamp: number; // Unix seconds
  tournament: { name: string; slug?: string; category?: { name: string; slug?: string } };
  roundInfo?: { round?: number; name?: string };
  hasEventPlayerStatistics?: boolean;
  hasXg?: boolean;
  coverage?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  /** 1 = home win, 2 = away win, 3 = draw */
  winnerCode?: number;
}

export interface SofascoreStatItem {
  name: string;
  home: string;
  away: string;
  homeValue: number;
  awayValue: number;
  homeTotal?: number;
  awayTotal?: number;
  key: string;
  statisticsType: 'positive' | 'negative' | 'neutral';
  renderType?: number;
}

export interface SofascoreStatGroup {
  groupName: string;
  statisticsItems: SofascoreStatItem[];
}

export interface SofascoreStatPeriod {
  period: 'ALL' | '1ST' | '2ND';
  groups: SofascoreStatGroup[];
}

export interface SofascoreStatsResponse {
  statistics: SofascoreStatPeriod[];
}

/**
 * Normalized stats shape — keys match the ESPN match-stats API response
 * so we can drop-in replace or augment the existing ExpandedMatchStats component.
 */
export interface NormalizedSofascoreStats {
  // Core (shared with ESPN schema)
  homePoss: number;
  awayPoss: number;
  homeSoT: number;
  awaySoT: number;
  homeShots: number; // total shots (SofaScore key: totalShotsOnGoal)
  awayShots: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeOffsides: number;
  awayOffsides: number;
  homeYellow: number;
  awayYellow: number;
  homeRed: number;
  awayRed: number;
  homeHalfScore?: number;
  awayHalfScore?: number;
  // SofaScore-exclusive richness
  homeXg?: number;
  awayXg?: number;
  homeBigChances?: number;
  awayBigChances?: number;
  homeShotsOff?: number;
  awayShotsOff?: number;
  homeShotsInBox?: number;
  awayShotsInBox?: number;
  homeAccuratePasses?: number;
  awayAccuratePasses?: number;
  homePassPct?: number;
  awayPassPct?: number;
  homeInterceptions?: number;
  awayInterceptions?: number;
  homeClearances?: number;
  awayClearances?: number;
  homeGoalsPrevented?: number;
  awayGoalsPrevented?: number;
  /** "sofascore" tag so the UI can show a source badge */
  _source: 'sofascore';
}

/**
 * Minimal RecentMatchData shape — must be compatible with the interface in
 * AdvancedMatchDetail.tsx without importing it (avoids circular deps).
 */
export interface SofascoreRecentMatch {
  id: string;
  date: string;
  league: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  home_corners: null;
  away_corners: null;
  home_shots_on_target: null;
  away_shots_on_target: null;
  home_possession: null;
  away_possession: null;
  home_yellow_cards: null;
  away_yellow_cards: null;
  home_red_cards: number | null;
  away_red_cards: number | null;
  raw_data: {
    sofascoreEventId: number;
    hasStats: boolean;
    hasXg: boolean;
    period1Home?: number;
    period1Away?: number;
    leagueCode?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractStat(groups: SofascoreStatGroup[], key: string): { home: number; away: number } {
  for (const group of groups) {
    const item = group.statisticsItems.find(s => s.key === key);
    if (item) return { home: item.homeValue, away: item.awayValue };
  }
  return { home: 0, away: 0 };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nameMatches(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ─── Conversions ─────────────────────────────────────────────────────────────

/** Convert SofaScore stats response into the normalized shape */
export function normalizeSofascoreStats(
  data: SofascoreStatsResponse,
  halftimeHomeGoals?: number,
  halftimeAwayGoals?: number,
): NormalizedSofascoreStats {
  const allPeriod = data.statistics.find(s => s.period === 'ALL');
  const groups = allPeriod?.groups ?? [];

  const poss = extractStat(groups, 'ballPossession');
  const xg = extractStat(groups, 'expectedGoals');
  const sot = extractStat(groups, 'shotsOnGoal'); // "Shots on target"
  const shots = extractStat(groups, 'totalShotsOnGoal'); // "Total shots" (misleading name)
  const shotsOff = extractStat(groups, 'shotsOffGoal');
  const corners = extractStat(groups, 'cornerKicks');
  const fouls = extractStat(groups, 'fouls');
  const offside = extractStat(groups, 'offsides');
  const yellow = extractStat(groups, 'yellowCards');
  const red = extractStat(groups, 'redCards');
  const bigChances = extractStat(groups, 'bigChanceCreated');
  const shotsInBox = extractStat(groups, 'totalShotsInsideBox');
  const accuratePasses = extractStat(groups, 'accuratePasses');
  const totalPasses = extractStat(groups, 'passes');
  const interceptions = extractStat(groups, 'interceptionWon');
  const clearances = extractStat(groups, 'totalClearance');
  const goalsPrevented = extractStat(groups, 'goalsPrevented');

  const xgHome = parseFloat(String(xg.home)) || 0;
  const xgAway = parseFloat(String(xg.away)) || 0;
  const gpHome = parseFloat(String(goalsPrevented.home)) || 0;
  const gpAway = parseFloat(String(goalsPrevented.away)) || 0;

  // Pass accuracy %
  const ppHome = totalPasses.home > 0 ? Math.round((accuratePasses.home / totalPasses.home) * 100) : 0;
  const ppAway = totalPasses.away > 0 ? Math.round((accuratePasses.away / totalPasses.away) * 100) : 0;

  return {
    homePoss: poss.home,
    awayPoss: poss.away,
    homeSoT: sot.home,
    awaySoT: sot.away,
    homeShots: shots.home,
    awayShots: shots.away,
    homeCorners: corners.home,
    awayCorners: corners.away,
    homeFouls: fouls.home,
    awayFouls: fouls.away,
    homeOffsides: offside.home,
    awayOffsides: offside.away,
    homeYellow: yellow.home,
    awayYellow: yellow.away,
    homeRed: red.home,
    awayRed: red.away,
    homeHalfScore: halftimeHomeGoals,
    awayHalfScore: halftimeAwayGoals,
    homeXg: xgHome || undefined,
    awayXg: xgAway || undefined,
    homeBigChances: bigChances.home || undefined,
    awayBigChances: bigChances.away || undefined,
    homeShotsOff: shotsOff.home || undefined,
    awayShotsOff: shotsOff.away || undefined,
    homeShotsInBox: shotsInBox.home || undefined,
    awayShotsInBox: shotsInBox.away || undefined,
    homeAccuratePasses: accuratePasses.home || undefined,
    awayAccuratePasses: accuratePasses.away || undefined,
    homePassPct: ppHome || undefined,
    awayPassPct: ppAway || undefined,
    homeInterceptions: interceptions.home || undefined,
    awayInterceptions: interceptions.away || undefined,
    homeClearances: clearances.home || undefined,
    awayClearances: clearances.away || undefined,
    homeGoalsPrevented: gpHome || undefined,
    awayGoalsPrevented: gpAway || undefined,
    _source: 'sofascore',
  };
}

/** Convert a SofaScore event object into the RecentMatchData-compatible shape */
export function sofascoreEventToMatch(event: SofascoreEvent): SofascoreRecentMatch {
  const homeGoals = event.homeScore?.normaltime ?? event.homeScore?.current ?? 0;
  const awayGoals = event.awayScore?.normaltime ?? event.awayScore?.current ?? 0;

  const leagueParts: string[] = [];
  if (event.tournament?.category?.name) leagueParts.push(event.tournament.category.name);
  if (event.tournament?.name) leagueParts.push(event.tournament.name);
  const league = leagueParts.join(' — ') || null;

  return {
    id: `ss_${event.id}`,
    date: new Date(event.startTimestamp * 1000).toISOString(),
    league,
    status: event.status?.type ?? 'finished',
    home_team_id: String(event.homeTeam.id),
    away_team_id: String(event.awayTeam.id),
    home_team_name: event.homeTeam.name,
    away_team_name: event.awayTeam.name,
    home_score: homeGoals,
    away_score: awayGoals,
    home_corners: null,
    away_corners: null,
    home_shots_on_target: null,
    away_shots_on_target: null,
    home_possession: null,
    away_possession: null,
    home_yellow_cards: null,
    away_yellow_cards: null,
    home_red_cards: event.homeRedCards ?? null,
    away_red_cards: event.awayRedCards ?? null,
    raw_data: {
      sofascoreEventId: event.id,
      hasStats: event.hasEventPlayerStatistics ?? false,
      hasXg: event.hasXg ?? false,
      period1Home: event.homeScore?.period1,
      period1Away: event.awayScore?.period1,
    },
  };
}

/** Compute form W/D/L summary from a list of matches for a given SofaScore team ID */
export function computeFormSummary(matches: SofascoreRecentMatch[], teamId: number) {
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  const tidStr = String(teamId);
  for (const m of matches) {
    if (m.status !== 'finished') continue;
    const isHome = m.home_team_id === tidStr;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    goalsFor += gf;
    goalsAgainst += ga;
    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;
  }
  const played = wins + draws + losses;
  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
  };
}

// ─── Raw SofaScore API calls ──────────────────────────────────────────────────

/** Fetch all scheduled football events for a given date (YYYY-MM-DD) */
export async function getScheduledEvents(date: string): Promise<SofascoreEvent[]> {
  try {
    const res = await fetch(`${BASE}/sport/football/scheduled-events/${date}`, {
      headers: FETCH_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events as SofascoreEvent[]) ?? [];
  } catch {
    return [];
  }
}

/** Fetch a team's recent events — page 0 is most recent ~20 matches */
export async function getTeamLastEvents(
  teamId: number,
  page = 0,
): Promise<{ events: SofascoreEvent[]; hasNextPage: boolean }> {
  try {
    const res = await fetch(`${BASE}/team/${teamId}/events/last/${page}`, {
      headers: FETCH_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) return { events: [], hasNextPage: false };
    const data = await res.json();
    return {
      events: (data.events as SofascoreEvent[]) ?? [],
      hasNextPage: data.hasNextPage ?? false,
    };
  } catch {
    return { events: [], hasNextPage: false };
  }
}

/** Fetch detailed match statistics — returns null if not available (404) */
export async function getMatchStatistics(eventId: number): Promise<SofascoreStatsResponse | null> {
  try {
    const res = await fetch(`${BASE}/event/${eventId}/statistics`, {
      headers: FETCH_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<SofascoreStatsResponse>;
  } catch {
    return null;
  }
}

/** Fetch H2H aggregate and optionally the full event list */
export async function getH2HForEvent(eventId: number): Promise<{
  homeWins: number;
  awayWins: number;
  draws: number;
  events?: SofascoreEvent[];
} | null> {
  try {
    const [summaryRes, eventsRes] = await Promise.allSettled([
      fetch(`${BASE}/event/${eventId}/h2h`, { headers: FETCH_HEADERS, next: { revalidate: 3600 } }),
      fetch(`${BASE}/event/${eventId}/h2h/events`, { headers: FETCH_HEADERS, next: { revalidate: 3600 } }),
    ]);

    if (summaryRes.status !== 'fulfilled' || !summaryRes.value.ok) return null;
    const summary = await summaryRes.value.json();
    const homeWins: number = summary.teamDuel?.homeWins ?? 0;
    const awayWins: number = summary.teamDuel?.awayWins ?? 0;
    const draws: number = summary.teamDuel?.draws ?? 0;

    let events: SofascoreEvent[] | undefined;
    if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
      const evData = await eventsRes.value.json();
      events = evData.events ?? undefined;
    }

    return { homeWins, awayWins, draws, events };
  } catch {
    return null;
  }
}

/**
 * Find a SofaScore event by home/away team names and date.
 * Searches the scheduled event list for that day using fuzzy name matching.
 */
export async function findSofascoreEvent(
  homeTeam: string,
  awayTeam: string,
  date?: string,
): Promise<{
  eventId: number;
  homeTeamId: number;
  awayTeamId: number;
  event: SofascoreEvent;
} | null> {
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const events = await getScheduledEvents(targetDate);
  if (!events.length) return null;

  const homeNorm = norm(homeTeam);
  const awayNorm = norm(awayTeam);

  const found = events.find(e => {
    const hMatch =
      nameMatches(e.homeTeam.name, homeTeam) ||
      nameMatches(e.homeTeam.shortName ?? '', homeTeam) ||
      nameMatches(e.homeTeam.nameCode ?? '', homeTeam);
    const aMatch =
      nameMatches(e.awayTeam.name, awayTeam) ||
      nameMatches(e.awayTeam.shortName ?? '', awayTeam) ||
      nameMatches(e.awayTeam.nameCode ?? '', awayTeam);
    return hMatch && aMatch;
  });

  // Secondary pass: looser matching using homeNorm/awayNorm
  const found2 =
    found ??
    events.find(e => {
      const hn = norm(e.homeTeam.name);
      const an = norm(e.awayTeam.name);
      return (
        (hn.includes(homeNorm) || homeNorm.includes(hn)) &&
        (an.includes(awayNorm) || awayNorm.includes(an))
      );
    });

  if (!found2) return null;
  return {
    eventId: found2.id,
    homeTeamId: found2.homeTeam.id,
    awayTeamId: found2.awayTeam.id,
    event: found2,
  };
}

/**
 * Extract H2H matches between two teams from a combined event list.
 * Useful when /event/{id}/h2h/events is not available.
 */
export function extractH2HFromEvents(
  events: SofascoreEvent[],
  homeTeamId: number,
  awayTeamId: number,
): SofascoreEvent[] {
  return events.filter(
    e =>
      (e.homeTeam.id === homeTeamId && e.awayTeam.id === awayTeamId) ||
      (e.homeTeam.id === awayTeamId && e.awayTeam.id === homeTeamId),
  );
}
