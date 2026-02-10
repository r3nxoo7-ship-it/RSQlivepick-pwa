// ============================================
// ESPN PUBLIC API SERVICE
// ============================================
// No authentication required - free public API
// Fetches live football/soccer matches and teams

export interface ESPNTeam {
  id: string;
  name: string;
  displayName: string;
  abbreviation?: string;
  logo?: string;
  color?: string;
  alternateColor?: string;
  venueId?: string;
}

export interface ESPNMatch {
  id: string;
  eventId?: string;
  date: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  homeTeam: ESPNTeam;
  awayTeam: ESPNTeam;
  homeScore?: number;
  awayScore?: number;
  homeGoals?: number;
  awayGoals?: number;
  homeCorners?: number;
  awayCorners?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeTotalShots?: number;
  awayTotalShots?: number;
  homePossession?: number;
  awayPossession?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeOffsides?: number;
  awayOffsides?: number;
  period?: string;
  minute?: number;
  venue?: {
    id: string;
    name: string;
    city?: string;
  };
  broadcast?: string;
  odds?: Record<string, any>;
  // League info attached during sync
  __league_config?: { sport: string; league: string; name: string };
}

// ============================================
// LEAGUE CONFIGURATION
// ============================================

export const LEAGUES = {
  // Football (Soccer)
  'soccer-premier-league': { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
  'soccer-la-liga': { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
  'soccer-serie-a': { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
  'soccer-bundesliga': { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
  'soccer-ligue-1': { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
  'soccer-mls': { sport: 'soccer', league: 'usa.1', name: 'MLS' },
  'soccer-champions-league': { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
  
  // American Football
  'nfl': { sport: 'football', league: 'nfl', name: 'NFL' },
  
  // Basketball
  'nba': { sport: 'basketball', league: 'nba', name: 'NBA' },
  
  // Baseball
  'mlb': { sport: 'baseball', league: 'mlb', name: 'MLB' },
  
  // Hockey
  'nhl': { sport: 'hockey', league: 'nhl', name: 'NHL' },
};

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

// Reverse map: league display name → ESPN league code
export const LEAGUE_NAME_TO_CODE: Record<string, string> = {
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Serie A': 'ita.1',
  'Bundesliga': 'ger.1',
  'Ligue 1': 'fra.1',
  'MLS': 'usa.1',
  'Champions League': 'uefa.champions',
};

// ============================================
// FETCH HELPERS
// ============================================

async function fetchWithRetry(url: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LivePick-PWA/1.0' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

/**
 * Get live matches for a specific league
 * @param league - League code (e.g., 'eng.1' for Premier League)
 * @returns Array of live matches
 */
export async function getLeagueMatches(
  sport: string,
  league: string,
  date?: string // Format: YYYYMMDD - fetches specific date instead of today
): Promise<ESPNMatch[]> {
  try {
    let url = `${BASE_URL}/${sport}/${league}/scoreboard`;
    if (date) url += `?dates=${date}`;
    console.log(`📡 Fetching ${league} matches from ESPN${date ? ` for ${date}` : ''}...`);
    
    const data = await fetchWithRetry(url);
    
    if (!data.events) {
      console.warn(`No events found for ${league}`);
      return [];
    }

    return data.events.map((event: any) => parseESPNMatch(event));
  } catch (error) {
    console.error(`Error fetching ${league}:`, error);
    return [];
  }
}

/**
 * Get a team's schedule/results across ALL competitions
 * Fetches in parallel from all leagues, merges and sorts by date
 */
export async function getTeamSchedule(
  teamId: string,
  league?: string,
): Promise<ESPNMatch[]> {
  // Always try the specified league first, then all others in parallel
  const allLeagues = Object.values(LEAGUE_NAME_TO_CODE);
  const leaguesToTry = league
    ? [league, ...allLeagues.filter(l => l !== league)]
    : allLeagues;

  // Fetch from ALL leagues in parallel
  const results = await Promise.allSettled(
    leaguesToTry.map(async (leagueCode) => {
      const url = `${BASE_URL}/soccer/${leagueCode}/teams/${teamId}/schedule`;
      const data = await fetchWithRetry(url);
      if (!data?.events?.length) return [];
      return data.events
        .filter((e: any) => e.competitions?.[0]?.status?.type?.completed === true)
        .map((e: any) => {
          try {
            const match = parseESPNMatch(e);
            // Tag with league info for display
            (match as any).__league_config = { sport: 'soccer', league: leagueCode, name: getLeagueName(leagueCode) };
            return match;
          } catch { return null; }
        })
        .filter(Boolean) as ESPNMatch[];
    })
  );

  // Merge all matches, deduplicate by id, sort by date descending
  const allMatches: ESPNMatch[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const m of r.value) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          allMatches.push(m);
        }
      }
    }
  }

  allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  console.log(`[ESPN] Team ${teamId} schedule: ${allMatches.length} completed matches across all competitions`);
  return allMatches;
}

function getLeagueName(code: string): string {
  const names: Record<string, string> = {
    'eng.1': 'Premier League', 'esp.1': 'La Liga', 'ita.1': 'Serie A',
    'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1', 'usa.1': 'MLS', 'uefa.champions': 'Champions League',
  };
  return names[code] || code;
}

/**
 * Get ALL live matches across multiple leagues
 * @returns Combined array from all configured leagues
 */
export async function getAllLiveMatches(): Promise<ESPNMatch[]> {
  console.log('🌍 Fetching live matches from all leagues...');
  
  const allMatches: ESPNMatch[] = [];
  
  for (const [key, config] of Object.entries(LEAGUES)) {
    const matches = await getLeagueMatches(config.sport, config.league);
    console.log(`  ${config.name}: ${matches.length} matches`);
    allMatches.push(...matches);
  }
  
  return allMatches;
}

/**
 * Get teams for a league
 */
export async function getLeagueTeams(
  sport: string,
  league: string
): Promise<ESPNTeam[]> {
  try {
    const url = `${BASE_URL}/${sport}/${league}/teams`;
    console.log(`📡 Fetching ${league} teams from ESPN...`);
    
    const data = await fetchWithRetry(url);
    
    if (!data.teams) {
      console.warn(`No teams found for ${league}`);
      return [];
    }

    return data.teams.map((team: any) => ({
      id: String(team.id),
      name: team.name,
      displayName: team.displayName,
      abbreviation: team.abbreviation,
      logo: team.logos?.[0]?.href,
      color: team.color,
      alternateColor: team.alternateColor,
      venueId: team.venue?.id,
    }));
  } catch (error) {
    console.error(`Error fetching ${league} teams:`, error);
    return [];
  }
}

/**
 * Get detailed match summary (statistics, form, H2H)
 * The summary endpoint returns rich stats not available from scoreboard:
 * possession, shots, corners, cards, fouls, offsides, tackles, passes etc.
 */
export async function getMatchSummary(
  sport: string,
  league: string,
  eventId: string
): Promise<Record<string, any> | null> {
  try {
    const url = `${BASE_URL}/${sport}/${league}/summary?event=${eventId}`;
    const data = await fetchWithRetry(url);
    return data;
  } catch (error) {
    // Summary might not be available for all matches (e.g. scheduled ones)
    return null;
  }
}

/**
 * Extract team statistics from ESPN summary response
 * Returns stats for home/away team from boxscore.teams[].statistics[]
 */
export function parseSummaryStats(
  summary: Record<string, any>,
  homeTeamId: string,
  awayTeamId: string
): { home: Record<string, number>; away: Record<string, number> } {
  const result = { home: {} as Record<string, number>, away: {} as Record<string, number> };
  const teams = summary?.boxscore?.teams || [];

  for (const [idx, teamData] of teams.entries()) {
    const teamId = teamData.team?.id;
    const homeAway = teamData.homeAway; // ESPN sometimes has this field
    const isHome = homeTeamId ? String(teamId) === String(homeTeamId) : (homeAway === 'home' || idx === 0);
    const isAway = awayTeamId ? String(teamId) === String(awayTeamId) : (homeAway === 'away' || idx === 1);
    const target = isHome ? result.home : isAway ? result.away : null;
    if (!target) continue;

    for (const stat of teamData.statistics || []) {
      const val = parseFloat(stat.displayValue || stat.value) || 0;
      target[stat.name] = val;
    }
  }

  return result;
}

/**
 * Enrich an ESPNMatch with detailed stats from summary
 */
export function enrichMatchWithSummary(
  match: ESPNMatch,
  summary: Record<string, any>
): ESPNMatch {
  const stats = parseSummaryStats(summary, match.homeTeam.id, match.awayTeam.id);

  return {
    ...match,
    homeCorners: stats.home['wonCorners'] || match.homeCorners || 0,
    awayCorners: stats.away['wonCorners'] || match.awayCorners || 0,
    homeShotsOnTarget: stats.home['shotsOnTarget'] || match.homeShotsOnTarget || 0,
    awayShotsOnTarget: stats.away['shotsOnTarget'] || match.awayShotsOnTarget || 0,
    homeTotalShots: stats.home['totalShots'] || match.homeTotalShots || 0,
    awayTotalShots: stats.away['totalShots'] || match.awayTotalShots || 0,
    homePossession: stats.home['possessionPct'] || match.homePossession || 0,
    awayPossession: stats.away['possessionPct'] || match.awayPossession || 0,
    homeYellowCards: stats.home['yellowCards'] || match.homeYellowCards || 0,
    awayYellowCards: stats.away['yellowCards'] || match.awayYellowCards || 0,
    homeRedCards: stats.home['redCards'] || match.homeRedCards || 0,
    awayRedCards: stats.away['redCards'] || match.awayRedCards || 0,
    homeFouls: stats.home['foulsCommitted'] || match.homeFouls || 0,
    awayFouls: stats.away['foulsCommitted'] || match.awayFouls || 0,
    homeOffsides: stats.home['offsides'] || match.homeOffsides || 0,
    awayOffsides: stats.away['offsides'] || match.awayOffsides || 0,
  };
}

// ============================================
// INTERNAL PARSERS
// ============================================

/**
 * Parse score from ESPN - handles both formats:
 * - Scoreboard: competitor.score is a string like "2"
 * - Schedule: competitor.score is an object { value: 2.0, displayValue: "2" }
 */
function parseScore(score: any): number {
  if (score == null) return 0;
  if (typeof score === 'number') return score;
  if (typeof score === 'string') return parseInt(score) || 0;
  if (typeof score === 'object') {
    if (score.value != null) return Math.round(Number(score.value)) || 0;
    if (score.displayValue != null) return parseInt(score.displayValue) || 0;
  }
  return 0;
}

function parseESPNMatch(event: any): ESPNMatch {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];

  // Use homeAway field to correctly identify home/away (ESPN doesn't guarantee array order)
  const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home') || competitors[0] || {};
  const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away') || competitors[1] || {};

  return {
    id: event.id,
    eventId: event.id,
    date: event.date,
    status: normalizeStatus(event.status),
    homeTeam: {
      id: homeCompetitor.team?.id || 'unknown',
      name: homeCompetitor.team?.displayName || homeCompetitor.team?.name || homeCompetitor.displayName || 'Unknown',
      displayName: homeCompetitor.team?.displayName || homeCompetitor.team?.name || homeCompetitor.displayName || 'Unknown',
      abbreviation: homeCompetitor.team?.abbreviation,
      logo: homeCompetitor.team?.logo,
    },
    awayTeam: {
      id: awayCompetitor.team?.id || 'unknown',
      name: awayCompetitor.team?.displayName || awayCompetitor.team?.name || awayCompetitor.displayName || 'Unknown',
      displayName: awayCompetitor.team?.displayName || awayCompetitor.team?.name || awayCompetitor.displayName || 'Unknown',
      abbreviation: awayCompetitor.team?.abbreviation,
      logo: awayCompetitor.team?.logo,
    },
    // Score can be a string ("2") on scoreboard or an object ({value: 2.0, displayValue: "2"}) on schedule
    homeScore: parseScore(homeCompetitor.score),
    awayScore: parseScore(awayCompetitor.score),
    homeGoals: parseScore(homeCompetitor.score),
    awayGoals: parseScore(awayCompetitor.score),
    homeCorners: 0,
    awayCorners: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeTotalShots: 0,
    awayTotalShots: 0,
    homePossession: 0,
    awayPossession: 0,
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
    homeFouls: 0,
    awayFouls: 0,
    homeOffsides: 0,
    awayOffsides: 0,
    period: competition.status?.period?.toString(),
    minute: competition.status?.displayClock ? parseInt(competition.status.displayClock) : undefined,
    venue: competition.venue ? {
      id: competition.venue.id || 'unknown',
      name: competition.venue.fullName || competition.venue.name,
      city: competition.venue.address?.city,
    } : undefined,
    broadcast: competition.broadcasts?.[0]?.names?.[0],
    odds: parseOdds(competition.odds),
  };
}
function normalizeStatus(status?: any): 'scheduled' | 'in_progress' | 'completed' {
  if (!status) return 'scheduled';

  // ESPN returns: { type: { name: "STATUS_FULL_TIME", state: "post", completed: true } }
  // Check the explicit `completed` boolean first
  if (typeof status === 'object') {
    if (status.type?.completed === true) return 'completed';
    // Check state field (most reliable): "pre", "in", "post"
    const state = (status.type?.state || status.state || '').toLowerCase();
    if (state === 'post') return 'completed';
    if (state === 'in') return 'in_progress';
    if (state === 'pre') return 'scheduled';
  }

  // Fallback: string matching on name
  let s = '';
  if (typeof status === 'string') {
    s = status;
  } else if (typeof status === 'object') {
    if (status.type) {
      if (typeof status.type === 'string') s = status.type;
      else if (status.type.name) s = status.type.name;
      else if (status.type.state) s = status.type.state;
    } else if (status.name) {
      s = status.name;
    } else {
      s = JSON.stringify(status);
    }
  } else {
    s = String(status);
  }

  s = s.toLowerCase();
  if (s.includes('pre') || s.includes('scheduled')) return 'scheduled';
  if (s.includes('live') || s.includes('in_progress') || s === 'in') return 'in_progress';
  if (s.includes('post') || s.includes('final') || s.includes('completed') || s.includes('full_time') || s.includes('ended')) return 'completed';
  return 'scheduled';
}

function parseOdds(odds?: any[]): Record<string, any> | undefined {
  if (!odds?.[0]) return undefined;

  const oddsList = odds[0];

  // Extract full moneyline 1X2
  const ml = oddsList.moneyline || {};
  const homeML = ml.home?.close?.odds || oddsList.homeTeamOdds?.moneyLine;
  const awayML = ml.away?.close?.odds || oddsList.awayTeamOdds?.moneyLine;
  const drawML = ml.draw?.close?.odds || oddsList.drawOdds?.moneyLine;

  // Extract over/under
  const total = oddsList.total || {};
  const overOdds = total.over?.close?.odds;
  const underOdds = total.under?.close?.odds;
  const overUnderLine = oddsList.overUnder;

  // Extract spread/handicap
  const spread = oddsList.pointSpread || {};
  const homeSpreadLine = spread.home?.close?.line;
  const homeSpreadOdds = spread.home?.close?.odds;
  const awaySpreadLine = spread.away?.close?.line;
  const awaySpreadOdds = spread.away?.close?.odds;

  // Provider
  const provider = oddsList.provider?.name || 'Unknown';

  return {
    provider,
    // 1X2 Moneyline (American format string or number)
    homeWin: homeML,
    draw: drawML,
    awayWin: awayML,
    // Over/Under
    overUnderLine,
    overOdds,
    underOdds,
    // Spread/Handicap
    homeSpreadLine,
    homeSpreadOdds,
    awaySpreadLine,
    awaySpreadOdds,
    // Legacy
    overUnder: overUnderLine,
  };
}
