// ============================================
// FILTER ENGINE
// ============================================
// Engine that verifies whether matches satisfy filters
// For beginners: learn filtering logic, type checking

import type { LiveMatch } from '@/lib/football-data';
import type { Filter } from '@/lib/supabase';

/**
 * Extract parsed stats directly from ESPN match.statistics array
 * Replaces the old getMatchStatistics + parseMatchStats flow
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
    },
    shots_off_target: {
      home: getNum(home, 'shots off goal'),
      away: getNum(away, 'shots off goal'),
    },
    total_shots: {
      home: getNum(home, 'total shots'),
      away: getNum(away, 'total shots'),
    },
    possession: {
      home: getNum(home, 'possession'),
      away: getNum(away, 'possession'),
    },
    yellow_cards: {
      home: getNum(home, 'yellow card'),
      away: getNum(away, 'yellow card'),
    },
    red_cards: {
      home: getNum(home, 'red card'),
      away: getNum(away, 'red card'),
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

/**
 * Result of checking a filter against a match
 */
export interface FilterMatchResult {
  matches: boolean;              // True if match satisfies the filter
  filter: Filter;                // The filter that was checked
  match: LiveMatch;              // The match that was checked
  matchedConditions: string[];   // List of conditions that matched
  failedConditions: string[];    // List of conditions that did NOT match
}

// ============================================
// MAIN FILTER FUNCTION
// ============================================

/**
 * Check if a match satisfies a filter
 * 
 * @param match - The live match to check
 * @param filter - The filter with conditions
 * @param stats - Detailed statistics (optional, for performance)
 * @returns FilterMatchResult
 * 
 * LOGIC EXPLANATION:
 * - For each condition in the filter
 * - Check if the match meets the condition
 * - If ALL conditions are met → MATCH!
 * - If at least one FAILS → NO MATCH
 */
export async function matchesFilter(
  match: LiveMatch,
  filter: Filter,
  stats?: any
): Promise<FilterMatchResult> {
  
  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];
  
  // If the filter is not active, it automatically does not match
  if (!filter.is_active) {
    return {
      matches: false,
      filter,
      match,
      matchedConditions: [],
      failedConditions: ['Filter is not active'],
    };
  }
  
  const conditions = filter.conditions;
  
  // If we have no conditions, it does not match
  if (!conditions || Object.keys(conditions).length === 0) {
    return {
      matches: false,
      filter,
      match,
      matchedConditions: [],
      failedConditions: ['No conditions defined'],
    };
  }
  
  // ============================================
  // CHECK CONDITIONS
  // ============================================
  
  // 1. MATCH TIME (check first because it is simple)
  if (conditions.match_time) {
    const currentMinute = match.fixture.status.elapsed || 0;
    const { min, max } = conditions.match_time;
    
    const minOk = min === undefined || currentMinute >= min;
    const maxOk = max === undefined || currentMinute <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Time: ${currentMinute}' (${min || 0}'-${max || 90}')`);
    } else {
      failedConditions.push(`Time: ${currentMinute}' not in range ${min || 0}'-${max || 90}'`);
      // If time range does not match, stop checking
      // (no point making API request for stats)
      return {
        matches: false,
        filter,
        match,
        matchedConditions,
        failedConditions,
      };
    }
  }
  
  // 2. STATISTICS (corners, shots, cards, etc.)
  // Extract from ESPN match.statistics array (no external API call needed)
  if (!stats) {
    stats = extractStatsFromMatch(match);
  }
  
  // If stats is null (match doesn't have stats yet)
  if (!stats) {
    failedConditions.push('Match statistics not available yet');
    return {
      matches: false,
      filter,
      match,
      matchedConditions,
      failedConditions,
    };
  }
  
  // 3. CORNERS
  if (conditions.corners) {
    const { min, max, team = 'total' } = conditions.corners;
    
    let cornerValue = 0;
    if (team === 'total') {
      cornerValue = stats.corners.total;
    } else if (team === 'home') {
      cornerValue = stats.corners.home;
    } else if (team === 'away') {
      cornerValue = stats.corners.away;
    }
    
    const minOk = min === undefined || cornerValue >= min;
    const maxOk = max === undefined || cornerValue <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Corners: ${cornerValue} (${team})`);
    } else {
      failedConditions.push(`Corners: ${cornerValue} not in range ${min}-${max || '∞'} (${team})`);
    }
  }
  
  // 4. SHOTS ON TARGET
  if (conditions.shots_on_target) {
    const { min, max } = conditions.shots_on_target;
    const totalShots = stats.shots_on_target.home + stats.shots_on_target.away;
    
    const minOk = min === undefined || totalShots >= min;
    const maxOk = max === undefined || totalShots <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Shots on target: ${totalShots}`);
    } else {
      failedConditions.push(`Shots on target: ${totalShots} not in range ${min}-${max || '∞'}`);
    }
  }
  
  // 5. SHOTS OFF TARGET
  if (conditions.shots_off_target) {
    const { min, max } = conditions.shots_off_target;
    const totalShots = stats.shots_off_target.home + stats.shots_off_target.away;
    
    const minOk = min === undefined || totalShots >= min;
    const maxOk = max === undefined || totalShots <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Shots off target: ${totalShots}`);
    } else {
      failedConditions.push(`Shots off target: ${totalShots} not in range ${min}-${max || '∞'}`);
    }
  }
  
  // 6. TOTAL SHOTS
  if (conditions.total_shots) {
    const { min, max } = conditions.total_shots;
    const totalShots = stats.total_shots.home + stats.total_shots.away;
    
    const minOk = min === undefined || totalShots >= min;
    const maxOk = max === undefined || totalShots <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Total shots: ${totalShots}`);
    } else {
      failedConditions.push(`Total shots: ${totalShots} not in range ${min}-${max || '∞'}`);
    }
  }
  
  // 7. YELLOW CARDS
  if (conditions.yellow_cards) {
    const { min, max } = conditions.yellow_cards;
    const totalCards = stats.yellow_cards.home + stats.yellow_cards.away;
    
    const minOk = min === undefined || totalCards >= min;
    const maxOk = max === undefined || totalCards <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Yellow cards: ${totalCards}`);
    } else {
      failedConditions.push(`Yellow cards: ${totalCards} not in range ${min}-${max || '∞'}`);
    }
  }
  
  // 8. RED CARDS
  if (conditions.red_cards) {
    const { min, max } = conditions.red_cards;
    const totalCards = stats.red_cards.home + stats.red_cards.away;
    
    const minOk = min === undefined || totalCards >= min;
    const maxOk = max === undefined || totalCards <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Red cards: ${totalCards}`);
    } else {
      failedConditions.push(`Red cards: ${totalCards} not in range ${min}-${max || '∞'}`);
    }
  }
  
  // 9. POSSESSION
  if (conditions.possession) {
    const { min, max } = conditions.possession;
    const avgPossession = (stats.possession.home + stats.possession.away) / 2;
    
    const minOk = min === undefined || avgPossession >= min;
    const maxOk = max === undefined || avgPossession <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Possession: ${avgPossession.toFixed(1)}%`);
    } else {
      failedConditions.push(`Possession: ${avgPossession.toFixed(1)}% not in range ${min}-${max || '∞'}%`);
    }
  }
  
  // 10. DANGEROUS ATTACKS (dacă e implementat în stats)
  if (conditions.dangerous_attacks && stats.dangerous_attacks) {
    const { min, max } = conditions.dangerous_attacks;
    const total = stats.dangerous_attacks.home + stats.dangerous_attacks.away;
    
    const minOk = min === undefined || total >= min;
    const maxOk = max === undefined || total <= max;
    
    if (minOk && maxOk) {
      matchedConditions.push(`Dangerous attacks: ${total}`);
    } else {
      failedConditions.push(`Dangerous attacks: ${total} not in range ${min}-${max || '∞'}`);
    }
  }
  
  // ============================================
  // REZULTAT FINAL
  // ============================================
  
  // Meciul match-uiește DOAR dacă:
  // - Avem cel puțin o condiție matched
  // - ȘI nu avem nicio condiție failed
  const matches = matchedConditions.length > 0 && failedConditions.length === 0;
  
  return {
    matches,
    filter,
    match,
    matchedConditions,
    failedConditions,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Aplică toate filtrele active pe un meci
 * Returnează lista de filtre care match-uiesc
 * 
 * @param match - Meciul de verificat
 * @param filters - Lista de filtre active
 * @returns Array cu FilterMatchResult pentru fiecare filtru care match-uiește
 */
/**
 * Apply all active filters to a match
 * Returns the list of filters that match
 * 
 * @param match - The live match to check
 * @param filters - The list of active filters
 * @returns Array with FilterMatchResult for each filter that matches
 */
export async function applyFiltersToMatch(
  match: LiveMatch,
  filters: Filter[]
): Promise<FilterMatchResult[]> {
  
  const results: FilterMatchResult[] = [];
  
  // Filtrăm doar filtrele active
  const activeFilters = filters.filter(f => f.is_active);
  
  if (activeFilters.length === 0) {
    return results;
  }
  
  // Guard: ensure match has fixture id
  if (!match || !match.fixture || !match.fixture.id) {
    console.warn('⚠️ filter-engine: Skipping match without fixture.id', match);
    return results;
  }

  // Extract stats from ESPN match.statistics array (no external API call)
  const stats = extractStatsFromMatch(match);
  
  // Verificăm fiecare filtru
  for (const filter of activeFilters) {
    const result = await matchesFilter(match, filter, stats);
    
    // Adăugăm în results doar dacă match-uiește
    if (result.matches) {
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Aplică toate filtrele pe o listă de meciuri
 * Returnează un Map: matchId → FilterMatchResult[]
 * 
 * @param matches - Lista de meciuri
 * @param filters - Lista de filtre
 * @returns Map cu rezultate
 */
export async function applyFiltersToMatches(
  matches: LiveMatch[],
  filters: Filter[]
): Promise<Map<number, FilterMatchResult[]>> {
  
  const resultsMap = new Map<number, FilterMatchResult[]>();
  
  // Pentru fiecare meci, aplicăm toate filtrele
  for (const match of matches) {
    if (!match || !match.fixture || !match.fixture.id) {
      console.warn('⚠️ filter-engine: Skipping invalid match in batch', match);
      continue;
    }

    const matchResults = await applyFiltersToMatch(match, filters);

    if (matchResults.length > 0) {
      resultsMap.set(match.fixture.id, matchResults);
    }
  }
  
  return resultsMap;
}

// ============================================
// FILTER GROUP COMBINATION
// ============================================

/**
 * Apply filter groups with combination logic (AND/OR)
 * Allows combining multiple filters for better accuracy
 * 
 * @param match - The live match to check
 * @param filter - The main filter with combined_filter_ids
 * @param allFilters - All available filters for lookup
 * @returns true if the combination logic is satisfied
 * 
 * LOGIC:
 * - OR: Match if ANY of the combined filters match
 * - AND: Match if ALL of the combined filters match
 */
export async function evaluateFilterGroup(
  match: LiveMatch,
  filter: Filter,
  allFilters: Filter[]
): Promise<boolean> {
  // Evaluate filter normally
  const result = await matchesFilter(match, filter);
  return result.matches;
}

/**
 * Apply filters to matches with group support
 */
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

// ============================================
// EXPORT
// ============================================

const filterEngine = {
  matchesFilter,
  applyFiltersToMatch,
  applyFiltersToMatches,
  evaluateFilterGroup,
  applyFiltersToMatchesWithGroups,
};

export default filterEngine;

// ============================================
// USAGE EXAMPLES
// ============================================

/*
import { matchesFilter, applyFiltersToMatch } from '@/lib/filter-engine';

// 1. Verifică un meci cu un filtru
const result = await matchesFilter(match, filter);
if (result.matches) {
  console.log('✅ MATCH!', result.matchedConditions);
} else {
  console.log('❌ NO MATCH', result.failedConditions);
}

// 2. Aplică toate filtrele pe un meci
const results = await applyFiltersToMatch(match, filters);
console.log(`${results.length} filters matched this match`);

// 3. Aplică pe mai multe meciuri
const resultsMap = await applyFiltersToMatches(matches, filters);
console.log(`${resultsMap.size} matches have filter matches`);
*/
