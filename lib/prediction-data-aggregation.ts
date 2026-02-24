/**
 * Prediction Data Aggregation
 * Consolidates all input data (form, H2H, stats, odds) for ML model
 */

import type { LiveMatch } from '@/lib/unified-api';
import type { MatchContext, TeamStatistics } from '@/lib/prediction-engine';

// ============================================
// TEAM STATISTICS CALCULATION
// ============================================

/**
 * Calculate team statistics from recent match history
 */
export async function calculateTeamStatistics(
  teamId: string,
  teamName: string,
  recentMatches: Array<{
    home_team_id?: string;
    away_team_id?: string;
    home_team?: { id: string };
    away_team?: { id: string };
    home_score: number;
    away_score: number;
    home_corners?: number;
    away_corners?: number;
    home_shots_on_target?: number;
    away_shots_on_target?: number;
    home_possession?: number;
    away_possession?: number;
    home_yellow_cards?: number;
    away_yellow_cards?: number;
  }>,
  isHomeTeam?: boolean
): Promise<TeamStatistics> {
  if (!recentMatches || recentMatches.length === 0) {
    // Return default stats if no data
    return {
      teamId,
      teamName,
      matchesAnalyzed: 0,
      avgGoalsScored: 1.5,
      avgGoalsConceded: 1.2,
      avgCorners: 5.5,
      avgShotsOnTarget: 3.5,
      avgPossession: 50,
      avgYellowCards: 2.0,
      cleanSheetPercentage: 35,
      recentForm: 50,
      homeAdvantage: 1.15,
    };
  }

  let goalsFor = 0, goalsAgainst = 0, totalCorners = 0, totalShots = 0;
  let totalPossession = 0, totalYellows = 0, cleanSheets = 0;
  let cornersMatchCount = 0, shotsMatchCount = 0, possessionMatchCount = 0, cardsMatchCount = 0;
  let bttsCount = 0;
  const recentFormScores: number[] = [];

  recentMatches.forEach((match, idx) => {
    const isTeamHome = String(match.home_team_id || match.home_team?.id) === String(teamId);
    const teamGoals = isTeamHome ? match.home_score : match.away_score;
    const oppGoals = isTeamHome ? match.away_score : match.home_score;

    goalsFor += teamGoals;
    goalsAgainst += oppGoals;

    // BTTS tracking
    if (teamGoals > 0 && oppGoals > 0) bttsCount++;

    // Corners (only count matches where data is available)
    const teamCorners = isTeamHome ? match.home_corners : match.away_corners;
    if (teamCorners && teamCorners > 0) {
      totalCorners += teamCorners;
      cornersMatchCount++;
    }

    // Shots on target
    const teamShots = isTeamHome ? match.home_shots_on_target : match.away_shots_on_target;
    if (teamShots && teamShots > 0) {
      totalShots += teamShots;
      shotsMatchCount++;
    }

    // Possession
    const teamPoss = isTeamHome ? match.home_possession : match.away_possession;
    if (teamPoss && teamPoss > 0) {
      totalPossession += teamPoss;
      possessionMatchCount++;
    }

    // Yellow cards
    const teamCards = isTeamHome ? match.home_yellow_cards : match.away_yellow_cards;
    if (teamCards && teamCards > 0) {
      totalYellows += teamCards;
      cardsMatchCount++;
    }

    // Clean sheet
    if (oppGoals === 0) {
      cleanSheets++;
    }

    // Form score (3 pts for win, 1 for draw, 0 for loss, weighted by recency)
    // idx=0 is most recent (sorted desc by date), so give it highest weight
    const recencyWeight = 1 + (recentMatches.length - 1 - idx) * 0.15;
    let formScore = 0;
    if (teamGoals > oppGoals) {
      formScore = 3 * recencyWeight;
    } else if (teamGoals === oppGoals) {
      formScore = 1 * recencyWeight;
    }
    recentFormScores.push(formScore);
  });

  const matchCount = recentMatches.length;
  const recentFormAvg = recentFormScores.length > 0
    ? (recentFormScores.reduce((a, b) => a + b, 0) / recentFormScores.length)
    : 50;

  // Derive corners estimate from goals when no corner data available
  // Empirical: teams averaging more goals tend to have more corners (~4.5 + goalsScored * 0.7)
  const avgGoalsScored = Math.round((goalsFor / matchCount) * 100) / 100;
  const avgGoalsConceded = Math.round((goalsAgainst / matchCount) * 100) / 100;
  const estimatedCorners = cornersMatchCount > 0
    ? Math.round((totalCorners / cornersMatchCount) * 10) / 10
    : Math.round((4.0 + avgGoalsScored * 0.8 + avgGoalsConceded * 0.3) * 10) / 10;

  // Derive cards estimate from goals/form when no card data available
  // More competitive matches (close scorelines) tend to have more cards
  const estimatedCards = cardsMatchCount > 0
    ? Math.round((totalYellows / cardsMatchCount) * 10) / 10
    : Math.round((1.5 + avgGoalsConceded * 0.3) * 10) / 10;

  return {
    teamId,
    teamName,
    matchesAnalyzed: matchCount,
    avgGoalsScored,
    avgGoalsConceded,
    avgCorners: estimatedCorners,
    avgShotsOnTarget: shotsMatchCount > 0 ? Math.round((totalShots / shotsMatchCount) * 10) / 10 : Math.round((2.5 + avgGoalsScored * 1.2) * 10) / 10,
    avgPossession: possessionMatchCount > 0 ? Math.round(totalPossession / possessionMatchCount) : 50,
    avgYellowCards: estimatedCards,
    cleanSheetPercentage: Math.round((cleanSheets / matchCount) * 100),
    recentForm: Math.round(Math.min(100, recentFormAvg * (100 / 3))), // Convert to 0-100 scale
    homeAdvantage: isHomeTeam ? 1.15 : 0.85, // Default multipliers
  };
}

/**
 * Aggregate H2H statistics
 * Supports both ESPN numeric IDs and TheSportsDB tsdb_* IDs.
 * When IDs don't match, falls back to name-based matching.
 */
export function aggregateH2HStats(
  matches: Array<{
    home_team_id?: string;
    away_team_id?: string;
    home_team_name?: string;
    away_team_name?: string;
    home_team?: { id: string };
    away_team?: { id: string };
    home_score: number;
    away_score: number;
    home_corners?: number;
    away_corners?: number;
  }>,
  homeTeamId: string,
  awayTeamId: string,
  homeTeamName?: string,
) {
  let homeWins = 0, awayWins = 0, draws = 0;
  let homeGoalsFor = 0, homeGoalsAgainst = 0;
  let totalCorners = 0;
  let bttsCount = 0;
  const homeNameFirst = (homeTeamName || '').toLowerCase().split(' ')[0];

  matches.forEach((match) => {
    const matchHomeId = String(match.home_team_id || match.home_team?.id || '');
    // Primary: ID match. Fallback: name match (for TheSportsDB tsdb_* IDs vs ESPN IDs)
    let isCurrentHomeTeamAtHome = matchHomeId === String(homeTeamId);
    if (!isCurrentHomeTeamAtHome && homeNameFirst && match.home_team_name) {
      isCurrentHomeTeamAtHome = match.home_team_name.toLowerCase().includes(homeNameFirst) ||
        homeNameFirst.includes(match.home_team_name.toLowerCase().split(' ')[0]);
    }
    const currentHomeScore = isCurrentHomeTeamAtHome ? match.home_score : match.away_score;
    const currentAwayScore = isCurrentHomeTeamAtHome ? match.away_score : match.home_score;

    homeGoalsFor += currentHomeScore;
    homeGoalsAgainst += currentAwayScore;

    if (currentHomeScore > currentAwayScore) {
      homeWins++;
    } else if (currentHomeScore < currentAwayScore) {
      awayWins++;
    } else {
      draws++;
    }

    // Both teams scored?
    if (currentHomeScore > 0 && currentAwayScore > 0) {
      bttsCount++;
    }

    // Corners
    if (match.home_corners && match.away_corners) {
      totalCorners += (match.home_corners + match.away_corners);
    }
  });

  const totalMatches = homeWins + awayWins + draws;

  return {
    homeWins,
    awayWins,
    draws,
    avgGoalsHome: totalMatches > 0 ? Math.round((homeGoalsFor / totalMatches) * 100) / 100 : 1.5,
    avgGoalsAway: totalMatches > 0 ? Math.round((homeGoalsAgainst / totalMatches) * 100) / 100 : 1.2,
    bttsFrequency: totalMatches > 0 ? bttsCount / totalMatches : 0.5,
    cornersAverage: totalMatches > 0 ? Math.round((totalCorners / totalMatches) * 10) / 10 : 8.5,
    totalMatches,
  };
}

// ============================================
// IMPLIED ODDS PARSING
// ============================================

/**
 * Extract implied probabilities from odds
 */
export function extractImpliedOdds(
  odds?: Array<{
    bookmaker?: string;
    bets?: Array<{
      id?: number;
      name?: string;
      values?: Array<{ value?: string; odd?: number }>;
    }>;
  }>
) {
  if (!odds || !Array.isArray(odds) || odds.length === 0) {
    // Return neutral probabilities if no odds available
    return {
      over0_5: 0.85,
      over1_5: 0.65,
      over2_5: 0.50,
      bttsYes: 0.55,
      bttsNo: 0.45,
    };
  }

  const impliedProbs: Record<string, number> = {};

  // Find bookmaker with most markets
  const bestBookmaker = odds.reduce((prev, curr) => {
    const currMarkets = (curr.bets || []).length;
    const prevMarkets = (prev.bets || []).length;
    return currMarkets > prevMarkets ? curr : prev;
  });

  if (!bestBookmaker.bets) {
    return {
      over0_5: 0.85,
      over1_5: 0.65,
      over2_5: 0.50,
      bttsYes: 0.55,
      bttsNo: 0.45,
    };
  }

  // Extract odds for each market
  bestBookmaker.bets.forEach((bet) => {
    const betName = (bet.name || '').toLowerCase();

    if (betName.includes('over/under')) {
      bet.values?.forEach((val) => {
        const valStr = (val.value || '').toLowerCase();
        if (valStr.includes('over 0.5') && val.odd != null) impliedProbs['over0_5'] = val.odd;
        if (valStr.includes('over 1.5') && val.odd != null) impliedProbs['over1_5'] = val.odd;
        if (valStr.includes('over 2.5') && val.odd != null) impliedProbs['over2_5'] = val.odd;
      });
    }

    if (betName.includes('btts') || betName.includes('both teams')) {
      bet.values?.forEach((val) => {
        const valStr = (val.value || '').toLowerCase();
        if (valStr.includes('yes') && val.odd != null) impliedProbs['btts_yes'] = val.odd;
        if (valStr.includes('no') && val.odd != null) impliedProbs['btts_no'] = val.odd;
      });
    }
  });

  // Convert odds to probabilities: P = 1 / odds
  const result = {
    over0_5: impliedProbs['over0_5'] ? Math.min(0.99, 1 / impliedProbs['over0_5']) : 0.85,
    over1_5: impliedProbs['over1_5'] ? 1 / impliedProbs['over1_5'] : 0.65,
    over2_5: impliedProbs['over2_5'] ? 1 / impliedProbs['over2_5'] : 0.50,
    bttsYes: impliedProbs['btts_yes'] ? 1 / impliedProbs['btts_yes'] : 0.55,
    bttsNo: impliedProbs['btts_no'] ? 1 / impliedProbs['btts_no'] : 0.45,
  };

  return result;
}

// ============================================
// FULL CONTEXT AGGREGATION
// ============================================

/**
 * Aggregate all data needed for predictions
 * Called before running ML model
 */
export async function aggregateMatchContext(
  match: LiveMatch,
  homeFormData: Array<any>,
  awayFormData: Array<any>,
  h2hData: Array<any>,
  oddsData?: any
): Promise<MatchContext> {
  // Calculate team statistics from form data
  const homeStats = await calculateTeamStatistics(
    String(match.teams?.home?.id || ''),
    match.teams?.home?.name || 'Home',
    homeFormData,
    true
  );

  const awayStats = await calculateTeamStatistics(
    String(match.teams?.away?.id || ''),
    match.teams?.away?.name || 'Away',
    awayFormData,
    false
  );

  // Aggregate H2H stats — pass team name for cross-API (TheSportsDB) name matching
  const h2hStats = aggregateH2HStats(
    h2hData,
    String(match.teams?.home?.id || ''),
    String(match.teams?.away?.id || ''),
    match.teams?.home?.name || ''
  );

  // Extract implied odds from whatever source is available
  // Try API-Football format first, then ESPN odds, then defaults
  let impliedOdds;
  if (oddsData?.odds) {
    impliedOdds = extractImpliedOdds(oddsData.odds);
  } else {
    // No odds data available - use form-based estimates instead of hardcoded defaults
    const avgGoals = (homeStats.avgGoalsScored + awayStats.avgGoalsConceded + awayStats.avgGoalsScored + homeStats.avgGoalsConceded) / 2;
    impliedOdds = {
      over0_5: Math.min(0.95, 0.7 + avgGoals * 0.05),
      over1_5: Math.min(0.85, 0.4 + avgGoals * 0.1),
      over2_5: Math.min(0.75, 0.2 + avgGoals * 0.1),
      bttsYes: Math.min(0.7, 0.3 + (1 - homeStats.cleanSheetPercentage / 100) * 0.2 + (1 - awayStats.cleanSheetPercentage / 100) * 0.2),
      bttsNo: 0.5,
    };
    impliedOdds.bttsNo = 1 - impliedOdds.bttsYes;
  }

  // Determine match importance
  let matchImportance: 'league' | 'cup' | 'relegation' | 'title' = 'league';
  if (match.league?.name?.toLowerCase().includes('cup')) {
    matchImportance = 'cup';
  }

  return {
    homeTeam: homeStats,
    awayTeam: awayStats,
    h2hStats,
    impliedOdds: {
      over0_5: impliedOdds.over0_5,
      over1_5: impliedOdds.over1_5,
      over2_5: impliedOdds.over2_5,
      bttsYes: impliedOdds.bttsYes,
      bttsNo: impliedOdds.bttsNo,
    },
    matchContext: {
      isHomeTeamHome: true,
      matchImportance,
      refereeStrictness: 'normal',
    },
  };
}

/**
 * Validate context has sufficient data
 */
export function validateContextQuality(context: MatchContext): {
  isValid: boolean;
  quality: 'high' | 'medium' | 'low';
  warnings: string[];
} {
  const warnings: string[] = [];

  if (context.homeTeam.matchesAnalyzed < 3) {
    warnings.push(`Home team has only ${context.homeTeam.matchesAnalyzed} recent matches`);
  }

  if (context.awayTeam.matchesAnalyzed < 3) {
    warnings.push(`Away team has only ${context.awayTeam.matchesAnalyzed} recent matches`);
  }

  if (context.h2hStats.totalMatches < 2) {
    warnings.push('Limited H2H history between teams');
  }

  let quality: 'high' | 'medium' | 'low' = 'high';
  if (context.homeTeam.matchesAnalyzed < 3 || context.awayTeam.matchesAnalyzed < 3) {
    quality = 'low';
  } else if (context.h2hStats.totalMatches < 3) {
    quality = 'medium';
  }

  return {
    isValid: warnings.length <= 2, // Allow up to 2 warnings
    quality,
    warnings,
  };
}
