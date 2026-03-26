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
  // Halftime scores (from linescores in ESPN summary)
  homeHalfScore?: number;
  awayHalfScore?: number;
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

const BASE_URLS = [
  'https://site.api.espn.com/apis/site/v2/sports',
  'https://sports.core.api.espn.com/apis/site/v2/sports',
  'https://sports.core.api.espn.com/apis/v1/sports',
];

// ============================================
// ALL VALID ESPN SOCCER LEAGUE CODES (127 verified)
// Used for team history across all competitions
// ============================================
export const ALL_SOCCER_LEAGUES: Array<{ code: string; name: string }> = [
  // Top 5 European Leagues
  { code: 'eng.1', name: 'Premier League' },
  { code: 'esp.1', name: 'La Liga' },
  { code: 'ita.1', name: 'Serie A' },
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'fra.1', name: 'Ligue 1' },
  // Other major European leagues
  { code: 'ned.1', name: 'Eredivisie' },
  { code: 'por.1', name: 'Primeira Liga' },
  { code: 'bel.1', name: 'Belgian Pro League' },
  { code: 'sco.1', name: 'Scottish Premiership' },
  { code: 'tur.1', name: 'Super Lig' },
  { code: 'rus.1', name: 'Russian Premier League' },
  { code: 'gre.1', name: 'Greek Super League' },
  { code: 'sui.1', name: 'Swiss Super League' },
  { code: 'aut.1', name: 'Austrian Bundesliga' },
  { code: 'den.1', name: 'Danish Superliga' },
  { code: 'swe.1', name: 'Allsvenskan' },
  { code: 'nor.1', name: 'Eliteserien' },
  { code: 'cze.1', name: 'Czech First League' },
  { code: 'rou.1', name: 'Romanian Liga 1' },
  { code: 'isr.1', name: 'Israeli Premier League' },
  { code: 'cyp.1', name: 'Cypriot First Division' },
  { code: 'fin.1', name: 'Veikkausliiga' },
  { code: 'irl.1', name: 'Irish Premier Division' },
  { code: 'nir.1', name: 'Northern Irish Premiership' },
  { code: 'wal.1', name: 'Welsh Premier League' },
  { code: 'pol.1', name: 'Polish Ekstraklasa' },
  { code: 'svn.1', name: 'Slovenian PrvaLiga' },
  { code: 'hrv.1', name: 'Croatian First League' },
  { code: 'isl.1', name: 'Icelandic Besta deild' },
  { code: 'bih.1', name: 'Bosnian Premier League' },
  { code: 'mkd.1', name: 'Macedonian First League' },
  { code: 'alb.1', name: 'Albanian Superliga' },
  // Second divisions
  { code: 'eng.2', name: 'Championship' },
  { code: 'eng.3', name: 'League One' },
  { code: 'eng.4', name: 'League Two' },
  { code: 'eng.5', name: 'National League' },
  { code: 'esp.2', name: 'La Liga 2' },
  { code: 'ita.2', name: 'Serie B' },
  { code: 'ger.2', name: '2. Bundesliga' },
  { code: 'fra.2', name: 'Ligue 2' },
  { code: 'ned.2', name: 'Eerste Divisie' },
  { code: 'sco.2', name: 'Scottish Championship' },
  { code: 'sco.3', name: 'Scottish League One' },
  { code: 'sco.4', name: 'Scottish League Two' },
  { code: 'tur.2', name: 'TFF 1. Lig' },
  { code: 'pol.2', name: 'Polish I Liga' },
  // Domestic cups
  { code: 'eng.fa', name: 'FA Cup' },
  { code: 'eng.league_cup', name: 'Carabao Cup' },
  { code: 'eng.trophy', name: 'EFL Trophy' },
  { code: 'eng.charity', name: 'Community Shield' },
  { code: 'esp.copa_del_rey', name: 'Copa del Rey' },
  { code: 'esp.super_cup', name: 'Spanish Super Cup' },
  { code: 'ita.coppa_italia', name: 'Coppa Italia' },
  { code: 'ita.super_cup', name: 'Italian Super Cup' },
  { code: 'ger.dfb_pokal', name: 'DFB Pokal' },
  { code: 'ger.super_cup', name: 'DFL Supercup' },
  { code: 'fra.coupe_de_france', name: 'Coupe de France' },
  { code: 'fra.coupe_de_la_ligue', name: 'Coupe de la Ligue' },
  { code: 'ned.cup', name: 'KNVB Beker' },
  { code: 'por.cup', name: 'Taça de Portugal' },
  { code: 'bel.cup', name: 'Belgian Cup' },
  { code: 'tur.cup', name: 'Turkish Cup' },
  { code: 'pol.cup', name: 'Polish Cup' },
  { code: 'sco.fa', name: 'Scottish Cup' },
  { code: 'sco.league_cup', name: 'Scottish League Cup' },
  // South America
  { code: 'bra.1', name: 'Brasileirao Serie A' },
  { code: 'bra.2', name: 'Brasileirao Serie B' },
  { code: 'bra.3', name: 'Brasileirao Serie C' },
  { code: 'arg.1', name: 'Argentine Primera' },
  { code: 'arg.2', name: 'Argentine Nacional B' },
  { code: 'col.1', name: 'Colombian Primera A' },
  { code: 'col.2', name: 'Colombian Primera B' },
  { code: 'chi.1', name: 'Chilean Primera' },
  { code: 'uru.1', name: 'Uruguayan Primera' },
  { code: 'per.1', name: 'Peruvian Liga 1' },
  { code: 'ecu.1', name: 'LigaPro Ecuador' },
  { code: 'ven.1', name: 'Venezuelan Primera' },
  { code: 'bol.1', name: 'Bolivian Primera' },
  { code: 'par.1', name: 'Paraguayan Primera' },
  // North/Central America
  { code: 'usa.1', name: 'MLS' },
  { code: 'usa.open', name: 'US Open Cup' },
  { code: 'usa.usl.1', name: 'USL Championship' },
  { code: 'usa.usl.l1', name: 'USL League One' },
  { code: 'mex.1', name: 'Liga MX' },
  { code: 'mex.2', name: 'Liga de Expansion MX' },
  { code: 'crc.1', name: 'Costa Rican Primera' },
  { code: 'hon.1', name: 'Honduran Liga Nacional' },
  { code: 'slv.1', name: 'Salvadoran Primera' },
  { code: 'gua.1', name: 'Guatemalan Liga Nacional' },
  { code: 'jam.1', name: 'Jamaican Premier League' },
  // Asia
  { code: 'jpn.1', name: 'J1 League' },
  { code: 'chn.1', name: 'Chinese Super League' },
  { code: 'aus.1', name: 'A-League' },
  { code: 'ind.1', name: 'Indian Super League' },
  { code: 'ind.2', name: 'I-League' },
  { code: 'sgp.1', name: 'Singapore Premier League' },
  { code: 'tha.1', name: 'Thai League 1' },
  { code: 'mys.1', name: 'Malaysian Super League' },
  { code: 'idn.1', name: 'Indonesian Liga 1' },
  // Africa
  { code: 'rsa.1', name: 'South African Premier' },
  { code: 'nga.1', name: 'Nigerian Professional League' },
  { code: 'gha.1', name: 'Ghana Premier League' },
  { code: 'ken.1', name: 'Kenyan Premier League' },
  // UEFA competitions
  { code: 'uefa.champions', name: 'Champions League' },
  { code: 'uefa.europa', name: 'Europa League' },
  { code: 'uefa.europa.conf', name: 'Conference League' },
  { code: 'uefa.super_cup', name: 'UEFA Super Cup' },
  { code: 'uefa.euro', name: 'Euro Championship' },
  { code: 'uefa.euroq', name: 'Euro Qualifying' },
  { code: 'uefa.nations', name: 'UEFA Nations League' },
  // CONMEBOL
  { code: 'conmebol.libertadores', name: 'Copa Libertadores' },
  { code: 'conmebol.sudamericana', name: 'Copa Sudamericana' },
  { code: 'conmebol.recopa', name: 'Recopa Sudamericana' },
  { code: 'conmebol.america', name: 'Copa America' },
  // CONCACAF
  { code: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
  { code: 'concacaf.gold', name: 'Gold Cup' },
  { code: 'concacaf.nations.league', name: 'CONCACAF Nations League' },
  { code: 'concacaf.league', name: 'CONCACAF League' },
  // AFC
  { code: 'afc.champions', name: 'AFC Champions League' },
  { code: 'afc.cup', name: 'AFC Champions League Two' },
  // CAF
  { code: 'caf.champions', name: 'CAF Champions League' },
  { code: 'caf.confed', name: 'CAF Confederation Cup' },
  { code: 'caf.nations', name: 'Africa Cup of Nations' },
  // FIFA / International
  { code: 'fifa.world', name: 'FIFA World Cup' },
  { code: 'fifa.worldq.uefa', name: 'WCQ UEFA' },
  { code: 'fifa.worldq.conmebol', name: 'WCQ CONMEBOL' },
  { code: 'fifa.worldq.concacaf', name: 'WCQ CONCACAF' },
  { code: 'fifa.worldq.afc', name: 'WCQ AFC' },
  { code: 'fifa.worldq.caf', name: 'WCQ CAF' },
  { code: 'fifa.worldq.ofc', name: 'WCQ OFC' },
  { code: 'fifa.friendly', name: 'International Friendly' },
  { code: 'fifa.cwc', name: 'Club World Cup' },
  { code: 'fifa.olympics', name: 'Olympic Football' },
  { code: 'club.friendly', name: 'Club Friendly' },
];

// Leagues to sync for LIVE scoreboard (curated - top leagues + cups + continental)
// These get synced every 30s-1min for the dashboard
// For now, sync only the competitions requested by the user (curated list)
// All European soccer leagues we want to track.
// The smart scanner (getActiveTodayLeagues) will filter this list daily —
// only leagues with actual matches today get polled every 30s.
// Adding more leagues here costs nothing unless they have live matches.
export const ALL_EUROPEAN_SOCCER_LEAGUES = [
  // ── Top 5 ──
  { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
  { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
  { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
  { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
  { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
  // ── Continental ──
  { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
  { sport: 'soccer', league: 'uefa.europa', name: 'Europa League' },
  { sport: 'soccer', league: 'uefa.europa.conf', name: 'Conference League' },
  { sport: 'soccer', league: 'uefa.nations', name: 'Nations League' },
  // ── Other top European ──
  { sport: 'soccer', league: 'ned.1', name: 'Eredivisie' },
  { sport: 'soccer', league: 'por.1', name: 'Primeira Liga' },
  { sport: 'soccer', league: 'bel.1', name: 'Belgian Pro League' },
  { sport: 'soccer', league: 'tur.1', name: 'Turkish Super Lig' },
  { sport: 'soccer', league: 'sco.1', name: 'Scottish Premiership' },
  { sport: 'soccer', league: 'gre.1', name: 'Greek Super League' },
  { sport: 'soccer', league: 'aut.1', name: 'Austrian Bundesliga' },
  { sport: 'soccer', league: 'den.1', name: 'Danish Superliga' },
  { sport: 'soccer', league: 'swe.1', name: 'Allsvenskan' },
  { sport: 'soccer', league: 'nor.1', name: 'Eliteserien' },
  { sport: 'soccer', league: 'cze.1', name: 'Czech First League' },
  { sport: 'soccer', league: 'rou.1', name: 'Romanian Liga 1' },
  { sport: 'soccer', league: 'sui.1', name: 'Swiss Super League' },
  { sport: 'soccer', league: 'ukr.1', name: 'Ukrainian Premier League' },
  { sport: 'soccer', league: 'srb.1', name: 'Serbian SuperLiga' },
  { sport: 'soccer', league: 'cro.1', name: 'Croatian HNL' },
  { sport: 'soccer', league: 'slv.1', name: 'Slovak Fortuna Liga' },
  { sport: 'soccer', league: 'hun.1', name: 'Hungarian NB I' },
  { sport: 'soccer', league: 'bul.1', name: 'Bulgarian First League' },
  { sport: 'soccer', league: 'pol.1', name: 'Polish Ekstraklasa' },
  { sport: 'soccer', league: 'svn.1', name: 'Slovenian PrvaLiga' },
  { sport: 'soccer', league: 'hrv.1', name: 'Croatian First League' },
  { sport: 'soccer', league: 'fin.1', name: 'Finnish Veikkausliiga' },
  { sport: 'soccer', league: 'isl.1', name: 'Icelandic Besta deild' },
  { sport: 'soccer', league: 'bih.1', name: 'Bosnian Premier League' },
  { sport: 'soccer', league: 'mkd.1', name: 'Macedonian First League' },
  { sport: 'soccer', league: 'alb.1', name: 'Albanian Superliga' },
  // ── Second divisions (popular) ──
  { sport: 'soccer', league: 'eng.2', name: 'Championship' },
  { sport: 'soccer', league: 'ger.2', name: '2. Bundesliga' },
  { sport: 'soccer', league: 'ita.2', name: 'Serie B' },
  { sport: 'soccer', league: 'esp.2', name: 'La Liga 2' },
  { sport: 'soccer', league: 'fra.2', name: 'Ligue 2' },
  // ── Domestic cups ──
  { sport: 'soccer', league: 'eng.fa', name: 'FA Cup' },
  { sport: 'soccer', league: 'eng.league_cup', name: 'EFL Cup' },
  { sport: 'soccer', league: 'ger.dfb_pokal', name: 'DFB-Pokal' },
  { sport: 'soccer', league: 'ita.coppa_italia', name: 'Coppa Italia' },
  { sport: 'soccer', league: 'esp.copa_del_rey', name: 'Copa del Rey' },
  { sport: 'soccer', league: 'fra.coupe_de_france', name: 'Coupe de France' },
  { sport: 'soccer', league: 'por.cup', name: 'Taça de Portugal' },
  { sport: 'soccer', league: 'ned.cup', name: 'KNVB Beker' },
  { sport: 'soccer', league: 'bel.cup', name: 'Belgian Cup' },
  { sport: 'soccer', league: 'tur.cup', name: 'Turkish Cup' },
  { sport: 'soccer', league: 'nor.cup', name: 'Norwegian Cup' },
  { sport: 'soccer', league: 'pol.cup', name: 'Polish Cup' },
  { sport: 'soccer', league: 'sco.fa', name: 'Scottish Cup' },
  { sport: 'soccer', league: 'sco.league_cup', name: 'Scottish League Cup' },
  // ── International / National Teams ──
  { sport: 'soccer', league: 'fifa.friendly', name: 'International Friendly' },
  { sport: 'soccer', league: 'club.friendly', name: 'Club Friendly' },
  { sport: 'soccer', league: 'fifa.world', name: 'FIFA World Cup' },
  { sport: 'soccer', league: 'fifa.worldq.uefa', name: 'WCQ UEFA' },
  { sport: 'soccer', league: 'fifa.worldq.conmebol', name: 'WCQ CONMEBOL' },
  { sport: 'soccer', league: 'fifa.worldq.concacaf', name: 'WCQ CONCACAF' },
  { sport: 'soccer', league: 'fifa.worldq.afc', name: 'WCQ AFC' },
  { sport: 'soccer', league: 'fifa.worldq.caf', name: 'WCQ CAF' },
  { sport: 'soccer', league: 'fifa.worldq.ofc', name: 'WCQ OFC' },
  { sport: 'soccer', league: 'uefa.euro', name: 'Euro Championship' },
  { sport: 'soccer', league: 'uefa.euroq', name: 'Euro Qualifying' },
  { sport: 'soccer', league: 'conmebol.america', name: 'Copa America' },
  { sport: 'soccer', league: 'concacaf.gold', name: 'Gold Cup' },
  { sport: 'soccer', league: 'concacaf.nations.league', name: 'CONCACAF Nations League' },
  { sport: 'soccer', league: 'caf.nations', name: 'Africa Cup of Nations' },
  { sport: 'soccer', league: 'fifa.olympics', name: 'Olympic Football' },
  { sport: 'soccer', league: 'fifa.cwc', name: 'Club World Cup' },
  // ── South America (top leagues) ──
  { sport: 'soccer', league: 'bra.1', name: 'Brasileirao Serie A' },
  { sport: 'soccer', league: 'arg.1', name: 'Argentine Primera' },
  { sport: 'soccer', league: 'conmebol.libertadores', name: 'Copa Libertadores' },
  { sport: 'soccer', league: 'conmebol.sudamericana', name: 'Copa Sudamericana' },
  // ── North America ──
  { sport: 'soccer', league: 'usa.1', name: 'MLS' },
  { sport: 'soccer', league: 'mex.1', name: 'Liga MX' },
  { sport: 'soccer', league: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
];

export type LeagueConfig = { sport: string; league: string; name: string };

// Legacy alias — sync still uses this name internally
export const SYNC_SOCCER_LEAGUES: LeagueConfig[] = ALL_EUROPEAN_SOCCER_LEAGUES;

// Active leagues cache: which leagues have matches today
// Keyed by YYYY-MM-DD, refreshed once per hour
const _activeTodayCache: {
  date: string;
  checkedAt: number;
  leagues: LeagueConfig[];
} = { date: '', checkedAt: 0, leagues: [] };

/**
 * Smart league filter: returns only leagues that have ≥1 match today.
 * Checks ESPN scoreboard once per hour, caches result for the rest of the day.
 * This means adding 40 leagues costs nothing if they have no matches today.
 */
export async function getActiveTodayLeagues(): Promise<LeagueConfig[]> {
  const today = new Date().toISOString().slice(0, 10);
  const hourMs = 60 * 60 * 1000;
  const now = Date.now();

  // Return cache if same day and checked within last hour
  if (
    _activeTodayCache.date === today &&
    now - _activeTodayCache.checkedAt < hourMs &&
    _activeTodayCache.leagues.length > 0
  ) {
    return _activeTodayCache.leagues;
  }

  // ESPN date format: YYYYMMDD. Use a 7-day range so leagues with only upcoming
  // matches (next week) are also detected as active.
  const todayStr = today.replace(/-/g, '');
  const weekLaterStr = new Date(now + 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, '');
  const dateRange = `${todayStr}-${weekLaterStr}`;

  const active: LeagueConfig[] = [];

  // Check all leagues in parallel — single range query per league (3× fewer requests)
  const results = await Promise.allSettled(
    ALL_EUROPEAN_SOCCER_LEAGUES.map(async (cfg) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard?dates=${dateRange}&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'LivePick-PWA/1.0' },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return (json?.events?.length || 0) > 0 ? cfg : null;
      } catch {
        return null;
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) {
      active.push(r.value);
    }
  }

  // Always include top 5 + continental as fallback (they always have something)
  const alwaysInclude = ['eng.1', 'ger.1', 'ita.1', 'esp.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'tur.cup', 'nor.cup'];
  for (const cfg of ALL_EUROPEAN_SOCCER_LEAGUES) {
    if (alwaysInclude.includes(cfg.league) && !active.find(a => a.league === cfg.league)) {
      active.push(cfg);
    }
  }

  _activeTodayCache.date = today;
  _activeTodayCache.checkedAt = now;
  _activeTodayCache.leagues = active;

  console.log(`[ESPN] Active leagues today (${today}): ${active.map(l => l.name).join(', ')}`);
  return active;
}

// Reverse map: league display name → ESPN league code (comprehensive)
export const LEAGUE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  ALL_SOCCER_LEAGUES.map(l => [l.name, l.code])
);

// ============================================
// FETCH HELPERS
// ============================================

async function fetchWithRetryRaw(url: string, retries = 2, timeoutMs = 8000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LivePick-PWA/1.0' },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}

async function espnFetch(path: string, retriesPerHost = 2, timeoutMs = 8000): Promise<any> {
  let lastErr: any = null;
  for (const base of BASE_URLS) {
    const url = `${base}${path}`;
    try {
      const json = await fetchWithRetryRaw(url, retriesPerHost, timeoutMs);
      return json;
    } catch (err) {
      lastErr = err;
      // Only log 403/404/400 at debug level - expected when teams don't compete in certain leagues
      // Avoids spamming logs while still helping with real connectivity issues
      if (err instanceof Error && (err.message.includes('HTTP 400') || err.message.includes('HTTP 403') || err.message.includes('HTTP 404'))) {
        // Silent fail for 400/403/404 - will fall back to SofaScore or DB
      } else {
        console.warn(`[ESPN API] Host ${base} failed for ${path}:`, err instanceof Error ? err.message : err);
      }
      continue;
    }
  }
  throw lastErr;
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
    const pathBase = `/${sport}/${league}/scoreboard`;
    const path = date ? `${pathBase}?dates=${date}` : pathBase;
    console.log(`📡 Fetching ${league} matches from ESPN${date ? ` for ${date}` : ''}...`);

    let data: any;
    try {
      data = await espnFetch(path);
    } catch (err) {
      console.error(`Error fetching ${league}:`, err instanceof Error ? err.message : err);
      return [];
    }

    const events = data.events || data.items || [];
    if (!events || events.length === 0) {
      console.warn(`No events found for ${league}`);
      return [];
    }

    return events.map((event: any) => parseESPNMatch(event));
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
  // Smart league selection: only try relevant leagues to avoid Vercel timeouts
  // Step 1: Primary league (specified or top domestic leagues)
  // Step 2: UEFA competitions (teams may play in CL/EL/ECL)
  const uefaComps = ['uefa.champions', 'uefa.europa', 'uefa.europa.conf'];
  // Extended domestic list — includes Scottish, Turkish, Belgian, Greek etc.
  // so Celtic, Rangers, Galatasaray etc. get their domestic form correctly
  const topDomestic = [
    'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', // Top 5
    'ned.1', 'por.1',                              // Netherlands, Portugal
    'sco.1',                                       // Scottish Premiership (Celtic, Rangers)
    'bel.1',                                       // Belgian Pro League (Club Brugge, Anderlecht)
    'tur.1',                                       // Turkish Süper Lig (Galatasaray, Fenerbahçe)
    'gre.1',                                       // Greek Super League (Olympiacos, PAOK)
    'ukr.1',                                       // Ukrainian Premier League (Shakhtar, Dynamo)
    'cze.1',                                       // Czech First League (Sparta Prague, Slavia Prague)
    'aut.1',                                       // Austrian Bundesliga (Salzburg, Sturm Graz)
    'sui.1',                                       // Swiss Super League (Young Boys, Basel)
    'swe.1',                                       // Allsvenskan
    'den.1',                                       // Danish Superliga
    'nor.1',                                       // Norwegian Eliteserien
    'srb.1',                                       // Serbian SuperLiga (Red Star Belgrade)
    'hrv.1',                                       // Croatian First League (Dinamo Zagreb)
    'pol.1',                                       // Polish Ekstraklasa (Legia Warsaw, Lech Poznań)
    'rou.1',                                       // Romanian Liga 1 (FCSB, CFR Cluj)
    'svn.1',                                       // Slovenian PrvaLiga (Maribor, Olimpija)
    'bul.1',                                       // Bulgarian First League (Ludogorets, CSKA Sofia)
    'fin.1',                                       // Finnish Veikkausliiga (HJK Helsinki)
    'isl.1',                                       // Icelandic Besta deild
    'bih.1',                                       // Bosnian Premier League
    'mkd.1',                                       // Macedonian First League
    'alb.1',                                       // Albanian Superliga
  ];

  let leaguesToTry: string[];
  if (league) {
    // Try specified league + UEFA competitions only (max ~4 requests)
    leaguesToTry = [league, ...uefaComps.filter(c => c !== league)];
  } else {
    // No league specified: try top domestic + UEFA (max ~10 requests)
    leaguesToTry = [...topDomestic, ...uefaComps];
  }

  const fetchLeagueSchedule = async (leagueCode: string): Promise<ESPNMatch[]> => {
    const path = `/soccer/${leagueCode}/teams/${teamId}/schedule`;
    let data: any;
    try {
      // Use reduced retries (1) since 404s for wrong leagues are expected
      data = await espnFetch(path, 1);
    } catch (err) {
      return [];
    }
    if (!data?.events?.length) return [];
    return data.events
      .filter((e: any) => e.competitions?.[0]?.status?.type?.completed === true)
      .map((e: any) => {
        try {
          const match = parseESPNMatch(e);
          (match as any).__league_config = { sport: 'soccer', league: leagueCode, name: getLeagueName(leagueCode) };
          return match;
        } catch { return null; }
      })
      .filter(Boolean) as ESPNMatch[];
  };

  // Phase 1: Try domestic leagues first. Once a hit is found, skip remaining domestic leagues
  // (a team only plays in one domestic league — no need to try the rest)
  const domesticLeagues = leaguesToTry.filter(l => !uefaComps.includes(l));
  const continentalLeagues = leaguesToTry.filter(l => uefaComps.includes(l));

  const allMatches: ESPNMatch[] = [];
  const seen = new Set<string>();
  let domesticFound = false;
  let domesticTriedCount = 0;

  // Try domestic leagues sequentially — stop at first hit to avoid unnecessary 400 errors
  for (const lg of domesticLeagues) {
    domesticTriedCount++;
    const matches = await fetchLeagueSchedule(lg);
    if (matches.length > 0) {
      for (const m of matches) {
        if (!seen.has(m.id)) { seen.add(m.id); allMatches.push(m); }
      }
      domesticFound = true;
      break; // Team found in this league — skip all other domestic leagues
    }
  }

  // Phase 2: Always try continental competitions in parallel (teams can play in multiple)
  if (continentalLeagues.length > 0) {
    const contResults = await Promise.allSettled(continentalLeagues.map(fetchLeagueSchedule));
    for (const r of contResults) {
      if (r.status === 'fulfilled') {
        for (const m of r.value) {
          if (!seen.has(m.id)) { seen.add(m.id); allMatches.push(m); }
        }
      }
    }
  }

  allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const triedCount = domesticTriedCount + continentalLeagues.length;
  console.log(`[ESPN] Team ${teamId} schedule: ${allMatches.length} completed matches (tried ${triedCount} leagues${domesticFound ? ', domestic found early' : ''})`);
  // Warn if no domestic league found — team ID may be invalid or not in tracked leagues
  if (!domesticFound && !league) {
    console.warn(`[ESPN] Team ${teamId}: no domestic league found — team may not exist in tracked leagues`);
  }
  return allMatches;
}

function getLeagueName(code: string): string {
  const entry = ALL_SOCCER_LEAGUES.find(l => l.code === code);
  return entry?.name || code;
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
    const path = `/${sport}/${league}/teams`;
    console.log(`📡 Fetching ${league} teams from ESPN...`);

    let data: any;
    try {
      data = await espnFetch(path);
    } catch (err) {
      console.error(`Error fetching ${league} teams:`, err instanceof Error ? err.message : err);
      return [];
    }

    const teamsArray = data.teams || (data.sports?.[0]?.leagues?.[0]?.teams) || data.items || [];
    if (!teamsArray || teamsArray.length === 0) {
      console.warn(`No teams found for ${league}`);
      return [];
    }

    return teamsArray.map((t: any) => {
      const team = t.team || t;
      const logos = team.logos || team.team?.logos || [];
      const logo = logos?.[0]?.href || logos?.[0]?.url || null;
      return {
        id: String(team.id || team.uid || team.teamId || team.team?.id),
        name: team.displayName || team.name || team.team?.displayName || 'Unknown',
        displayName: team.displayName || team.name || team.team?.displayName || 'Unknown',
        abbreviation: team.abbreviation || team.team?.abbreviation,
        logo,
        color: team.color || team.team?.color,
        alternateColor: team.alternateColor || team.team?.alternateColor,
        venueId: team.venue?.id || team.team?.venueId || null,
      } as ESPNTeam;
    });
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
  eventId: string,
  timeoutMs = 8000
): Promise<Record<string, any> | null> {
  try {
    const path = `/${sport}/${league}/summary?event=${eventId}`;
    try {
      // Use 1 retry when probing many leagues (caller passes short timeout)
      const data = await espnFetch(path, 1, timeoutMs);
      return data;
    } catch (err) {
      return null;
    }
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
): {
  home: Record<string, number>;
  away: Record<string, number>;
  homeHalfScore?: number;
  awayHalfScore?: number;
} {
  const result: {
    home: Record<string, number>;
    away: Record<string, number>;
    homeHalfScore?: number;
    awayHalfScore?: number;
  } = { home: {}, away: {} };

  // --- Full-match statistics from boxscore ---
  const teams = summary?.boxscore?.teams || [];
  for (const [idx, teamData] of teams.entries()) {
    const teamId = teamData.team?.id;
    const homeAway = teamData.homeAway;
    const isHome = homeTeamId ? String(teamId) === String(homeTeamId) : (homeAway === 'home' || idx === 0);
    const isAway = awayTeamId ? String(teamId) === String(awayTeamId) : (homeAway === 'away' || idx === 1);
    const target = isHome ? result.home : isAway ? result.away : null;
    if (!target) continue;
    for (const stat of teamData.statistics || []) {
      const val = parseFloat(stat.displayValue || stat.value) || 0;
      target[stat.name] = val;
    }
  }

  // --- Halftime scores from linescores ---
  // ESPN summary header.competitions[0].competitors[].linescores[]
  // Each linescore has { period: 1|2, value: number } — pick period 1 explicitly,
  // falling back to index 0 if there's no period field (older ESPN API format).
  const competitors: any[] = summary?.header?.competitions?.[0]?.competitors || [];
  for (const [idx, comp] of competitors.entries()) {
    const compId = comp.team?.id;
    const homeAway = comp.homeAway;
    // Use index fallback (idx 0 = home, idx 1 = away) when team IDs are not provided
    const isHome = homeTeamId ? String(compId) === String(homeTeamId) : (homeAway === 'home' || idx === 0);
    const isAway = awayTeamId ? String(compId) === String(awayTeamId) : (homeAway === 'away' || idx === 1);
    const linescores: any[] = comp.linescores || [];

    // Prefer the entry explicitly tagged for period 1; fall back to first entry
    const period1Entry = linescores.find((ls: any) => ls.period === 1 || ls.period === '1')
      ?? linescores[0];

    // parseFloat(0) = 0 which is a valid half-time score — use null only when absent
    const rawVal = period1Entry?.value ?? period1Entry?.displayValue;
    const halfScore = rawVal != null && rawVal !== '' ? parseFloat(String(rawVal)) : null;

    if (halfScore !== null && !isNaN(halfScore)) {
      if (isHome && !isAway) result.homeHalfScore = halfScore;
      if (isAway && !isHome) result.awayHalfScore = halfScore;
    }
  }

  // Fallback: if competitor linescores weren't available, try competition-level linescores
  // ESPN sometimes puts away/home period scores at summary.header.competitions[0].linescores
  if (result.homeHalfScore == null || result.awayHalfScore == null) {
    const compLevel: any[] = summary?.header?.competitions?.[0]?.linescores || [];
    if (compLevel.length >= 2) {
      // [0] = home team period 1, [1] = away team period 1 (varies by ESPN version)
      const h = parseFloat(String(compLevel[0]?.value ?? compLevel[0]?.displayValue ?? ''));
      const a = parseFloat(String(compLevel[1]?.value ?? compLevel[1]?.displayValue ?? ''));
      if (!isNaN(h) && result.homeHalfScore == null) result.homeHalfScore = h;
      if (!isNaN(a) && result.awayHalfScore == null) result.awayHalfScore = a;
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
    homeHalfScore: stats.homeHalfScore ?? match.homeHalfScore,
    awayHalfScore: stats.awayHalfScore ?? match.awayHalfScore,
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
      id: String(homeCompetitor.team?.id || homeCompetitor.team?.uid || homeCompetitor.id || 'unknown'),
      name: homeCompetitor.team?.displayName || homeCompetitor.team?.name || homeCompetitor.displayName || 'Unknown',
      displayName: homeCompetitor.team?.displayName || homeCompetitor.team?.name || homeCompetitor.displayName || 'Unknown',
      abbreviation: homeCompetitor.team?.abbreviation || homeCompetitor.team?.abbr,
      logo: homeCompetitor.team?.logo || homeCompetitor.team?.logos?.[0]?.href || homeCompetitor.team?.logos?.[0]?.url,
    },
    awayTeam: {
      id: String(awayCompetitor.team?.id || awayCompetitor.team?.uid || awayCompetitor.id || 'unknown'),
      name: awayCompetitor.team?.displayName || awayCompetitor.team?.name || awayCompetitor.displayName || 'Unknown',
      displayName: awayCompetitor.team?.displayName || awayCompetitor.team?.name || awayCompetitor.displayName || 'Unknown',
      abbreviation: awayCompetitor.team?.abbreviation || awayCompetitor.team?.abbr,
      logo: awayCompetitor.team?.logo || awayCompetitor.team?.logos?.[0]?.href || awayCompetitor.team?.logos?.[0]?.url,
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
