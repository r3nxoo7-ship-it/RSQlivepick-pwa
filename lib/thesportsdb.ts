/**
 * TheSportsDB API Client
 * Free tier: key "3", 30 req/min
 * Patreon $9/mo: event stats (corners, shots, etc.), livescores
 *
 * Key insight: past match data NEVER changes after FT.
 * We fetch once, cache forever in Supabase.
 */

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const API_KEY = process.env.THESPORTSDB_API_KEY || '3';

// --- League mappings ---
// ESPN league name → TheSportsDB league ID
export const ESPN_LEAGUE_TO_TSDB: Record<string, string> = {
  'Premier League': '4328',
  'English Premier League': '4328',
  'Championship': '4329',
  'English League Championship': '4329',
  'League One': '4396',
  'League Two': '4397',
  'Scottish Premier League': '4330',
  'Bundesliga': '4331',
  'German Bundesliga': '4331',
  '2. Bundesliga': '4399',
  'Serie A': '4332',
  'Italian Serie A': '4332',
  'Serie B': '4394',
  'Ligue 1': '4334',
  'French Ligue 1': '4334',
  'Ligue 2': '4401',
  'La Liga': '4335',
  'Spanish La Liga': '4335',
  'Segunda Division': '4400',
  'Eredivisie': '4337',
  'Dutch Eredivisie': '4337',
  'Pro League': '4338',
  'Belgian Jupiler League': '4338',
  'Super Lig': '4339',
  'Turkish Super Lig': '4339',
  'Superliga': '4340',
  'Danish Superliga': '4340',
  'Primeira Liga': '4344',
  'Portuguese Primeira Liga': '4344',
  'Ekstraklasa': '4422',
  'Polish Ekstraklasa': '4422',
  'Champions League': '4480',
  'UEFA Champions League': '4480',
  'Europa League': '4481',
  'UEFA Europa League': '4481',
  'UEFA Conference League': '4481',
  'FA Cup': '4482',
  'Copa del Rey': '4483',
  'Coupe de France': '4484',
  'DFB-Pokal': '4485',
  'Coppa Italia': '4506',
  'Nations League': '4490',
  'UEFA Nations League': '4490',
  'Eliteserien': '4358',
  'Greek Superleague': '4336',
  'Ukrainian Premier League': '4354',
  'Welsh Premier League': '4472',
  'MLS': '4346',
};

// TheSportsDB league ID → league display name
export const TSDB_LEAGUE_NAME: Record<string, string> = {
  '4328': 'Premier League',
  '4329': 'Championship',
  '4330': 'Scottish Premier League',
  '4331': 'Bundesliga',
  '4332': 'Serie A',
  '4334': 'Ligue 1',
  '4335': 'La Liga',
  '4336': 'Greek Superleague',
  '4337': 'Eredivisie',
  '4338': 'Belgian Pro League',
  '4339': 'Süper Lig',
  '4340': 'Danish Superliga',
  '4344': 'Primeira Liga',
  '4346': 'MLS',
  '4354': 'Ukrainian Premier League',
  '4355': 'Russian Premier League',
  '4358': 'Eliteserien',
  '4394': 'Serie B',
  '4396': 'League One',
  '4397': 'League Two',
  '4399': '2. Bundesliga',
  '4400': 'Segunda División',
  '4401': 'Ligue 2',
  '4422': 'Ekstraklasa',
  '4480': 'Champions League',
  '4481': 'Europa League',
  '4482': 'FA Cup',
  '4483': 'Copa del Rey',
  '4484': 'Coupe de France',
  '4485': 'DFB-Pokal',
  '4490': 'Nations League',
  '4506': 'Coppa Italia',
};

// --- Types ---
export interface TSDBEvent {
  idEvent: string;
  idAPIfootball?: string;           // cross-reference to API-Football
  strEvent: string;                 // "Arsenal vs Chelsea"
  strSport: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  intHomeScore: string | null;      // NOTE: strings in TheSportsDB API
  intAwayScore: string | null;
  intRound?: string | null;
  dateEvent: string;                // "2024-09-21"
  strTime: string | null;           // "12:30:00"
  strTimestamp?: string | null;
  strStatus?: string | null;        // "Match Finished" | null
  strVenue?: string | null;
  strCity?: string | null;
  strCountry?: string | null;
  strOfficial?: string | null;      // Referee
  intSpectators?: string | null;
  strThumb?: string | null;
  strVideo?: string | null;
  strPostponed?: string | null;
}

export interface TSDBTeam {
  idTeam: string;
  strTeam: string;
  strAlternate?: string;
  strLeague?: string;
  idLeague?: string;
  strStadium?: string;
  strCountry?: string;
  strTeamBadge?: string;
}

// Normalized match format shared with ESPN format (what UnifiedPreviousGames expects)
export interface CachedMatch {
  id: string;
  tsdb_id: string;
  api_football_id?: string;
  date: string;
  league: string;
  league_id?: string;
  season?: string;
  round?: string | null;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  venue?: string | null;
  referee?: string | null;
  // Stats (only if Patreon key or ESPN summary used)
  home_corners?: number | null;
  away_corners?: number | null;
  home_shots_on_target?: number | null;
  away_shots_on_target?: number | null;
  home_possession?: number | null;
  away_possession?: number | null;
  home_yellow_cards?: number | null;
  away_yellow_cards?: number | null;
  home_red_cards?: number | null;
  away_red_cards?: number | null;
  source: 'thesportsdb' | 'espn';
}

// --- API fetch helper ---
async function tsdbGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${API_KEY}${endpoint}${qs ? '?' + qs : ''}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 0 }, // no Next.js cache
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.error(`[TheSportsDB] ${endpoint} returned ${res.status}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    console.error(`[TheSportsDB] fetch error for ${endpoint}:`, err);
    return null;
  }
}

// --- H2H: searchevents ---
/**
 * Fetch head-to-head matches between two teams.
 * Returns up to 30 past meetings going back decades.
 * Uses searchevents.php?e=Team1_vs_Team2
 */
export async function getH2HEvents(homeTeamName: string, awayTeamName: string): Promise<CachedMatch[]> {
  // TheSportsDB uses underscore-separated team names
  const query = `${homeTeamName.replace(/ /g, '_')}_vs_${awayTeamName.replace(/ /g, '_')}`;
  const data = await tsdbGet<{ event: TSDBEvent[] | null }>('/searchevents.php', { e: query });

  if (!data?.event) return [];

  return data.event
    .filter(e => e.intHomeScore !== null && e.intAwayScore !== null && e.strPostponed !== 'yes')
    .map(e => normalizeEvent(e))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Alternative H2H using eventsvs.php (dedicated team-vs-team endpoint).
 * Requires TheSportsDB team IDs (not ESPN IDs).
 */
export async function getH2HByTeamIds(tsdbHomeId: string, tsdbAwayId: string): Promise<CachedMatch[]> {
  const data = await tsdbGet<{ eventsvs: TSDBEvent[] | null }>('/eventsvs.php', {
    id: tsdbHomeId,
    id2: tsdbAwayId,
  });
  if (!data?.eventsvs) return [];
  return data.eventsvs
    .filter(e => e.intHomeScore !== null && e.intAwayScore !== null)
    .map(e => normalizeEvent(e))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// --- Team last events ---
/**
 * Get last 5 completed events for a team.
 * Free: returns last 5. Patreon: more.
 * Requires TheSportsDB team ID.
 */
export async function getTeamLastEvents(tsdbTeamId: string): Promise<CachedMatch[]> {
  const data = await tsdbGet<{ results: TSDBEvent[] | null }>('/eventslast.php', { id: tsdbTeamId });
  if (!data?.results) return [];
  return data.results
    .filter(e => e.intHomeScore !== null && e.intAwayScore !== null)
    .map(e => normalizeEvent(e))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// --- Team search ---
/**
 * Search for a team by name to get its TheSportsDB ID.
 * Cache results — team IDs never change.
 */
export async function searchTeam(teamName: string): Promise<TSDBTeam | null> {
  const data = await tsdbGet<{ teams: TSDBTeam[] | null }>('/searchteams.php', { t: teamName });
  return data?.teams?.[0] || null;
}

// --- Event stats (Patreon only) ---
/**
 * Fetch match statistics for a specific event.
 * Only works with Patreon API key — returns corners, shots, possession, cards.
 */
export async function getEventStats(tsdbEventId: string): Promise<Record<string, any> | null> {
  const data = await tsdbGet<{ eventstats: any[] | null }>('/lookupeventstats.php', { id: tsdbEventId });
  return data?.eventstats ? parseEventStats(data.eventstats) : null;
}

// --- Helpers ---
function normalizeEvent(e: TSDBEvent): CachedMatch {
  const homeScore = e.intHomeScore !== null && e.intHomeScore !== '' ? parseInt(e.intHomeScore!) : 0;
  const awayScore = e.intAwayScore !== null && e.intAwayScore !== '' ? parseInt(e.intAwayScore!) : 0;
  const dateStr = e.strTimestamp || (e.dateEvent + (e.strTime ? 'T' + e.strTime : 'T00:00:00'));

  return {
    id: `tsdb_${e.idEvent}`,
    tsdb_id: e.idEvent,
    api_football_id: e.idAPIfootball || undefined,
    date: dateStr,
    league: e.strLeague || TSDB_LEAGUE_NAME[e.idLeague] || 'Soccer',
    league_id: e.idLeague,
    season: e.strSeason || undefined,
    round: e.intRound || null,
    home_team_id: `tsdb_${e.idHomeTeam}`,
    away_team_id: `tsdb_${e.idAwayTeam}`,
    home_team_name: e.strHomeTeam,
    away_team_name: e.strAwayTeam,
    home_score: homeScore,
    away_score: awayScore,
    venue: e.strVenue || null,
    referee: e.strOfficial || null,
    home_corners: null,
    away_corners: null,
    home_shots_on_target: null,
    away_shots_on_target: null,
    home_possession: null,
    away_possession: null,
    home_yellow_cards: null,
    away_yellow_cards: null,
    home_red_cards: null,
    away_red_cards: null,
    source: 'thesportsdb',
  };
}

function parseEventStats(stats: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const s of stats) {
    result[s.strStat] = { home: s.intHome, away: s.intAway };
  }
  return result;
}

/**
 * Calculate team form from an array of CachedMatch records.
 * teamId is the tsdb_* prefixed ID.
 */
export function calculateFormFromCache(matches: CachedMatch[], teamId: string) {
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  for (const m of matches) {
    const isHome = m.home_team_id === teamId;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    goalsFor += gf;
    goalsAgainst += ga;
    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;
  }
  return {
    played: matches.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
  };
}
