// ============================================
// FILTER ENGINE
// ============================================
// Engine that verifies whether matches satisfy filters
// Handles BOTH basic format ({min, max}) and extended format ({home: {min}, total: {min}, after, between})

import type { LiveMatch } from '@/lib/types';
import type { Filter } from '@/lib/supabase';
import {
  matchesRange,
  matchesTime,
  matchesTeamCondition,
  type RangeCondition,
  type TeamSpecificCondition,
  type TimeCondition,
} from '@/lib/extended-filters';

/**
 * Extract parsed stats directly from ESPN match.statistics array
 */
function extractStatsFromMatch(match: LiveMatch): ReturnType<typeof parseMatchStatsCompat> | null {
  return parseMatchStatsCompat(match.statistics);
}

function parseMatchStatsCompat(statistics: any[] | undefined) {
  if (!statistics || statistics.length === 0) return null;

  const getNum = (teamStats: any, type: string): number => {
    if (!teamStats?.statistics) return 0;
    const stat = teamStats.statistics.find((s: any) =>
      s.type?.toLowerCase() === type.toLowerCase() ||
      s.type?.toLowerCase().includes(type.toLowerCase())
    );
    if (!stat) return 0;
    const val = stat.value;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0;
    return 0;
  };

  const home = statistics[0];
  const away = statistics[1];

  return {
    corners: {
      home: getNum(home, 'corners'),
      away: getNum(away, 'corners'),
      total: getNum(home, 'corners') + getNum(away, 'corners'),
    },
    shots_on_target: {
      home: getNum(home, 'shots on goal'),
      away: getNum(away, 'shots on goal'),
      total: getNum(home, 'shots on goal') + getNum(away, 'shots on goal'),
    },
    shots_off_target: {
      home: getNum(home, 'shots off goal'),
      away: getNum(away, 'shots off goal'),
    },
    total_shots: {
      home: getNum(home, 'total shots'),
      away: getNum(away, 'total shots'),
    },
    attacks: {
      home: getNum(home, 'attacks'),
      away: getNum(away, 'attacks'),
      total: getNum(home, 'attacks') + getNum(away, 'attacks'),
    },
    dangerous_attacks: {
      home: getNum(home, 'dangerous attacks'),
      away: getNum(away, 'dangerous attacks'),
      total: getNum(home, 'dangerous attacks') + getNum(away, 'dangerous attacks'),
    },
    possession: {
      home: getNum(home, 'possession'),
      away: getNum(away, 'possession'),
    },
    yellow_cards: {
      home: getNum(home, 'yellow card'),
      away: getNum(away, 'yellow card'),
      total: getNum(home, 'yellow card') + getNum(away, 'yellow card'),
    },
    red_cards: {
      home: getNum(home, 'red card'),
      away: getNum(away, 'red card'),
      total: getNum(home, 'red card') + getNum(away, 'red card'),
    },
    fouls: {
      home: getNum(home, 'fouls'),
      away: getNum(away, 'fouls'),
    },
  };
}

// ============================================
// TYPES
// ============================================

export interface FilterMatchResult {
  matches: boolean;
  filter: Filter;
  match: LiveMatch;
  matchedConditions: string[];
  failedConditions: string[];
}

// ============================================
// FORMAT DETECTION HELPERS
// ============================================

/** Check if a condition object uses extended TeamSpecific format ({home, away, total}) */
function isTeamSpecific(cond: any): boolean {
  if (!cond || typeof cond !== 'object') return false;
  // Extended format has nested objects with min/max inside home/away/total
  return (
    (cond.home && typeof cond.home === 'object') ||
    (cond.away && typeof cond.away === 'object') ||
    (cond.total && typeof cond.total === 'object')
  );
}

/** Check if a match_time condition uses extended TimeCondition format ({after, before, between}) */
function isExtendedTime(cond: any): boolean {
  if (!cond || typeof cond !== 'object') return false;
  return cond.after !== undefined || cond.before !== undefined || cond.between !== undefined || cond.exact !== undefined;
}

// ============================================
// STAT EVALUATION (handles both formats)
// ============================================

/**
 * Evaluate a stat condition in either basic or extended format.
 * Basic format:    { min, max, team? }
 * Extended format: { home: {min,max}, away: {min,max}, total: {min,max} }
 */
function evaluateStat(
  homeValue: number,
  awayValue: number,
  condition: any,
  label: string,
  matchedConditions: string[],
  failedConditions: string[]
): void {
  const totalValue = homeValue + awayValue;

  if (isTeamSpecific(condition)) {
    // Extended format
    if (matchesTeamCondition(homeValue, awayValue, condition as TeamSpecificCondition)) {
      matchedConditions.push(`${label}: H${homeValue} A${awayValue} T${totalValue}`);
    } else {
      failedConditions.push(`${label}: H${homeValue} A${awayValue} T${totalValue} - not met`);
    }
  } else {
    // Basic format: { min, max, team? }
    const { min, max, team = 'total' } = condition;
    let value = totalValue;
    if (team === 'home') value = homeValue;
    else if (team === 'away') value = awayValue;

    const minOk = min === undefined || value >= min;
    const maxOk = max === undefined || value <= max;

    if (minOk && maxOk) {
      matchedConditions.push(`${label}: ${value} (${team})`);
    } else {
      failedConditions.push(`${label}: ${value} not in range ${min ?? 0}-${max ?? '∞'} (${team})`);
    }
  }
}

// ============================================
// MAIN FILTER FUNCTION
// ============================================

export async function matchesFilter(
  match: LiveMatch,
  filter: Filter,
  stats?: any
): Promise<FilterMatchResult> {

  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];

  if (!filter.is_active) {
    return { matches: false, filter, match, matchedConditions: [], failedConditions: ['Filter is not active'] };
  }

  // Cast to any since conditions can be either basic FilterConditions or ExtendedFilterConditions
  const conditions = filter.conditions as any;

  if (!conditions || Object.keys(conditions).length === 0) {
    return { matches: false, filter, match, matchedConditions: [], failedConditions: ['No conditions defined'] };
  }

  // ============================================
  // 1. MATCH TIME (check first - early exit if time doesn't match)
  // ============================================
  if (conditions.match_time) {
    const currentMinute = match.fixture.status.elapsed || 0;
    const mt = conditions.match_time;

    if (isExtendedTime(mt)) {
      // Extended format: { after, before, between, exact }
      if (matchesTime(currentMinute, mt as TimeCondition)) {
        matchedConditions.push(`Time: ${currentMinute}'`);
      } else {
        const desc = mt.after !== undefined ? `after ${mt.after}'` :
                     mt.before !== undefined ? `before ${mt.before}'` :
                     mt.between ? `between ${mt.between[0]}'-${mt.between[1]}'` :
                     mt.exact !== undefined ? `at ${mt.exact}'` : 'condition';
        failedConditions.push(`Time: ${currentMinute}' not ${desc}`);
        return { matches: false, filter, match, matchedConditions, failedConditions };
      }
    } else {
      // Basic format: { min, max }
      const { min, max } = mt;
      const minOk = min === undefined || currentMinute >= min;
      const maxOk = max === undefined || currentMinute <= max;

      if (minOk && maxOk) {
        matchedConditions.push(`Time: ${currentMinute}' (${min || 0}'-${max || 90}')`);
      } else {
        failedConditions.push(`Time: ${currentMinute}' not in range ${min || 0}'-${max || 90}'`);
        return { matches: false, filter, match, matchedConditions, failedConditions };
      }
    }
  }

  // ============================================
  // 2. EXTRACT STATS
  // ============================================
  if (!stats) {
    stats = extractStatsFromMatch(match);
  }

  if (!stats) {
    failedConditions.push('Match statistics not available yet');
    return { matches: false, filter, match, matchedConditions, failedConditions };
  }

  // ============================================
  // 3. CORNERS
  // ============================================
  if (conditions.corners) {
    evaluateStat(stats.corners.home, stats.corners.away, conditions.corners, 'Corners', matchedConditions, failedConditions);
  }

  // ============================================
  // 4. SHOTS ON TARGET
  // ============================================
  if (conditions.shots_on_target) {
    evaluateStat(stats.shots_on_target.home, stats.shots_on_target.away, conditions.shots_on_target, 'Shots on target', matchedConditions, failedConditions);
  }

  // ============================================
  // 5. SHOTS OFF TARGET
  // ============================================
  if (conditions.shots_off_target) {
    evaluateStat(stats.shots_off_target.home, stats.shots_off_target.away, conditions.shots_off_target, 'Shots off target', matchedConditions, failedConditions);
  }

  // ============================================
  // 6. TOTAL SHOTS / SHOTS (handle both keys)
  // ============================================
  if (conditions.total_shots) {
    evaluateStat(stats.total_shots.home, stats.total_shots.away, conditions.total_shots, 'Total shots', matchedConditions, failedConditions);
  }
  if (conditions.shots && !conditions.total_shots) {
    evaluateStat(stats.total_shots.home, stats.total_shots.away, conditions.shots, 'Shots', matchedConditions, failedConditions);
  }

  // ============================================
  // 7. YELLOW CARDS
  // ============================================
  if (conditions.yellow_cards) {
    evaluateStat(stats.yellow_cards.home, stats.yellow_cards.away, conditions.yellow_cards, 'Yellow cards', matchedConditions, failedConditions);
  }

  // ============================================
  // 8. RED CARDS
  // ============================================
  if (conditions.red_cards) {
    evaluateStat(stats.red_cards.home, stats.red_cards.away, conditions.red_cards, 'Red cards', matchedConditions, failedConditions);
  }

  // ============================================
  // 9. POSSESSION (both basic and extended)
  // ============================================
  if (conditions.possession) {
    const poss = conditions.possession;
    const homePoss = stats.possession.home;
    const awayPoss = stats.possession.away;

    if (poss.home || poss.away || poss.dominant) {
      // Extended format: { home: {min,max}, away: {min,max}, dominant }
      let passed = true;

      if (poss.home && !matchesRange(homePoss, poss.home as RangeCondition)) {
        failedConditions.push(`Possession home: ${homePoss}% not met`);
        passed = false;
      }
      if (poss.away && !matchesRange(awayPoss, poss.away as RangeCondition)) {
        failedConditions.push(`Possession away: ${awayPoss}% not met`);
        passed = false;
      }
      if (poss.dominant) {
        const diff = Math.abs(homePoss - awayPoss);
        if (poss.dominant === 'balanced' && diff > 10) {
          failedConditions.push(`Possession: not balanced (diff ${diff}%)`);
          passed = false;
        }
        if (poss.dominant === 'home' && homePoss <= awayPoss) {
          failedConditions.push(`Possession: home not dominant (${homePoss}% vs ${awayPoss}%)`);
          passed = false;
        }
        if (poss.dominant === 'away' && awayPoss <= homePoss) {
          failedConditions.push(`Possession: away not dominant (${awayPoss}% vs ${homePoss}%)`);
          passed = false;
        }
      }
      if (passed) {
        matchedConditions.push(`Possession: H${homePoss}% A${awayPoss}%`);
      }
    } else {
      // Basic format: { min, max }
      const { min, max } = poss;
      const avgPossession = (homePoss + awayPoss) / 2;
      const minOk = min === undefined || avgPossession >= min;
      const maxOk = max === undefined || avgPossession <= max;

      if (minOk && maxOk) {
        matchedConditions.push(`Possession: ${avgPossession.toFixed(1)}%`);
      } else {
        failedConditions.push(`Possession: ${avgPossession.toFixed(1)}% not in range ${min}-${max ?? '∞'}%`);
      }
    }
  }

  // ============================================
  // 10. ATTACKS
  // ============================================
  if (conditions.attacks && stats.attacks) {
    // Soft-skip: if data source doesn't provide attacks (both = 0), don't fail the filter
    if (stats.attacks.home > 0 || stats.attacks.away > 0) {
      evaluateStat(stats.attacks.home, stats.attacks.away, conditions.attacks, 'Attacks', matchedConditions, failedConditions);
    }
    // else: skip silently — data source (ESPN) doesn't track Attacks
  }

  // ============================================
  // 11. DANGEROUS ATTACKS
  // ============================================
  if (conditions.dangerous_attacks && stats.dangerous_attacks) {
    // Soft-skip: ESPN doesn't provide Dangerous Attacks — if both values are 0, treat as unavailable
    if (stats.dangerous_attacks.home > 0 || stats.dangerous_attacks.away > 0) {
      evaluateStat(stats.dangerous_attacks.home, stats.dangerous_attacks.away, conditions.dangerous_attacks, 'Dangerous attacks', matchedConditions, failedConditions);
    }
    // else: skip silently — DA not available from this data source
  }

  // ============================================
  // 12. SCORE CONDITIONS (extended)
  // ============================================
  if (conditions.score) {
    const homeGoals = match.goals?.home ?? 0;
    const awayGoals = match.goals?.away ?? 0;
    const score = conditions.score;
    let passed = true;

    if (score.exact) {
      if (homeGoals !== score.exact.home || awayGoals !== score.exact.away) {
        failedConditions.push(`Score: ${homeGoals}-${awayGoals} not ${score.exact.home}-${score.exact.away}`);
        passed = false;
      }
    }
    if (score.home && !matchesRange(homeGoals, score.home)) {
      failedConditions.push(`Home goals: ${homeGoals} not met`);
      passed = false;
    }
    if (score.away && !matchesRange(awayGoals, score.away)) {
      failedConditions.push(`Away goals: ${awayGoals} not met`);
      passed = false;
    }
    if (score.total_goals && !matchesRange(homeGoals + awayGoals, score.total_goals)) {
      failedConditions.push(`Total goals: ${homeGoals + awayGoals} not met`);
      passed = false;
    }
    if (score.difference) {
      const diff = Math.abs(homeGoals - awayGoals);
      if (!matchesRange(diff, score.difference)) {
        failedConditions.push(`Goal difference: ${diff} not met`);
        passed = false;
      }
    }
    if (passed) {
      matchedConditions.push(`Score: ${homeGoals}-${awayGoals}`);
    }
  }

  // ============================================
  // 13. FOULS
  // ============================================
  if (conditions.fouls && stats.fouls) {
    evaluateStat(stats.fouls.home, stats.fouls.away, conditions.fouls, 'Fouls', matchedConditions, failedConditions);
  }

  // ============================================
  // 14. PRE-MATCH ODDS (market-specific)
  // ============================================
  if (conditions.pre_match_odds) {
    const matchOdds = match.odds as any;
    if (!matchOdds) {
      failedConditions.push('Pre-match odds: no odds data available');
    } else {
      let passed = true;
      for (const [market, range] of Object.entries(conditions.pre_match_odds)) {
        if (!range) continue;
        const oddsValue = matchOdds[market];
        if (oddsValue === undefined || oddsValue === null) continue;
        if (!matchesRange(oddsValue, range as RangeCondition)) {
          failedConditions.push(`Odds ${market}: ${oddsValue} not in range`);
          passed = false;
        }
      }
      if (passed) {
        matchedConditions.push('Pre-match odds: met');
      }
    }
  }

  // ============================================
  // 15. LEGACY ODDS (goal_line, match_goals)
  // ============================================
  if (conditions.goal_line) {
    const { type, value } = conditions.goal_line;
    const odds = match.odds as any;
    if (odds) {
      const oddsKey = `goals_${type}_${value}`;
      const oddsValue = odds[oddsKey];
      if (oddsValue) {
        matchedConditions.push(`Goal Line ${type.toUpperCase()} ${value}: Odds ${oddsValue.toFixed(2)}`);
      } else {
        failedConditions.push(`Goal Line ${type.toUpperCase()} ${value}: Odds not available`);
      }
    } else {
      failedConditions.push(`Goal Line ${type.toUpperCase()} ${value}: No odds data`);
    }
  }

  if (conditions.match_goals) {
    const { type, value } = conditions.match_goals;
    const odds = match.odds as any;
    if (odds) {
      const oddsKey = `goals_${type}_${value}`;
      const oddsValue = odds[oddsKey];
      if (oddsValue) {
        matchedConditions.push(`Match Goals ${type.toUpperCase()} ${value}: Odds available (${oddsValue.toFixed(2)})`);
      } else {
        failedConditions.push(`Match Goals ${type.toUpperCase()} ${value}: Odds not available`);
      }
    }
  }

  // ============================================
  // 16. TRENDS (cannot evaluate without historical snapshots - log as info)
  // Trends are informational only - they don't cause match/fail
  // ============================================

  // Match only if at least one condition matched AND zero failed
  const matches = matchedConditions.length > 0 && failedConditions.length === 0;

  return { matches, filter, match, matchedConditions, failedConditions };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function applyFiltersToMatch(
  match: LiveMatch,
  filters: Filter[]
): Promise<FilterMatchResult[]> {

  const results: FilterMatchResult[] = [];
  const activeFilters = filters.filter(f => f.is_active);

  if (activeFilters.length === 0) return results;

  if (!match || !match.fixture || !match.fixture.id) {
    console.warn('filter-engine: Skipping match without fixture.id', match);
    return results;
  }

  const stats = extractStatsFromMatch(match);

  for (const filter of activeFilters) {
    const result = await matchesFilter(match, filter, stats);
    if (result.matches) {
      results.push(result);
    }
  }

  return results;
}

export async function applyFiltersToMatches(
  matches: LiveMatch[],
  filters: Filter[]
): Promise<Map<number, FilterMatchResult[]>> {

  const resultsMap = new Map<number, FilterMatchResult[]>();

  for (const match of matches) {
    if (!match || !match.fixture || !match.fixture.id) {
      console.warn('filter-engine: Skipping invalid match in batch', match);
      continue;
    }

    const matchResults = await applyFiltersToMatch(match, filters);
    if (matchResults.length > 0) {
      resultsMap.set(match.fixture.id, matchResults);
    }
  }

  return resultsMap;
}

export async function evaluateFilterGroup(
  match: LiveMatch,
  filter: Filter,
  allFilters: Filter[]
): Promise<boolean> {
  const result = await matchesFilter(match, filter);
  return result.matches;
}

export async function applyFiltersToMatchesWithGroups(
  matches: LiveMatch[],
  filters: Filter[]
): Promise<Map<number, FilterMatchResult[]>> {
  const resultsMap = new Map<number, FilterMatchResult[]>();

  for (const match of matches) {
    const matchResults: FilterMatchResult[] = [];

    for (const filter of filters) {
      const result = await matchesFilter(match, filter);
      if (result.matches) {
        matchResults.push(result);
      }
    }

    if (matchResults.length > 0) {
      resultsMap.set(match.fixture.id, matchResults);
    }
  }

  return resultsMap;
}

const filterEngine = {
  matchesFilter,
  applyFiltersToMatch,
  applyFiltersToMatches,
  evaluateFilterGroup,
  applyFiltersToMatchesWithGroups,
};

export default filterEngine;
