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
  homePossession?: number;
  awayPossession?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  period?: string;
  minute?: number;
  venue?: {
    id: string;
    name: string;
    city?: string;
  };
  broadcast?: string;
  odds?: Record<string, any>;
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
      id: team.id,
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

// ============================================
// INTERNAL PARSERS
// ============================================

function parseESPNMatch(event: any): ESPNMatch {
  const competition = event.competitions?.[0] || {};
  const [homeCompetitor, awayCompetitor] = competition.competitors || [{}, {}];
  
  return {
    id: event.id,
    eventId: event.id,
    date: event.date,
    status: normalizeStatus(event.status?.type),
    homeTeam: {
      id: homeCompetitor.team?.id || 'unknown',
      name: homeCompetitor.team?.name || 'Unknown',
      displayName: homeCompetitor.displayName || 'Unknown',
      abbreviation: homeCompetitor.team?.abbreviation,
      logo: homeCompetitor.team?.logo,
    },
    awayTeam: {
      id: awayCompetitor.team?.id || 'unknown',
      name: awayCompetitor.team?.name || 'Unknown',
      displayName: awayCompetitor.displayName || 'Unknown',
      abbreviation: awayCompetitor.team?.abbreviation,
      logo: awayCompetitor.team?.logo,
    },
    homeScore: parseInt(homeCompetitor.score) || 0,
    awayScore: parseInt(awayCompetitor.score) || 0,
    homeGoals: parseInt(homeCompetitor.statistics?.find((s: any) => s.name === 'goals')?.displayValue) || 0,
    awayGoals: parseInt(awayCompetitor.statistics?.find((s: any) => s.name === 'goals')?.displayValue) || 0,
    homeCorners: parseInt(homeCompetitor.statistics?.find((s: any) => s.name === 'corners')?.displayValue) || 0,
    awayCorners: parseInt(awayCompetitor.statistics?.find((s: any) => s.name === 'corners')?.displayValue) || 0,
    homeShotsOnTarget: parseInt(homeCompetitor.statistics?.find((s: any) => s.name === 'shotsOnTarget')?.displayValue) || 0,
    awayShotsOnTarget: parseInt(awayCompetitor.statistics?.find((s: any) => s.name === 'shotsOnTarget')?.displayValue) || 0,
    homePossession: parseFloat(homeCompetitor.statistics?.find((s: any) => s.name === 'possession')?.displayValue) || 0,
    awayPossession: parseFloat(awayCompetitor.statistics?.find((s: any) => s.name === 'possession')?.displayValue) || 0,
    homeYellowCards: parseInt(homeCompetitor.statistics?.find((s: any) => s.name === 'yellowCards')?.displayValue) || 0,
    awayYellowCards: parseInt(awayCompetitor.statistics?.find((s: any) => s.name === 'yellowCards')?.displayValue) || 0,
    homeRedCards: parseInt(homeCompetitor.statistics?.find((s: any) => s.name === 'redCards')?.displayValue) || 0,
    awayRedCards: parseInt(awayCompetitor.statistics?.find((s: any) => s.name === 'redCards')?.displayValue) || 0,
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

function normalizeStatus(status?: string): 'scheduled' | 'in_progress' | 'completed' {
  if (!status) return 'scheduled';
  if (status.includes('pre')) return 'scheduled';
  if (status.includes('live') || status.includes('in')) return 'in_progress';
  if (status.includes('post') || status.includes('final')) return 'completed';
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
