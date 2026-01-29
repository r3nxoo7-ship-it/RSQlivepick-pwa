// ============================================
// R$Q - EXTENDED FILTER CONDITIONS
// ============================================
// Comprehensive filter system with advanced match stats

// ============================================
// BASIC TYPES
// ============================================

export interface RangeCondition {
  min?: number;
  max?: number;
  exact?: number;
}

export interface TeamSpecificCondition {
  home?: RangeCondition;
  away?: RangeCondition;
  total?: RangeCondition;
}

export interface TimeCondition {
  before?: number;      // Înainte de minut X
  after?: number;       // După minut Y
  between?: [number, number];  // Între [X, Y]
  exact?: number;       // La exact minutul X
}

// ============================================
// EXTENDED FILTER CONDITIONS
// ============================================

export interface ExtendedFilterConditions {
  // ========== BASIC STATS (with home/away) ==========
  
  corners?: TeamSpecificCondition;
  
  shots?: TeamSpecificCondition;
  
  shots_on_target?: TeamSpecificCondition;
  
  shots_off_target?: TeamSpecificCondition;
  
  // ========== CARDS ==========
  
  yellow_cards?: TeamSpecificCondition;
  
  red_cards?: TeamSpecificCondition;
  
  total_cards?: TeamSpecificCondition;
  
  // ========== SCORE ==========
  
  score?: {
    home?: RangeCondition;
    away?: RangeCondition;
    difference?: RangeCondition;  // Goal difference
    total_goals?: RangeCondition;  // Total goals in match
    exact?: {                      // Exact score
      home: number;
      away: number;
    };
  };
  
  // ========== ADVANCED STATS ==========
  
  dangerous_attacks?: TeamSpecificCondition;
  
  attacks?: TeamSpecificCondition;
  
  possession?: {
    home?: RangeCondition;    // % possession
    away?: RangeCondition;
    dominant?: 'home' | 'away' | 'balanced';  // Who dominates?
  };
  
  fouls?: TeamSpecificCondition;
  
  offsides?: TeamSpecificCondition;
  
  // ========== SUBSTITUTIONS ==========
  
  substitutions?: TeamSpecificCondition;
  
  // ========== TIME CONDITIONS ==========
  
  match_time?: TimeCondition;
  
  // ========== ODDS (pre-match) ==========
  // Bookmaker pre-match odds (for example opening odds)
  odds?: RangeCondition;
  
  // ========== COMBINED CONDITIONS ==========
  
  combined?: {
    // Toate condițiile trebuie îndeplinite
    all?: ExtendedFilterConditions[];
    // Cel puțin una din condiții
    any?: ExtendedFilterConditions[];
    // Niciuna din condiții (NOT)
    none?: ExtendedFilterConditions[];
  };
  
  // ========== TREND CONDITIONS ==========
  
  trends?: {
    corners_increasing?: boolean;     // Cornere în creștere?
    shots_increasing?: boolean;       // Șuturi în creștere?
    cards_increasing?: boolean;       // Cartonașe în creștere?
    home_pressure?: boolean;          // Presiune gazde?
    away_pressure?: boolean;          // Presiune oaspeți?
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if value matches range condition
 */
export function matchesRange(value: number, condition: RangeCondition): boolean {
  if (condition.exact !== undefined) {
    return value === condition.exact;
  }
  
  if (condition.min !== undefined && value < condition.min) {
    return false;
  }
  
  if (condition.max !== undefined && value > condition.max) {
    return false;
  }
  
  return true;
}

/**
 * Check if value matches time condition
 */
export function matchesTime(minute: number, condition: TimeCondition): boolean {
  if (condition.exact !== undefined) {
    return minute === condition.exact;
  }
  
  if (condition.before !== undefined && minute >= condition.before) {
    return false;
  }
  
  if (condition.after !== undefined && minute <= condition.after) {
    return false;
  }
  
  if (condition.between) {
    const [min, max] = condition.between;
    if (minute < min || minute > max) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if team-specific condition matches
 */
export function matchesTeamCondition(
  homeValue: number,
  awayValue: number,
  condition: TeamSpecificCondition
): boolean {
  if (condition.home && !matchesRange(homeValue, condition.home)) {
    return false;
  }
  
  if (condition.away && !matchesRange(awayValue, condition.away)) {
    return false;
  }
  
  if (condition.total && !matchesRange(homeValue + awayValue, condition.total)) {
    return false;
  }
  
  return true;
}

/**
 * Evaluate complete filter conditions against match data
 */
export function evaluateFilter(
  matchData: any,
  conditions: ExtendedFilterConditions
): boolean {
  // Time check
  if (conditions.match_time) {
    const minute = matchData.fixture?.status?.elapsed || 0;
    if (!matchesTime(minute, conditions.match_time)) {
      return false;
    }
  }
  
  // Corners
  if (conditions.corners) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.corners || 0,
      matchData.statistics?.away?.corners || 0,
      conditions.corners
    )) {
      return false;
    }
  }
  
  // Shots
  if (conditions.shots) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.shots || 0,
      matchData.statistics?.away?.shots || 0,
      conditions.shots
    )) {
      return false;
    }
  }
  
  // Shots on target
  if (conditions.shots_on_target) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.shots_on_target || 0,
      matchData.statistics?.away?.shots_on_target || 0,
      conditions.shots_on_target
    )) {
      return false;
    }
  }
  
  // Yellow cards
  if (conditions.yellow_cards) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.yellow_cards || 0,
      matchData.statistics?.away?.yellow_cards || 0,
      conditions.yellow_cards
    )) {
      return false;
    }
  }
  
  // Red cards
  if (conditions.red_cards) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.red_cards || 0,
      matchData.statistics?.away?.red_cards || 0,
      conditions.red_cards
    )) {
      return false;
    }
  }
  
  // Score
  if (conditions.score) {
    const homeGoals = matchData.goals?.home || 0;
    const awayGoals = matchData.goals?.away || 0;
    
    if (conditions.score.exact) {
      if (homeGoals !== conditions.score.exact.home || 
          awayGoals !== conditions.score.exact.away) {
        return false;
      }
    }
    
    if (conditions.score.home && !matchesRange(homeGoals, conditions.score.home)) {
      return false;
    }
    
    if (conditions.score.away && !matchesRange(awayGoals, conditions.score.away)) {
      return false;
    }
    
    if (conditions.score.total_goals && 
        !matchesRange(homeGoals + awayGoals, conditions.score.total_goals)) {
      return false;
    }
    
    if (conditions.score.difference) {
      const diff = Math.abs(homeGoals - awayGoals);
      if (!matchesRange(diff, conditions.score.difference)) {
        return false;
      }
    }
  }
  
  // Dangerous attacks
  if (conditions.dangerous_attacks) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.dangerous_attacks || 0,
      matchData.statistics?.away?.dangerous_attacks || 0,
      conditions.dangerous_attacks
    )) {
      return false;
    }
  }
  
  // Possession
  if (conditions.possession) {
    const homePoss = matchData.statistics?.home?.possession || 0;
    const awayPoss = matchData.statistics?.away?.possession || 0;
    
    if (conditions.possession.home && !matchesRange(homePoss, conditions.possession.home)) {
      return false;
    }
    
    if (conditions.possession.away && !matchesRange(awayPoss, conditions.possession.away)) {
      return false;
    }
    
    if (conditions.possession.dominant) {
      const diff = Math.abs(homePoss - awayPoss);
      if (conditions.possession.dominant === 'balanced' && diff > 10) {
        return false;
      }
      if (conditions.possession.dominant === 'home' && homePoss <= awayPoss) {
        return false;
      }
      if (conditions.possession.dominant === 'away' && awayPoss <= homePoss) {
        return false;
      }
    }
  }
  
  // Substitutions
  if (conditions.substitutions) {
    if (!matchesTeamCondition(
      matchData.statistics?.home?.substitutions || 0,
      matchData.statistics?.away?.substitutions || 0,
      conditions.substitutions
    )) {
      return false;
    }
  }
  
  // Combined conditions
  if (conditions.combined) {
    if (conditions.combined.all) {
      for (const subCondition of conditions.combined.all) {
        if (!evaluateFilter(matchData, subCondition)) {
          return false;
        }
      }
    }
    
    if (conditions.combined.any) {
      let anyMatched = false;
      for (const subCondition of conditions.combined.any) {
        if (evaluateFilter(matchData, subCondition)) {
          anyMatched = true;
          break;
        }
      }
      if (!anyMatched) {
        return false;
      }
    }
    
    if (conditions.combined.none) {
      for (const subCondition of conditions.combined.none) {
        if (evaluateFilter(matchData, subCondition)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// ============================================
// EXPORT
// ============================================

export default {
  matchesRange,
  matchesTime,
  matchesTeamCondition,
  evaluateFilter,
};
