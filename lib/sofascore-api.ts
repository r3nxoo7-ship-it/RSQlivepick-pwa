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

const SOFASCORE_BASES = [
  'https://api.sofascore.com/api/v1',
  'https://www.sofascore.com/api/v1',
];

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

async function fetchFromSofascore(path: string, revalidate: number): Promise<Response | null> {
  for (const base of SOFASCORE_BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: FETCH_HEADERS,
        next: { revalidate },
      });
      if (res.ok) return res;
    } catch {
      // Try next base URL
    }
  }
  return null;
}

async function fetchJsonFromSofascore<T>(path: string, revalidate: number): Promise<T | null> {
  const res = await fetchFromSofascore(path, revalidate);
  if (!res) return null;
  return (await res.json()) as T;
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

/**
 * Convert NormalizedSofascoreStats into the team-based MatchStatistics[] format
 * that getStatValue() in AdvancedMatchDetail expects.
 */
function convertToTeamStats(
  s: NormalizedSofascoreStats,
  homeName: string, homeId: number,
  awayName: string, awayId: number,
): any[] {
  const buildStats = (side: 'home' | 'away') => {
    const h = side === 'home';
    return [
      { type: 'Ball Possession', value: `${h ? s.homePoss : s.awayPoss}%` },
      { type: 'Shots on Goal', value: h ? s.homeSoT : s.awaySoT },
      { type: 'Total Shots', value: h ? s.homeShots : s.awayShots },
      { type: 'Shots off Goal', value: h ? (s.homeShotsOff ?? 0) : (s.awayShotsOff ?? 0) },
      { type: 'Corner Kicks', value: h ? s.homeCorners : s.awayCorners },
      { type: 'Fouls', value: h ? s.homeFouls : s.awayFouls },
      { type: 'Offsides', value: h ? s.homeOffsides : s.awayOffsides },
      { type: 'Yellow Cards', value: h ? s.homeYellow : s.awayYellow },
      { type: 'Red Cards', value: h ? s.homeRed : s.awayRed },
    ];
  };
  return [
    { team: { id: homeId, name: homeName }, statistics: buildStats('home') },
    { team: { id: awayId, name: awayName }, statistics: buildStats('away') },
  ];
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
    const res = await fetchFromSofascore(`/sport/football/scheduled-events/${date}`, 300);
    if (!res) return [];
    const data = await res.json();
    return (data.events as SofascoreEvent[]) ?? [];
  } catch {
    return [];
  }
}

/** Fetch all currently LIVE football events (any date/league) */
export async function getLiveEvents(): Promise<SofascoreEvent[]> {
  try {
    const res = await fetchFromSofascore('/sport/football/events/live', 30);
    if (!res) return [];
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
    const data = await fetchJsonFromSofascore<any>(`/team/${teamId}/events/last/${page}`, 300);
    if (!data) return { events: [], hasNextPage: false };
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
    return await fetchJsonFromSofascore<SofascoreStatsResponse>(`/event/${eventId}/statistics`, 300);
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
    const summary = await fetchJsonFromSofascore<any>(`/event/${eventId}/h2h`, 3600);
    if (!summary) return null;
    const homeWins: number = summary.teamDuel?.homeWins ?? 0;
    const awayWins: number = summary.teamDuel?.awayWins ?? 0;
    const draws: number = summary.teamDuel?.draws ?? 0;

    let events: SofascoreEvent[] | undefined;
    const evData = await fetchJsonFromSofascore<any>(`/event/${eventId}/h2h/events`, 3600);
    if (evData) {
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

/**
 * Get LIVE and UPCOMING matches from SofaScore for TODAY
 * This is the primary source for real-time match data - superior stats coverage
 * Returns LiveMatch[] compatible format with enriched SofaScore statistics
 */
export async function getLiveMatchesFromSofascore(): Promise<any[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch scheduled events AND dedicated live endpoint in parallel.
    // The live endpoint catches matches the scheduled-events/{date} call
    // might miss due to UTC date boundaries (e.g. Turkish Cup evening games).
    const [scheduledEvents, liveEvents] = await Promise.all([
      getScheduledEvents(today),
      getLiveEvents(),
    ]);

    // Merge & deduplicate by event ID — live endpoint is authoritative for
    // currently-running matches; scheduled adds upcoming ones.
    const eventMap = new Map<number, SofascoreEvent>();
    for (const e of (scheduledEvents ?? [])) eventMap.set(e.id, e);
    for (const e of (liveEvents ?? [])) eventMap.set(e.id, e); // live overwrites
    const events = Array.from(eventMap.values());

    if (events.length === 0) {
      console.log('[SofaScore] No events found for today');
      return [];
    }

    console.log(`[SofaScore] Found ${events.length} events (${scheduledEvents?.length ?? 0} scheduled + ${liveEvents?.length ?? 0} live, after dedup)`);

    // Filter to LIVE (inprogress) and upcoming (notstarted) - exclude finished
    const activeEvents = events.filter(e => 
      e.status?.type === 'inprogress' || e.status?.type === 'notstarted'
    );

    if (activeEvents.length === 0) {
      console.log('[SofaScore] No active matches (live or upcoming)');
      return [];
    }

    console.log(`[SofaScore] ${activeEvents.length} active matches found`);

    // Enrich each event with full statistics in parallel
    // Always try to fetch match-level stats for live matches — the SofaScore
    // /event/{id}/statistics endpoint returns possession, shots, corners etc.
    // even when hasEventPlayerStatistics is false (that flag controls player-level stats).
    const enrichedMatches = await Promise.all(
      activeEvents.map(async (event) => {
        const isLive = event.status?.type === 'inprogress';
        const stats = isLive
          ? await getMatchStatistics(event.id)
          : null;

        // Normalize stats into flat shape + team-based format for frontend
        const normalizedStats = stats
          ? normalizeSofascoreStats(stats, event.homeScore?.period1, event.awayScore?.period1)
          : null;

        // Build match object compatible with LiveMatch interface
        const homeGoals = event.homeScore?.current ?? 0;
        const awayGoals = event.awayScore?.current ?? 0;

        const leagueParts: string[] = [];
        if (event.tournament?.category?.name) leagueParts.push(event.tournament.category.name);
        if (event.tournament?.name) leagueParts.push(event.tournament.name);
        const league = leagueParts.join(' — ') || 'Football';

        // Map SofaScore status to API-Football-compatible status object
        const statusType = event.status?.type || 'notstarted';
        const statusDesc = event.status?.description || '';
        // Approximate elapsed minutes from start timestamp
        const minutesSinceStart = statusType === 'inprogress'
          ? Math.min(90, Math.floor((Date.now() / 1000 - event.startTimestamp) / 60))
          : null;
        const fixStatus = (() => {
          switch (statusType) {
            case 'inprogress':
              if (statusDesc.toLowerCase().includes('halftime')) return { long: 'Halftime', short: 'HT', elapsed: 45 };
              if (statusDesc.toLowerCase().includes('2nd half')) return { long: 'Second Half', short: '2H', elapsed: minutesSinceStart };
              return { long: 'First Half', short: '1H', elapsed: minutesSinceStart };
            case 'finished': return { long: 'Match Finished', short: 'FT', elapsed: 90 };
            case 'notstarted': return { long: 'Not Started', short: 'NS', elapsed: null };
            case 'postponed': return { long: 'Postponed', short: 'PST', elapsed: null };
            case 'canceled': return { long: 'Cancelled', short: 'CANC', elapsed: null };
            default: return { long: statusDesc || statusType, short: statusType.toUpperCase().slice(0, 3), elapsed: null };
          }
        })();

        const match: any = {
          id: `ss_${event.id}`,
          fixtureId: `ss_${event.id}`,
          date: new Date(event.startTimestamp * 1000).toISOString(),
          fixture: {
            id: event.id,
            date: new Date(event.startTimestamp * 1000).toISOString(),
            status: fixStatus,
            timestamp: event.startTimestamp,
          },
          league: {
            id: 0,
            name: league,
            logo: null,
          },
          teams: {
            home: {
              id: event.homeTeam.id,
              name: event.homeTeam.name,
              displayName: event.homeTeam.name,
              logo: null,
              country: event.homeTeam.country?.name || '',
            },
            away: {
              id: event.awayTeam.id,
              name: event.awayTeam.name,
              displayName: event.awayTeam.name,
              logo: null,
              country: event.awayTeam.country?.name || '',
            },
          },
          goals: {
            home: homeGoals,
            away: awayGoals,
          },
          score: {
            period1: { home: event.homeScore?.period1, away: event.awayScore?.period1 },
            halftime: { home: event.homeScore?.period1, away: event.awayScore?.period1 },
            fulltime: { home: homeGoals, away: awayGoals },
          },
          statistics: normalizedStats ? convertToTeamStats(
            normalizedStats, event.homeTeam.name, event.homeTeam.id,
            event.awayTeam.name, event.awayTeam.id
          ) : [],
          // Populate sofascore_stats so frontend can read xG, big chances, etc.
          sofascore_stats: normalizedStats ? {
            sofascoreEventId: event.id,
            homeXg: normalizedStats.homeXg ?? 0,
            awayXg: normalizedStats.awayXg ?? 0,
            homeBigChances: normalizedStats.homeBigChances ?? 0,
            awayBigChances: normalizedStats.awayBigChances ?? 0,
            homeShotsInBox: normalizedStats.homeShotsInBox ?? 0,
            awayShotsInBox: normalizedStats.awayShotsInBox ?? 0,
            homePassPct: normalizedStats.homePassPct ?? 0,
            awayPassPct: normalizedStats.awayPassPct ?? 0,
            homeInterceptions: normalizedStats.homeInterceptions ?? 0,
            awayInterceptions: normalizedStats.awayInterceptions ?? 0,
            homeClearances: normalizedStats.homeClearances ?? 0,
            awayClearances: normalizedStats.awayClearances ?? 0,
            homeFouls: normalizedStats.homeFouls ?? 0,
            awayFouls: normalizedStats.awayFouls ?? 0,
            homeShotsOff: normalizedStats.homeShotsOff ?? 0,
            awayShotsOff: normalizedStats.awayShotsOff ?? 0,
            homeGoalsPrevented: normalizedStats.homeGoalsPrevented ?? 0,
            awayGoalsPrevented: normalizedStats.awayGoalsPrevented ?? 0,
            homeShotsOnTarget: normalizedStats.homeSoT ?? 0,
            awayShotsOnTarget: normalizedStats.awaySoT ?? 0,
            homeTotalShots: normalizedStats.homeShots ?? 0,
            awayTotalShots: normalizedStats.awayShots ?? 0,
            homeCorners: normalizedStats.homeCorners ?? 0,
            awayCorners: normalizedStats.awayCorners ?? 0,
            homePossession: normalizedStats.homePoss ?? 0,
            awayPossession: normalizedStats.awayPoss ?? 0,
            homeOffsides: normalizedStats.homeOffsides ?? 0,
            awayOffsides: normalizedStats.awayOffsides ?? 0,
            homeYellowCards: normalizedStats.homeYellow ?? 0,
            awayYellowCards: normalizedStats.awayYellow ?? 0,
            homeRedCards: normalizedStats.homeRed ?? 0,
            awayRedCards: normalizedStats.awayRed ?? 0,
            fetchedAt: Date.now(),
          } : undefined,
          _source: 'sofascore',
          _sofascoreEventId: event.id,
          _hasStats: stats !== null,
          _hasXg: event.hasXg ?? false,
        };

        return match;
      })
    );

    console.log(`[SofaScore] Enriched ${enrichedMatches.length} matches with statistics`);
    return enrichedMatches;
  } catch (err) {
    console.error('[SofaScore] Error fetching live matches:', err instanceof Error ? err.message : err);
    return [];
  }
}
