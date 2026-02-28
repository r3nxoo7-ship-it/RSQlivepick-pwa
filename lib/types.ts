/**
 * ============================================
 * UNIFIED TYPES FOR LIVEPICK FOOTBALL MATCHER
 * ============================================
 * Centralized type definitions for all football data structures
 * Used by both API-Football and Football-Data providers
 */

import { MatchOdds } from '@/lib/odds-provider';

/**
 * Represents a single live football match
 * Normalized format used across all API providers
 */
export interface LiveMatch {
  // Optional ID for de-duplication
  id?: number;

  // Fixture information (match details)
  fixture: {
    id: number;              // Unique match ID
    date: string;            // ISO 8601 datetime (e.g., "2025-01-03T19:00:00+00:00")
    timestamp: number;       // Unix timestamp (seconds)
    status: {
      long: string;          // Full status (e.g., "First Half", "Second Half", "Match Finished")
      short: string;         // Short status (e.g., "1H", "2H", "FT")
      elapsed: number | null; // Current minute in match (null if not started)
    };
  };

  // Competition/league information
  league: {
    id: number;
    name: string;            // League name (e.g., "Premier League")
    country: string;         // Country name
    logo: string;            // URL to league logo
    flag: string;            // URL to country flag
    season?: number;         // Season year (e.g., 2024)
  };

  // Teams participating
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };

  // Current goals
  goals: {
    home: number | null;     // Home team goals (null if not started)
    away: number | null;     // Away team goals
  };

  // Score at different stages of the match
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime?: {
      home: number | null;
      away: number | null;
    };
    penalty?: {
      home: number | null;
      away: number | null;
    };
  };

  // Optional: detailed statistics
  statistics?: MatchStatistics[];

  // Optional: SofaScore live stats (enriched by background scanner)
  // Contains metrics not available from ESPN: xG, big chances, shots in box, pass accuracy
  sofascore_stats?: {
    sofascoreEventId: number;
    homeXg: number;
    awayXg: number;
    homeBigChances: number;
    awayBigChances: number;
    homeShotsInBox: number;
    awayShotsInBox: number;
    homePassPct: number;     // pass accuracy %
    awayPassPct: number;
    homeInterceptions: number;
    awayInterceptions: number;
    homeClearances: number;
    awayClearances: number;
    homeFouls: number;       // fouls from SofaScore (more reliable than ESPN)
    awayFouls: number;
    // Additional SofaScore stats for complete coverage
    homeShotsOff?: number;   // shots off target
    awayShotsOff?: number;
    homeGoalsPrevented?: number;
    awayGoalsPrevented?: number;
    homeShotsOnTarget?: number;
    awayShotsOnTarget?: number;
    homeTotalShots?: number;
    awayTotalShots?: number;
    homeCorners?: number;
    awayCorners?: number;
    homePossession?: number;
    awayPossession?: number;
    homeOffsides?: number;
    awayOffsides?: number;
    homeYellowCards?: number;
    awayYellowCards?: number;
    homeRedCards?: number;
    awayRedCards?: number;
    fetchedAt: number;       // Unix ms — for cache staleness check
  };

  // Optional: odds/betting information
  odds?: MatchOdds['bookmakers'];
}

/**
 * Detailed match statistics (per team)
 * Contains metrics like corners, shots, possession, etc.
 */
export interface MatchStatistics {
  team: {
    id: number;
    name: string;            // "Arena" or "Chelsea"
  };
  statistics: Array<{
    type: string;            // Type of statistic (e.g., "Corners", "Shots on Goal", "Ball Possession")
    value: number | string | null; // Value (e.g., 8, "58%", "12.5")
  }>;
}

/**
 * Response wrapper for API calls
 */
export interface ApiResponse<T> {
  get: string;
  parameters: any;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

/**
 * Filter match result
 * Returned when evaluating if a match matches a filter's conditions
 */
export interface FilterMatchResult {
  matched: boolean;
  matchedConditions: string[];
  failedConditions: string[];
  score: number; // 0-100 confidence score
}

/**
 * Filter match details - extended info for batch evaluation
 */
export interface FilterMatchDetails extends FilterMatchResult {
  filterId: string;
  filterName: string;
  predictability: number; // Match predictability score
  teamHistoryContext?: {
    homeTeamAverage: number;
    awayTeamAverage: number;
  };
}
