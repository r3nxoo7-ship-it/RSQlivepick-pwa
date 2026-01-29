// ============================================
// FILTER ENGINE
// ============================================
// Engine that verifies whether matches satisfy filters
// For beginners: learn filtering logic, type checking

import type { LiveMatch } from '@/lib/football-data';
import type { Filter } from '@/lib/supabase';
import { getMatchStatistics } from '@/lib/football-data';
import { parseMatchStats } from '@/lib/api-football';

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
  // We need detailed statistics from API
  
  // If we don't already have stats, fetch them from API
  if (!stats) {
    try {
      const matchStats = await getMatchStatistics(match.fixture.id);
      stats = parseMatchStats(matchStats as any);
    } catch (error) {
      console.error('Error fetching stats:', error);
      failedConditions.push('Could not fetch match statistics');
      return {
        matches: false,
        filter,
        match,
        matchedConditions,
        failedConditions,
      };
    }
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
  
  // Obținem statisticile o singură dată (pentru performance)
  let stats = null;
  try {
    const matchStats = await getMatchStatistics(match.fixture.id);
    stats = parseMatchStats(matchStats as any);
  } catch (error) {
    console.error('Error fetching stats for match:', match.fixture.id, error);
    return results;
  }
  
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
    const matchResults = await applyFiltersToMatch(match, filters);
    
    if (matchResults.length > 0) {
      resultsMap.set(match.fixture.id, matchResults);
    }
  }
  
  return resultsMap;
}

// ============================================
// EXPORT
// ============================================

export default {
  matchesFilter,
  applyFiltersToMatch,
  applyFiltersToMatches,
};

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
