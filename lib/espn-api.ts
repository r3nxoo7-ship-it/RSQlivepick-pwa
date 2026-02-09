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
  league: string
): Promise<ESPNMatch[]> {
  try {
    const url = `${BASE_URL}/${sport}/${league}/scoreboard`;
    console.log(`📡 Fetching ${league} matches from ESPN...`);
    
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

  for (const teamData of teams) {
    const teamId = teamData.team?.id;
    const isHome = String(teamId) === String(homeTeamId);
    const isAway = String(teamId) === String(awayTeamId);
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
    homeScore: parseInt(homeCompetitor.score) || 0,
    awayScore: parseInt(awayCompetitor.score) || 0,
    // Scoreboard doesn't return stats - these will be enriched from summary endpoint
    homeGoals: parseInt(homeCompetitor.score) || 0,
    awayGoals: parseInt(awayCompetitor.score) || 0,
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

  let s = '';
  if (typeof status === 'string') {
    s = status;
  } else if (typeof status === 'object') {
    // ESPN sometimes returns an object like { type: { name: 'STATUS', state: 'in' } }
    if (status.type) {
      if (typeof status.type === 'string') s = status.type;
      else if (status.type.name) s = status.type.name;
      else if (status.type.state) s = status.type.state;
    } else if (status.name) {
      s = status.name;
    } else if (status.state) {
      s = status.state;
    } else {
      s = JSON.stringify(status);
    }
  } else {
    s = String(status);
  }

  s = s.toLowerCase();
  if (s.includes('pre') || s.includes('scheduled')) return 'scheduled';
  if (s.includes('live') || s.includes('in')) return 'in_progress';
  if (s.includes('post') || s.includes('final') || s.includes('completed')) return 'completed';
  return 'scheduled';
}

function parseOdds(odds?: any[]): Record<string, any> | undefined {
  if (!odds?.[0]) return undefined;
  
  const oddsList = odds[0];
  return {
    homeWin: oddsList.homeTeamOdds?.moneyLine,
    draw: oddsList.drawOdds?.moneyLine,
    awayWin: oddsList.awayTeamOdds?.moneyLine,
    overUnder: oddsList.overUnder,
  };
}
