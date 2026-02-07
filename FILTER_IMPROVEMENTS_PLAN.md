# Comprehensive Filter System Improvements Plan

## Overview
This document outlines improvements to the filter template system to use the full ExtendedFilterConditions capabilities.

## Current vs Extended Conditions

### Current Basic Conditions (FilterConditions)
```typescript
{
  corners?: { min?: number; max?: number; team?: 'home' | 'away' | 'total' }
  shots_on_target?: { min?: number; max?: number }
  dangerous_attacks?: { min?: number; max?: number }
  possession?: { min?: number; max?: number }
  goals?: { min?: number; max?: number; team?: 'home' | 'away' | 'total' }
  match_time?: { min?: number; max?: number }
}
```

### Extended Conditions (ExtendedFilterConditions)
```typescript
{
  // Team-specific with home/away/total
  corners?: {
    home?: { min?: number; max?: number; exact?: number }
    away?: { min?: number; max?: number; exact?: number }
    total?: { min?: number; max?: number; exact?: number }
  }

  // Advanced score conditions
  score?: {
    home?: { min?: number; max?: number; exact?: number }
    away?: { min?: number; max?: number; exact?: number }
    difference?: { min?: number; max?: number } // Goal difference
    total_goals?: { min?: number; max?: number }
    exact?: { home: number; away: number }
  }

  // Advanced possession
  possession?: {
    home?: { min?: number; max?: number }
    away?: { min?: number; max?: number }
    dominant?: 'home' | 'away' | 'balanced'
  }

  // Advanced time
  match_time?: {
    before?: number
    after?: number
    between?: [number, number]
    exact?: number
  }

  // Trend detection
  trends?: {
    corners_increasing?: boolean
    shots_increasing?: boolean
    cards_increasing?: boolean
    home_pressure?: boolean
    away_pressure?: boolean
  }

  // Combined logic (AND/OR/NOT)
  combined?: {
    all?: ExtendedFilterConditions[]   // AND
    any?: ExtendedFilterConditions[]   // OR
    none?: ExtendedFilterConditions[]  // NOT
  }
}
```

## Key Improvements

### 1. **Team-Specific Conditions**
Instead of: `shots_on_target: { min: 8 }`
Use: `shots_on_target: { home: { min: 3 }, away: { min: 3 }, total: { min: 8 } }`

**Benefits:**
- More precise filtering
- Can detect specific team patterns (e.g., home team attacking, away defending)
- Better for BTTS, comeback, and counter-attack scenarios

### 2. **Advanced Score Conditions**
Instead of: `goals: { min: 1, max: 2, team: 'total' }`
Use: `score: { total_goals: { min: 1, max: 2 }, difference: { min: 1, max: 1 } }`

**Benefits:**
- Can specify exact scores
- Can detect close games (difference)
- Can identify comeback scenarios
- Can target specific scorelines for BTTS

### 3. **Possession Dominance**
Instead of: `possession: { min: 50 }`
Use: `possession: { home: { min: 55 }, away: { max: 45 }, dominant: 'home' }`

**Benefits:**
- Detect dominant vs balanced matches
- Identify counter-attacking setups (low possession, high shots)
- Better momentum indicators

### 4. **Time Conditions**
Instead of: `match_time: { min: 60, max: 85 }`
Use: `match_time: { between: [60, 85] }` or `after: 75`

**Benefits:**
- More readable
- Supports exact minute targeting
- Better for late-game scenarios

### 5. **Trend Detection**
NEW: `trends: { corners_increasing: true, home_pressure: true }`

**Benefits:**
- Detect momentum shifts
- Identify corner rushes
- Spot late pressure situations
- More predictive of future events

### 6. **Combined Logic**
NEW: ```typescript
combined: {
  all: [
    { corners: { total: { min: 8 } } },
    { shots_on_target: { total: { min: 6 } } }
  ],
  any: [
    { score: { difference: { min: 2 } } },
    { red_cards: { total: { min: 1 } } }
  ]
}
```

**Benefits:**
- Complex scenarios (e.g., "high corners AND high shots OR red card")
- More sophisticated filter logic
- Better LivePick-style filters

## Implementation Plan

### Phase 1: Update Type Definitions ✅
- [x] ExtendedFilterConditions exists
- [ ] Update FilterTemplate to use ExtendedFilterConditions
- [ ] Update filter validation to handle extended conditions

### Phase 2: Update ALL Templates
- [ ] Update all 50+ existing templates to use extended conditions
- [ ] Add team-specific conditions where appropriate
- [ ] Add trend detection to rush/momentum templates
- [ ] Add possession.dominant to balanced/counter templates

### Phase 3: Update Filter Engine
- [ ] Ensure evaluateFilter() handles all extended conditions
- [ ] Add trend detection logic
- [ ] Add combined logic evaluation
- [ ] Test all conditions thoroughly

### Phase 4: Update UI
- [ ] Update filter builder to support extended conditions
- [ ] Add UI for team-specific ranges (home/away/total)
- [ ] Add UI for possession dominant toggle
- [ ] Add UI for trend detection toggles
- [ ] Add UI for combined logic builder

## Example Template Improvements

### Before:
```typescript
{
  id: 'livepick-favorite-losing-home',
  conditions: {
    goals: { min: 1, max: 2, team: 'total' },
    shots_on_target: { min: 6 },
    dangerous_attacks: { min: 10 },
    match_time: { min: 55, max: 80 },
  }
}
```

### After (Using Extended):
```typescript
{
  id: 'livepick-favorite-losing-home-v2',
  conditions: {
    score: {
      home: { max: 0 },          // Home not scored
      away: { min: 1 },          // Away winning
      difference: { min: 1, max: 2 }  // Close game
    },
    shots_on_target: {
      home: { min: 4 },          // Home has chances
      total: { min: 6 }
    },
    dangerous_attacks: {
      home: { min: 8 }           // Home pressing
    },
    possession: {
      home: { min: 50 },         // Home has ball
      dominant: 'home'
    },
    match_time: {
      between: [55, 80]
    },
    trends: {
      home_pressure: true        // Home momentum building
    }
  }
}
```

## Success Metrics

1. **Precision**: Templates trigger only in exact scenarios (not false positives)
2. **Recall**: Templates don't miss valid scenarios (not false negatives)
3. **User Value**: Higher success rates due to more specific conditions
4. **LivePick Parity**: Match or exceed LivePick.eu template sophistication

## Next Steps

1. ✅ Create improved templates file (filter-templates-improved.ts)
2. Update existing templates to use extended conditions
3. Test templates with live match data
4. Update UI to support extended conditions
5. Deploy and monitor performance

## Files to Update

1. `lib/filter-templates.ts` - ALL templates
2. `lib/filter-validation.ts` - Validation for extended conditions
3. `lib/filter-engine.ts` - Engine evaluation
4. `app/dashboard/filters/new/page.tsx` - UI for builder
5. `components/FilterConditionBuilder.tsx` - Component for building conditions

## Notes

- Extended conditions are already supported by the backend (ExtendedFilterConditions interface exists)
- Filter engine already has evaluateFilter() for extended conditions
- Main work is updating templates and UI
- Backward compatibility: old templates still work, just less precise
