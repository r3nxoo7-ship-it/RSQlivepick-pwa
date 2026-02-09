// ============================================
// FILTER VALIDATION ENGINE
// ============================================
// Validation of filters: duplicates, contradictory conditions, etc.

import type { FilterConditions, Filter } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFilter?: Filter;
  reason?: string;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Verify if filter conditions are valid and non-contradictory
 */
export function validateFilterConditions(conditions: FilterConditions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!conditions || Object.keys(conditions).length === 0) {
    errors.push('Filter must have at least one condition');
    return { isValid: false, errors, warnings };
  }

  // ============================================
  // VALIDATION: CORNERS
  // ============================================
  if (conditions.corners) {
    const { min, max, team } = conditions.corners;

    // Validate that min <= max
    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Corners: min (${min}) cannot be greater than max (${max})`);
    }

    // Validate realistic ranges (0-30)
    if (min !== undefined && min < 0) errors.push('Corners min cannot be negative');
    if (max !== undefined && max > 30) warnings.push(`Corners max (${max}) is very high`);

    // Validate team
    if (team && !['home', 'away', 'total'].includes(team)) {
      errors.push(`Corners team invalid: ${team}`);
    }
  }

  // ============================================
  // VALIDATION: GOALS
  // ============================================
  if (conditions.goals) {
    const { min, max, team } = conditions.goals;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Goals: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Goals min cannot be negative');
    if (max !== undefined && max > 15) warnings.push(`Goals max (${max}) is very high`);

    if (team && !['home', 'away', 'total'].includes(team)) {
      errors.push(`Goals team invalid: ${team}`);
    }
  }

  // ============================================
  // VALIDATION: SHOTS
  // ============================================
  if (conditions.shots_on_target) {
    const { min, max } = conditions.shots_on_target;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Shots on target: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Shots on target min cannot be negative');
  }

  if (conditions.shots_off_target) {
    const { min, max } = conditions.shots_off_target;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Shots off target: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Shots off target min cannot be negative');
  }

  if (conditions.total_shots) {
    const { min, max } = conditions.total_shots;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Total shots: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Total shots min cannot be negative');
  }

  // ============================================
  // VALIDATION: DANGEROUS ATTACKS
  // ============================================
  if (conditions.dangerous_attacks) {
    const { min, max } = conditions.dangerous_attacks;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Dangerous attacks: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Dangerous attacks min cannot be negative');
  }

  // ============================================
  // VALIDATION: CARDS
  // ============================================
  if (conditions.yellow_cards) {
    const { min, max } = conditions.yellow_cards;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Yellow cards: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Yellow cards min cannot be negative');
    if (max !== undefined && max > 10) warnings.push(`Yellow cards max (${max}) is very high`);
  }

  if (conditions.red_cards) {
    const { min, max } = conditions.red_cards;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Red cards: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0) errors.push('Red cards min cannot be negative');
    if (max !== undefined && max > 5) warnings.push(`Red cards max (${max}) is very high`);
  }

  // ============================================
  // VALIDATION: POSSESSION
  // ============================================
  if (conditions.possession) {
    const { min, max } = conditions.possession;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Possession: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && (min < 0 || min > 100)) {
      errors.push('Possession min must be between 0-100');
    }

    if (max !== undefined && (max < 0 || max > 100)) {
      errors.push('Possession max must be between 0-100');
    }
  }

  // ============================================
  // VALIDATION: MATCH TIME
  // ============================================
  if (conditions.match_time) {
    const { min, max } = conditions.match_time;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Match time: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && (min < 0 || min > 120)) {
      errors.push('Match time min must be between 0-120');
    }

    if (max !== undefined && (max < 0 || max > 120)) {
      errors.push('Match time max must be between 0-120');
    }
  }

  // ============================================
  // VALIDATION: ODDS
  // ============================================
  if (conditions.odds) {
    const { min, max } = conditions.odds;

    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Odds: min (${min}) cannot be greater than max (${max})`);
    }

    if (min !== undefined && min < 0.5) {
      warnings.push(`Odds min (${min}) is very low`);
    }
  }

  // ============================================
  // VALIDATION: PRE-MATCH ODDS (market-specific)
  // ============================================
  if ((conditions as any).pre_match_odds) {
    const preMatchOdds = (conditions as any).pre_match_odds;
    for (const [market, range] of Object.entries(preMatchOdds)) {
      const r = range as { min?: number; max?: number } | undefined;
      if (!r) continue;
      if (r.min !== undefined && r.max !== undefined && r.min > r.max) {
        errors.push(`Pre-match odds (${market}): min (${r.min}) cannot be greater than max (${r.max})`);
      }
      if (r.min !== undefined && r.min < 1.0) {
        warnings.push(`Pre-match odds (${market}): min ${r.min} is below 1.0 (decimal odds are always >= 1.0)`);
      }
      if (r.max !== undefined && r.max > 50.0) {
        warnings.push(`Pre-match odds (${market}): max ${r.max} is very high`);
      }
    }
  }

  // ============================================
  // VALIDATION: CONTRADICTORY CONDITIONS
  // ============================================

  // Validation: total_shots vs shots_on_target + shots_off_target
  if (conditions.total_shots && (conditions.shots_on_target || conditions.shots_off_target)) {
    const totalMin = conditions.total_shots.min || 0;
    const onTargetMax = conditions.shots_on_target?.max || Infinity;
    const offTargetMax = conditions.shots_off_target?.max || Infinity;

    if (totalMin > onTargetMax + offTargetMax) {
      errors.push(
        'Contradictory condition: total_shots min is greater than shots_on_target + shots_off_target maximum'
      );
    }
  }

  // Validation: duplicate corners
  if (conditions.corners) {
    const minOccurrences = (conditions.corners.min !== undefined ? 1 : 0);
    const maxOccurrences = (conditions.corners.max !== undefined ? 1 : 0);

    if (conditions.corners.min !== undefined &&
        conditions.corners.max !== undefined &&
        conditions.corners.min === conditions.corners.max) {
      warnings.push('Corners has fixed range (min = max)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a filter is a duplicate of an existing one
 * Considers duplicates if:
 * - Exact same name
 * - Identical conditions
 */
export function checkDuplicate(
  newFilter: { name: string; conditions: FilterConditions },
  existingFilters: Filter[]
): DuplicateCheckResult {
  
  for (const existing of existingFilters) {
    // Duplication checklist (in order of importance):
    // 1. Same name
    // 2. Same conditions

    const sameNameAndConditions =
      existing.name.toLowerCase() === newFilter.name.toLowerCase() &&
      JSON.stringify(existing.conditions) === JSON.stringify(newFilter.conditions);

    if (sameNameAndConditions) {
      return {
        isDuplicate: true,
        existingFilter: existing,
        reason: `Duplicate filter: "${existing.name}" with identical conditions`,
      };
    }

    // Softer validation: same name but different conditions
    const sameName = existing.name.toLowerCase() === newFilter.name.toLowerCase();
    if (sameName) {
      return {
        isDuplicate: true,
        existingFilter: existing,
        reason: `A filter with the name "${existing.name}" already exists. Please change the name.`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Check if conditions are complete (not empty)
 * to allow enabling notifications
 */
export function areConditionsComplete(conditions: FilterConditions | any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return false;
  }

  // Check for basic FilterConditions
  const hasBasicValues =
    (conditions.corners?.min !== undefined || conditions.corners?.max !== undefined) ||
    (conditions.goals?.min !== undefined || conditions.goals?.max !== undefined) ||
    (conditions.shots_on_target?.min !== undefined || conditions.shots_on_target?.max !== undefined) ||
    (conditions.yellow_cards?.min !== undefined || conditions.yellow_cards?.max !== undefined) ||
    (conditions.dangerous_attacks?.min !== undefined || conditions.dangerous_attacks?.max !== undefined) ||
    (conditions.match_time?.min !== undefined || conditions.match_time?.max !== undefined) ||
    (conditions.odds?.min !== undefined || conditions.odds?.max !== undefined) ||
    (conditions.possession?.min !== undefined || conditions.possession?.max !== undefined) ||
    (conditions.red_cards?.min !== undefined || conditions.red_cards?.max !== undefined) ||
    (conditions.shots_off_target?.min !== undefined || conditions.shots_off_target?.max !== undefined) ||
    (conditions.total_shots?.min !== undefined || conditions.total_shots?.max !== undefined);

  // Check for ExtendedFilterConditions
  const hasExtendedValues =
    (conditions.score?.home !== undefined) ||
    (conditions.score?.away !== undefined) ||
    (conditions.score?.total_goals !== undefined) ||
    (conditions.score?.difference !== undefined) ||
    (conditions.score?.exact !== undefined) ||
    (conditions.possession?.home !== undefined) ||
    (conditions.possession?.away !== undefined) ||
    (conditions.possession?.dominant !== undefined) ||
    (conditions.corners?.home !== undefined) ||
    (conditions.corners?.away !== undefined) ||
    (conditions.corners?.total !== undefined) ||
    (conditions.shots_on_target?.home !== undefined) ||
    (conditions.shots_on_target?.away !== undefined) ||
    (conditions.shots_on_target?.total !== undefined) ||
    (conditions.dangerous_attacks?.home !== undefined) ||
    (conditions.dangerous_attacks?.away !== undefined) ||
    (conditions.dangerous_attacks?.total !== undefined) ||
    (conditions.match_time?.between !== undefined) ||
    (conditions.match_time?.after !== undefined) ||
    (conditions.match_time?.before !== undefined) ||
    (conditions.trends !== undefined);

  // Check for pre_match_odds
  const hasPreMatchOdds =
    (conditions as any).pre_match_odds !== undefined &&
    Object.keys((conditions as any).pre_match_odds).length > 0;

  return hasBasicValues || hasExtendedValues || hasPreMatchOdds;
}

/**
 * Get a readable summary of the filter conditions
 */
export function getConditionsSummary(conditions: FilterConditions): string[] {
  const summary: string[] = [];

  if (conditions.goals?.min !== undefined) {
    summary.push(`Minimum ${conditions.goals.min} goals`);
  }
  if (conditions.goals?.max !== undefined) {
    summary.push(`Maximum ${conditions.goals.max} goals`);
  }

  if (conditions.corners?.min !== undefined) {
    summary.push(`Minimum ${conditions.corners.min} corners`);
  }
  if (conditions.corners?.max !== undefined) {
    summary.push(`Maximum ${conditions.corners.max} corners`);
  }

  if (conditions.shots_on_target?.min !== undefined) {
    summary.push(`Minimum ${conditions.shots_on_target.min} shots on target`);
  }

  if (conditions.yellow_cards?.min !== undefined) {
    summary.push(`Minimum ${conditions.yellow_cards.min} yellow cards`);
  }

  if (conditions.match_time?.min !== undefined && conditions.match_time?.max !== undefined) {
    summary.push(`Between minute ${conditions.match_time.min}' and ${conditions.match_time.max}'`);
  }

  return summary;
}
