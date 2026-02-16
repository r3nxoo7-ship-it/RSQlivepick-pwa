// ============================================
// DATA SOURCE REGISTRY & FALLBACK SYSTEM
// ============================================
// Provides a structured way to fetch match data from
// multiple sources with automatic fallback, per-league
// failure tracking, and comprehensive logging.
//
// ESPN is the primary source (priority 0).
// Apify is the first fallback (priority 10).
// New sources can be registered with any priority.

import * as ESPNAPI from './espn-api';

// ============================================
// CONFIGURATION
// ============================================

const FALLBACK_ENABLED = process.env.FALLBACK_SOURCES_ENABLED !== 'false'; // enabled by default
const APIFY_ENABLED = process.env.FALLBACK_APIFY_ENABLED === 'true';
const APIFY_DATASET_ID = process.env.NEXT_PUBLIC_APIFY_DATASET_ID;
const APIFY_API_KEY = process.env.APIFY_API_KEY;
const FAILURE_THRESHOLD = parseInt(process.env.FALLBACK_FAILURE_THRESHOLD || '3', 10);
const LOG_LEVEL = (process.env.FALLBACK_LOG_LEVEL || 'info') as LogLevel;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// ============================================
// STRUCTURED LOGGING
// ============================================

function sourceLog(
  level: LogLevel,
  source: string,
  message: string,
  meta?: Record<string, any>
) {
  if (LOG_LEVELS[level] < LOG_LEVELS[LOG_LEVEL]) return;

  const prefix = `[DataSource:${source}]`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  const logFn = level === 'debug' ? console.log : console[level];
  logFn(`${prefix} ${message}${metaStr}`);
}

// ============================================
// TYPES
// ============================================

export interface SourceStats {
  totalRequests: number;
  successes: number;
  failures: number;
  lastSuccess: number | null;
  lastFailure: number | null;
  avgLatencyMs: number;
  leagueFailures: Record<string, number>;
}

export interface DataSource {
  /** Display name for logging and diagnostics */
  name: string;
  /** Lower number = higher priority. ESPN=0, Apify=10. */
  priority: number;
  /** Whether this source is currently enabled */
  enabled: boolean;
  /** Fetch matches for a league, optionally for a specific date (YYYYMMDD) */
  fetchMatches(sport: string, league: string, date?: string): Promise<ESPNAPI.ESPNMatch[]>;
  /** Optional: fetch teams for a league */
  fetchTeams?(sport: string, league: string): Promise<ESPNAPI.ESPNTeam[]>;
  /** Health check - returns ok status and latency */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

export interface FetchResult {
  matches: ESPNAPI.ESPNMatch[];
  source: string;
}

// ============================================
// ESPN SOURCE
// ============================================

class ESPNSource implements DataSource {
  name = 'ESPN';
  priority = 0;
  enabled = true;

  async fetchMatches(sport: string, league: string, date?: string): Promise<ESPNAPI.ESPNMatch[]> {
    return ESPNAPI.getLeagueMatches(sport, league, date);
  }

  async fetchTeams(sport: string, league: string): Promise<ESPNAPI.ESPNTeam[]> {
    return ESPNAPI.getLeagueTeams(sport, league);
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      // Quick check: fetch Premier League scoreboard
      const matches = await ESPNAPI.getLeagueMatches('soccer', 'eng.1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}

// ============================================
// APIFY SOURCE
// ============================================

class ApifySource implements DataSource {
  name = 'Apify';
  priority = 10;
  enabled = APIFY_ENABLED && !!APIFY_DATASET_ID && !!APIFY_API_KEY;

  async fetchMatches(_sport: string, _league?: string, _date?: string): Promise<ESPNAPI.ESPNMatch[]> {
    if (!this.enabled || !APIFY_DATASET_ID || !APIFY_API_KEY) {
      return [];
    }

    const url = `https://api.apify.com/v2/datasets/${APIFY_DATASET_ID}/items?token=${APIFY_API_KEY}&clean=true`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LivePick-PWA/1.0' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const items = await response.json();
    return (items || [])
      .map((item: any) => mapApifyItemToESPNMatch(item))
      .filter(Boolean) as ESPNAPI.ESPNMatch[];
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    if (!this.enabled) return { ok: false, latencyMs: 0 };

    const start = Date.now();
    try {
      const url = `https://api.apify.com/v2/datasets/${APIFY_DATASET_ID}?token=${APIFY_API_KEY}`;
      const response = await fetch(url, { cache: 'no-store' });
      return { ok: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}

// ============================================
// APIFY MAPPING HELPERS
// ============================================

function mapApifyItemToESPNMatch(item: any): ESPNAPI.ESPNMatch | null {
  try {
    if (!item.id || !item.homeTeam || !item.awayTeam) {
      return null;
    }

    const homeTeam = item.homeTeam;
    const awayTeam = item.awayTeam;

    return {
      id: item.id,
      eventId: item.eventId || item.id,
      date: item.date || new Date().toISOString(),
      status: normalizeApifyStatus(item.status),
      homeTeam: {
        id: String(homeTeam.id || homeTeam.name || 'unknown'),
        name: homeTeam.displayName || homeTeam.name || 'Unknown',
        displayName: homeTeam.displayName || homeTeam.name || 'Unknown',
        abbreviation: homeTeam.abbreviation,
        logo: homeTeam.logo,
        color: homeTeam.color,
        alternateColor: homeTeam.alternateColor,
        venueId: homeTeam.venueId,
      },
      awayTeam: {
        id: String(awayTeam.id || awayTeam.name || 'unknown'),
        name: awayTeam.displayName || awayTeam.name || 'Unknown',
        displayName: awayTeam.displayName || awayTeam.name || 'Unknown',
        abbreviation: awayTeam.abbreviation,
        logo: awayTeam.logo,
        color: awayTeam.color,
        alternateColor: awayTeam.alternateColor,
        venueId: awayTeam.venueId,
      },
      homeScore: item.homeScore || item.home_score || 0,
      awayScore: item.awayScore || item.away_score || 0,
      homeGoals: item.homeGoals || item.home_goals,
      awayGoals: item.awayGoals || item.away_goals,
      homeCorners: item.homeCorners || item.home_corners,
      awayCorners: item.awayCorners || item.away_corners,
      homeShotsOnTarget: item.homeShotsOnTarget || item.home_shots_on_target,
      awayShotsOnTarget: item.awayShotsOnTarget || item.away_shots_on_target,
      homePossession: item.homePossession || item.home_possession,
      awayPossession: item.awayPossession || item.away_possession,
      homeYellowCards: item.homeYellowCards || item.home_yellow_cards,
      awayYellowCards: item.awayYellowCards || item.away_yellow_cards,
      homeRedCards: item.homeRedCards || item.home_red_cards,
      awayRedCards: item.awayRedCards || item.away_red_cards,
      homeFouls: item.homeFouls || item.home_fouls,
      awayFouls: item.awayFouls || item.away_fouls,
      homeOffsides: item.homeOffsides || item.home_offsides,
      awayOffsides: item.awayOffsides || item.away_offsides,
      period: item.period,
      minute: item.minute,
      venue: item.venue ? {
        id: item.venue.id || 'unknown',
        name: item.venue.name,
        city: item.venue.city,
      } : undefined,
      broadcast: item.broadcast,
      odds: item.odds,
    };
  } catch (err) {
    sourceLog('warn', 'Apify', 'Failed to map item', { error: String(err) });
    return null;
  }
}

function normalizeApifyStatus(status: any): 'scheduled' | 'in_progress' | 'completed' {
  if (!status) return 'scheduled';
  const s = String(status).toLowerCase();
  if (s.includes('scheduled') || s.includes('pre')) return 'scheduled';
  if (s.includes('live') || s.includes('in_progress') || s.includes('in')) return 'in_progress';
  if (s.includes('completed') || s.includes('finished') || s.includes('post') || s.includes('full_time')) return 'completed';
  return 'scheduled';
}

// ============================================
// DATA SOURCE REGISTRY
// ============================================

class DataSourceRegistry {
  private sources: DataSource[] = [];
  private stats: Map<string, SourceStats> = new Map();

  register(source: DataSource): void {
    this.sources.push(source);
    // Keep sorted by priority (lower = higher priority)
    this.sources.sort((a, b) => a.priority - b.priority);

    // Initialize stats
    if (!this.stats.has(source.name)) {
      this.stats.set(source.name, {
        totalRequests: 0,
        successes: 0,
        failures: 0,
        lastSuccess: null,
        lastFailure: null,
        avgLatencyMs: 0,
        leagueFailures: {},
      });
    }

    sourceLog('info', 'Registry', `Registered source: ${source.name} (priority=${source.priority}, enabled=${source.enabled})`);
  }

  getOrderedSources(): DataSource[] {
    return this.sources.filter(s => s.enabled);
  }

  /**
   * Fetch matches using the fallback chain.
   * Tries each source in priority order. If the primary source fails for a
   * league beyond the failure threshold, it automatically falls back to
   * the next source.
   */
  async fetchWithFallback(
    sport: string,
    league: string,
    date?: string,
    context?: string
  ): Promise<FetchResult> {
    const enabledSources = this.getOrderedSources();

    if (enabledSources.length === 0) {
      sourceLog('error', 'Registry', 'No enabled data sources available');
      return { matches: [], source: 'none' };
    }

    for (const source of enabledSources) {
      const stats = this.stats.get(source.name)!;
      const leagueKey = `${league}${date ? `@${date}` : ''}`;

      // Skip sources that have exceeded failure threshold for this league
      const leagueFailCount = stats.leagueFailures[league] || 0;
      if (leagueFailCount >= FAILURE_THRESHOLD && enabledSources.length > 1) {
        sourceLog('warn', source.name, `Skipping for ${league} (${leagueFailCount} consecutive failures)`, { context });
        continue;
      }

      const start = Date.now();
      stats.totalRequests++;

      try {
        sourceLog('debug', source.name, `Fetching ${league}`, { date, context });

        const matches = await source.fetchMatches(sport, league, date);
        const latency = Date.now() - start;

        // Update stats
        stats.successes++;
        stats.lastSuccess = Date.now();
        stats.avgLatencyMs = Math.round((stats.avgLatencyMs * (stats.successes - 1) + latency) / stats.successes);
        // Reset league failure count on success
        stats.leagueFailures[league] = 0;

        sourceLog('debug', source.name, `${league}: ${matches.length} matches`, { latencyMs: latency, context });

        return { matches, source: source.name };
      } catch (error) {
        const latency = Date.now() - start;
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Update failure stats
        stats.failures++;
        stats.lastFailure = Date.now();
        stats.leagueFailures[league] = (stats.leagueFailures[league] || 0) + 1;

        sourceLog('warn', source.name, `${league} failed`, {
          error: errorMsg,
          latencyMs: latency,
          consecutiveFailures: stats.leagueFailures[league],
          context,
        });

        // Continue to next source in fallback chain
        if (FALLBACK_ENABLED) {
          continue;
        } else {
          // Fallback disabled - don't try other sources
          return { matches: [], source: source.name };
        }
      }
    }

    // All sources exhausted
    sourceLog('error', 'Registry', `All sources failed for ${league}`, { date, context });
    return { matches: [], source: 'none' };
  }

  /**
   * Reset failure counts for a specific source and league.
   * Useful when external signals indicate a source has recovered.
   */
  resetLeagueFailures(sourceName: string, league?: string): void {
    const stats = this.stats.get(sourceName);
    if (!stats) return;

    if (league) {
      stats.leagueFailures[league] = 0;
    } else {
      stats.leagueFailures = {};
    }
    sourceLog('info', 'Registry', `Reset failures for ${sourceName}${league ? `:${league}` : ' (all leagues)'}`);
  }

  getStats(): Record<string, SourceStats> {
    const result: Record<string, SourceStats> = {};
    for (const [name, stats] of this.stats) {
      result[name] = { ...stats, leagueFailures: { ...stats.leagueFailures } };
    }
    return result;
  }

  /**
   * Get a summary string for logging/diagnostics.
   */
  getStatusSummary(): string {
    const parts: string[] = [];
    for (const [name, stats] of this.stats) {
      const source = this.sources.find(s => s.name === name);
      const enabled = source?.enabled ?? false;
      const failedLeagues = Object.entries(stats.leagueFailures)
        .filter(([_, count]) => count >= FAILURE_THRESHOLD)
        .map(([league]) => league);

      parts.push(
        `${name}(enabled=${enabled}, ok=${stats.successes}/${stats.totalRequests}, avg=${stats.avgLatencyMs}ms` +
        (failedLeagues.length > 0 ? `, degraded=[${failedLeagues.join(',')}]` : '') +
        ')'
      );
    }
    return parts.join(' | ');
  }
}

// ============================================
// SINGLETON REGISTRY (module-level)
// ============================================

export const registry = new DataSourceRegistry();

// Register ESPN (always enabled, primary)
registry.register(new ESPNSource());

// Register Apify (only if configured)
registry.register(new ApifySource());

// ============================================
// CONVENIENCE EXPORTS (for backwards compat)
// ============================================

/** @deprecated Use registry.getStats() instead */
export const fallbackStats = {
  get apifyFetches() { return registry.getStats()['Apify']?.totalRequests ?? 0; },
  get apifySuccess() { return registry.getStats()['Apify']?.successes ?? 0; },
  get apifyFailures() { return registry.getStats()['Apify']?.failures ?? 0; },
};

/** @deprecated Use registry.fetchWithFallback() instead */
export async function getMatchesFromApify(league?: string): Promise<ESPNAPI.ESPNMatch[]> {
  const apify = registry.getOrderedSources().find(s => s.name === 'Apify');
  if (!apify) return [];
  try {
    return await apify.fetchMatches('soccer', league || 'all');
  } catch {
    return [];
  }
}

/** @deprecated Use registry.getOrderedSources().some(s => s.name === 'Apify' && s.enabled) */
export function isFallbackAvailable(): boolean {
  return registry.getOrderedSources().some(s => s.name === 'Apify' && s.enabled);
}

/** @deprecated Use registry.getStatusSummary() instead */
export function getFallbackStatus(): string {
  return registry.getStatusSummary();
}

export { FAILURE_THRESHOLD };
