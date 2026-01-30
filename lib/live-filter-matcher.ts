/**
 * Live Filter Matching Engine
 * Calculates which filters match current live match stats
 * Includes team history analysis for predictability scoring
 */

import { Filter, FilterConditions } from '@/lib/supabase';
import { LiveMatch } from '@/lib/api-football';

export interface FilterMatchDetails {
  filter: Filter;
  isMatching: boolean;
  matchedConditions: string[];
  failedConditions: string[];
  confidence: number; // 0-100
  teamHistoryFactor: number; // How likely based on team history
  reasoning: string;
}

/**
 * Check which filters match a live match
 */
export function getMatchingFiltersForMatch(
  match: LiveMatch,
  filters: Filter[],
  teamHistoryData?: TeamHistoryData
): FilterMatchDetails[] {
  return filters
    .filter(f => f.is_active && f.notification_enabled)
    .map(filter => evaluateFilterForMatch(match, filter, teamHistoryData))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detailed filter evaluation for a single match
 */
export function evaluateFilterForMatch(
  match: LiveMatch,
  filter: Filter,
  teamHistoryData?: TeamHistoryData
): FilterMatchDetails {
  const conditions = filter.conditions as FilterConditions;
  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];
  let conditionScore = 0;
  let totalConditions = 0;

  // Extract stats from match
  const stats = extractMatchStats(match);

  // Evaluate each condition type
  if (conditions.goals) {
    totalConditions++;
    const goalsValue = conditions.goals.team === 'away' ? stats.awayGoals : stats.homeGoals;
    const goalsTotal = stats.homeGoals + stats.awayGoals;

    if (isInRange(goalsValue, conditions.goals.min, conditions.goals.max)) {
      matchedConditions.push(`Goals (${goalsValue})`);
      conditionScore++;
    } else {
      failedConditions.push(`Goals: expected ${conditions.goals.min}-${conditions.goals.max}, got ${goalsValue}`);
    }
  }

  if (conditions.corners) {
    totalConditions++;
    const cornersValue = conditions.corners.team === 'away' ? stats.awayCorners : stats.homeCorners;
    const cornersTotal = stats.homeCorners + stats.awayCorners;

    if (isInRange(cornersValue, conditions.corners.min, conditions.corners.max)) {
      matchedConditions.push(`Corners (${cornersValue})`);
      conditionScore++;
    } else {
      failedConditions.push(`Corners: expected ${conditions.corners.min}-${conditions.corners.max}, got ${cornersValue}`);
    }
  }

  if (conditions.shots_on_target) {
    totalConditions++;
    const shotsValue = stats.homeShots + stats.awayShots;

    if (isInRange(shotsValue, conditions.shots_on_target.min, conditions.shots_on_target.max)) {
      matchedConditions.push(`Shots on Target (${shotsValue})`);
      conditionScore++;
    } else {
      failedConditions.push(`Shots: expected ${conditions.shots_on_target.min}-${conditions.shots_on_target.max}, got ${shotsValue}`);
    }
  }

  if (conditions.yellow_cards) {
    totalConditions++;
    const cardsValue = stats.homeYellowCards + stats.awayYellowCards;

    if (isInRange(cardsValue, conditions.yellow_cards.min, conditions.yellow_cards.max)) {
      matchedConditions.push(`Yellow Cards (${cardsValue})`);
      conditionScore++;
    } else {
      failedConditions.push(`Yellow Cards: expected ${conditions.yellow_cards.min}-${conditions.yellow_cards.max}, got ${cardsValue}`);
    }
  }

  if (conditions.red_cards) {
    totalConditions++;
    const redCardsValue = stats.homeRedCards + stats.awayRedCards;

    if (isInRange(redCardsValue, conditions.red_cards.min, conditions.red_cards.max)) {
      matchedConditions.push(`Red Cards (${redCardsValue})`);
      conditionScore++;
    } else {
      failedConditions.push(`Red Cards: expected ${conditions.red_cards.min}-${conditions.red_cards.max}, got ${redCardsValue}`);
    }
  }

  // Calculate base confidence (condition matching)
  const baseConfidence = totalConditions > 0 ? (conditionScore / totalConditions) * 100 : 0;

  // Get team history factor
  const historyFactor = getTeamHistoryFactor(match, teamHistoryData);

  // Combined confidence
  const confidence = Math.round(baseConfidence * 0.7 + historyFactor * 0.3);

  const isMatching = conditionScore === totalConditions && totalConditions > 0;

  return {
    filter,
    isMatching,
    matchedConditions,
    failedConditions,
    confidence,
    teamHistoryFactor: historyFactor,
    reasoning: generateReasoning(filter.name, matchedConditions, failedConditions, isMatching),
  };
}

/**
 * Extract stats from live match data
 */
function extractMatchStats(match: LiveMatch) {
  const stats = match.statistics || [];
  const homeStats = stats.find(s => s.team?.id === match.teams?.home?.id);
  const awayStats = stats.find(s => s.team?.id === match.teams?.away?.id);

  const findStat = (statsObj: any, type: string) => {
    if (!statsObj?.statistics) return 0;
    return statsObj.statistics.find((s: any) => s.type === type)?.value || 0;
  };

  return {
    homeGoals: match.goals?.home || 0,
    awayGoals: match.goals?.away || 0,
    homeCorners: findStat(homeStats, 'Corner Kicks'),
    awayCorners: findStat(awayStats, 'Corner Kicks'),
    homeShots: findStat(homeStats, 'Shots on Goal'),
    awayShots: findStat(awayStats, 'Shots on Goal'),
    homePossession: findStat(homeStats, 'Possession'),
    awayPossession: findStat(awayStats, 'Possession'),
    homeYellowCards: findStat(homeStats, 'Yellow Cards'),
    awayYellowCards: findStat(awayStats, 'Yellow Cards'),
    homeRedCards: findStat(homeStats, 'Red Cards'),
    awayRedCards: findStat(awayStats, 'Red Cards'),
    homeFouls: findStat(homeStats, 'Fouls Committed'),
    awayFouls: findStat(awayStats, 'Fouls Committed'),
  };
}

/**
 * Check if value is in range (handles optional min/max)
 */
function isInRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Team history data interface
 */
export interface TeamHistoryData {
  [teamId: string]: {
    avgGoals: number;
    avgCorners: number;
    avgShots: number;
    avgCards: number;
    recentForm: number; // 0-100, wins percentage
    homeAwayFactor: number; // 1.2 if home team scores more at home, etc.
  };
}

/**
 * Calculate team history factor (0-100)
 * Higher when match conditions align with team history
 */
function getTeamHistoryFactor(match: LiveMatch, data?: TeamHistoryData): number {
  if (!data) return 50; // Default neutral

  const homeHistory = data[match.teams?.home?.id!];
  const awayHistory = data[match.teams?.away?.id!];

  if (!homeHistory || !awayHistory) return 50;

  const stats = extractMatchStats(match);

  // Score based on how much actual stats match expected averages
  let score = 50; // Start neutral

  // Home team tendency check
  if (stats.homeGoals > stats.awayGoals && homeHistory.avgGoals > awayHistory.avgGoals) {
    score += 15;
  }

  // Shots check
  if ((stats.homeShots + stats.awayShots) > 15) {
    score += 10;
  }

  // Cards check
  if ((stats.homeYellowCards + stats.awayYellowCards) > 2) {
    score += 10;
  }

  // Recent form check
  score += Math.min(homeHistory.recentForm * 0.1, 10);

  return Math.min(score, 100);
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  filterName: string,
  matched: string[],
  failed: string[],
  isMatching: boolean
): string {
  if (isMatching) {
    return `"${filterName}" matches! All conditions met: ${matched.join(', ')}`;
  }

  if (matched.length > 0) {
    return `"${filterName}" partially matches (${matched.join(', ')}). Missing: ${failed.join(', ')}`;
  }

  return `"${filterName}" doesn't match yet. Waiting for: ${failed.join(', ')}`;
}

/**
 * Calculate predictability for entire match
 * Returns confidence that conditions will be met by end of match
 */
export function calculateMatchPredictability(
  match: LiveMatch,
  matchFilters: FilterMatchDetails[]
): number {
  if (matchFilters.length === 0) return 0;

  const matchingCount = matchFilters.filter(m => m.isMatching).length;
  const avgConfidence = matchFilters.reduce((sum, m) => sum + m.confidence, 0) / matchFilters.length;

  // Higher confidence if some are already matching
  const matchingBonus = (matchingCount / matchFilters.length) * 30;

  return Math.round(avgConfidence * 0.7 + matchingBonus);
}
