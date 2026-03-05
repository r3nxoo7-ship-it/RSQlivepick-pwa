# Live Odds Integration Research

## Executive Summary

**YES, we have odds infrastructure** — but it's **not integrated into live scanning yet**. The system has all the building blocks ready; we just need to connect them.

---

## Current State

### ✅ What We Have

1. **Comprehensive Odds Provider** (`lib/odds-provider.ts`)
   - Fetches from API-Football
   - Supports 20+ markets:
     - Match Winner (1X2)
     - Goals Over/Under (0.5, 1.5, 2.5, 3.5, 4.5, etc.)
     - Corners O/U
     - Cards O/U
     - BTTS (Both Teams To Score)
     - Asian Handicap
     - Double Chance
     - First Half markets
   - Returns parsed decimal odds ready to use

2. **Filter Conditions Already Support Odds** (`lib/supabase.ts`)
   ```typescript
   // Generic odds range
   odds?: { min?: number; max?: number };

   // Pre-match specific markets (from ML predictions)
   ml_predictions?: {
     odds_home?: { min?: number; max?: number };
     odds_draw?: { min?: number; max?: number };
     odds_away?: { min?: number; max?: number };
     odds_over_25?: { min?: number; max?: number };
     odds_btts_yes?: { min?: number; max?: number };
   };

   // Goal line betting
   goal_line?: { type: 'over' | 'under'; value: number };
   match_goals?: { type: 'over' | 'under'; value: 0.5 | 1.5 | 2.5 | ... };
   ```

3. **Filter Engine Already Checks Odds** (`lib/filter-engine.ts`)
   - Lines 680-750: odds validation logic exists
   - Checks if `match.odds` object is populated
   - Validates ranges for generic odds, pre-match odds, goal lines
   - Example logic:
     ```typescript
     if (conditions.odds) {
       const matchOdds = match.odds as any;
       const anyOdd = matchOdds.home_win ?? matchOdds.away_win ?? matchOdds.draw;
       if (anyOdd >= min && anyOdd <= max) { /* matched */ }
     }
     ```

4. **Odds API Route** (`app/api/odds/upcoming/route.ts`)
   - Fetches pre-match odds for today's matches
   - Currently only for "NS" (Not Started) fixtures
   - 5-minute cache

### ❌ What's Missing

1. **Live Odds NOT Fetched During Scanning**
   - `lib/background-scanner.ts` — no odds fetching
   - `lib/unified-api.ts` — no odds in match objects
   - `lib/live-filter-matcher.ts` — checks for odds but doesn't fetch

2. **Match Objects Don't Include Odds**
   - SofaScore API (current live data source) doesn't provide odds
   - API-Football fixtures endpoint doesn't include odds by default
   - Need separate `/odds` endpoint call per match

3. **No UI for Adding Odds Conditions**
   - Filter creation UI (`app/dashboard/filters/new/page.tsx`) doesn't expose odds fields
   - Users can't currently add "Over 1.5 odds must be > 1.72" conditions

---

## Your Use Case

> "When my filter triggers on shots/goals/corners, also check if the live odds for Over 1.5 goals are > 1.72"

This adds a **betting value filter** — only notify when:
1. Match stats trigger (5+ shots, 2+ corners, etc.)
2. **AND** the odds provide value (Over 1.5 > 1.72 means bookies think it's less likely, so higher potential profit)

### Example Enhanced Filter

```typescript
{
  name: "High Value Over 1.5 Goals",
  conditions: {
    // Statistical triggers
    shots_on_target: { min: 5, team: 'total' },
    corners: { min: 4, team: 'total' },
    match_time: { min: 20, max: 75 },
    
    // Odds value filter
    odds: { min: 1.72, max: 3.0 },  // Generic (would check any available odd)
    
    // OR more specific:
    goal_line: { type: 'over', value: 1.5 },  // Would check goals_over_1_5 odd
    // Implicit: only trigger if goals_over_1_5 odd exists and is >= 1.72
  }
}
```

---

## Implementation Plan

### Phase 1: Enable Odds Fetching (Backend)

1. **Modify `lib/unified-api.ts`**
   - Add `includeOdds?: boolean` parameter to `getLiveMatches()`
   - When true, batch-fetch odds for all live matches
   - Attach `odds` field to each match object

2. **Update Background Scanner** (`lib/background-scanner.ts`)
   - Enable odds fetching during scan:
     ```typescript
     const matches = await getLiveMatches({ includeOdds: true });
     ```
   - Consider caching: fetch odds every 2nd or 3rd scan cycle (odds don't change every 30s)

3. **Batch Odds Fetching** (`lib/odds-provider.ts`)
   - Already has `getOddsForMatches(fixtureIds: number[])` helper
   - Returns `Map<number, MatchOdds>`
   - API-Football allows batch requests (up to 20 fixtures per call)

**Cost Considerations:**
- API-Football "Professional" plan: 650 requests/day
- ~50 live matches avg → 3 requests per batch (20 fixtures/call)
- Fetching every 30s = 120 scans/hour × 3 = 360 requests/hour ⚠️
- **Solution:** Fetch odds every 3-5 minutes (not every 30s)

### Phase 2: Add Odds Conditions to Filter UI

1. **Update Filter Creation Page** (`app/dashboard/filters/new/page.tsx`)
   - Add "Betting Odds" section
   - Common use cases:
     - "Over 1.5 goals odds range"
     - "Home win odds minimum"
     - "Corners Over 9.5 odds"
   - UI Example:
     ```
     ┌─ Betting Odds (Optional) ─────────────┐
     │                                        │
     │ Market: [Over 1.5 Goals ▼]            │
     │ Min Odds: [1.72] Max: [3.0]           │
     │                                        │
     │ ⚠️ Note: Odds checked at trigger time │
     │   (increases API usage)                │
     └────────────────────────────────────────┘
     ```

2. **Predefined Odds Templates**
   - "Value Over 1.5 (odds > 1.70)"
   - "Safe BTTS (odds 1.50-2.00)"
   - "High Corners Value (O9.5 > 2.00)"

### Phase 3: Smart Odds Integration

1. **Odds Caching Strategy**
   ```typescript
   // Cache structure
   const oddsCache = new Map<number, { odds: MatchOdds; fetchedAt: number }>();
   
   // Fetch logic
   if (!oddsCache.has(fixtureId) || Date.now() - cache.fetchedAt > 3 * 60 * 1000) {
     // Refetch if > 3 minutes old
     const newOdds = await getOddsForMatch(fixtureId);
     oddsCache.set(fixtureId, { odds: newOdds, fetchedAt: Date.now() });
   }
   ```

2. **Selective Odds Fetching**
   - Only fetch odds if **any active filter uses odds conditions**
   - Check filter collection:
     ```typescript
     const needsOdds = filters.some(f => 
       f.conditions.odds || 
       f.conditions.goal_line || 
       f.conditions.ml_predictions?.odds_home
     );
     if (needsOdds) { /* fetch odds */ }
     ```

3. **Fallback Behavior**
   - If odds not available → treat odds condition as "passed" (don't block trigger)
   - Log warning: "Odds condition skipped (no data)"
   - OR strict mode: fail condition if odds missing

---

## Technical Deep Dive

### Current Odds Flow (Pre-Match Only)

```
1. User visits /dashboard/matches
2. Frontend calls /api/odds/upcoming
3. Route fetches today's NS fixtures from API-Football /odds
4. Returns odds map keyed by team names
5. Frontend displays odds alongside ESPN matches
```

### Proposed Live Odds Flow

```
1. Background Scanner runs every 30s
2. Fetches live matches from SofaScore (stats, scores)
3. IF any filter needs odds:
   - Extract API-Football fixture IDs
   - Batch call /odds endpoint (20 fixtures per request)
   - Attach odds to match objects
4. Filter Engine evaluates:
   - Stats conditions (corners, shots, etc.)
   - Odds conditions (check match.odds.goals_over_1_5 >= min)
5. Trigger notification if ALL conditions pass
```

### Code Changes Summary

**Backend:**
```typescript
// lib/unified-api.ts
export async function getLiveMatches(options?: { includeOdds?: boolean }) {
  const matches = await fetchSofaScoreMatches();
  
  if (options?.includeOdds) {
    const fixtureIds = matches.map(m => m.fixture_id).filter(Boolean);
    const oddsMap = await getOddsForMatches(fixtureIds);
    matches.forEach(m => {
      if (m.fixture_id && oddsMap.has(m.fixture_id)) {
        m.odds = oddsMap.get(m.fixture_id)!.bookmakers;
      }
    });
  }
  
  return matches;
}
```

**Filter Engine (already works, just needs populated match.odds):**
```typescript
// lib/filter-engine.ts (existing code)
if (conditions.odds) {
  const matchOdds = match.odds as any;
  const oddValue = matchOdds.goals_over_1_5;  // Or any market
  if (oddValue >= conditions.odds.min) { /* trigger */ }
}
```

**Filter UI:**
```typescript
// app/dashboard/filters/new/page.tsx
const [oddsCondition, setOddsCondition] = useState({ 
  market: 'goals_over_1_5', 
  min: 1.70, 
  max: 3.0 
});

// On submit:
filterPayload.conditions.odds = { min: oddsCondition.min, max: oddsCondition.max };
```

---

## Cost & Performance Analysis

### API-Football Pricing

| Plan | Requests/Day | Cost/Month | Notes |
|------|--------------|------------|-------|
| Basic | 100 | Free | Not enough |
| Pro | 650 | $20 | Sufficient if optimized |
| Ultra | 3,000 | Free (for valid use case) | Request from support |

### Request Breakdown (Current Plan)

**If fetching odds every 30s for 50 live matches:**
- 3 batch requests per scan (50 matches ÷ 20/request)
- 120 scans/hour × 3 = **360 requests/hour** = **8,640/day** ⚠️ **WAY OVER LIMIT**

**Optimized: Fetch odds every 5 minutes:**
- 12 scans/hour × 3 = **36 requests/hour** = **864/day** ✅ Within Pro limit

**Even better: Fetch on-demand:**
- Only when user has active filters with odds conditions
- Only for matches already triggering on stats
- Est. ~10-20 matches/hour × 12 = **240/day** ✅ Comfortable margin

### Architecture Recommendation

```typescript
// Tiered odds fetching strategy
enum OddsFetchStrategy {
  NEVER = 'never',           // No filters use odds
  ON_PARTIAL_MATCH = 'on_partial_match',  // Only when stats match (before final check)
  PERIODIC = 'periodic',     // Every N minutes
  ALWAYS = 'always'          // Every scan (expensive)
}

// Dynamic strategy selection
function selectOddsStrategy(filters: Filter[]): OddsFetchStrategy {
  const oddsFiltersCount = filters.filter(hasOddsConditions).length;
  
  if (oddsFiltersCount === 0) return NEVER;
  if (oddsFiltersCount < 3) return ON_PARTIAL_MATCH;  // Fetch only for likely matches
  return PERIODIC;  // 5-minute intervals
}
```

---

## Example User Scenarios

### Scenario 1: Value Over 1.5 Filter
```typescript
{
  name: "High Pressure + Value Over 1.5",
  conditions: {
    // Stats triggers
    shots_on_target: { min: 6, team: 'total' },
    dangerous_attacks: { min: 30, team: 'total' },
    match_time: { min: 25, max: 70 },
    
    // Odds condition (NEW)
    odds: { min: 1.72, max: 3.5 },  // Generic odds check
    goal_line: { type: 'over', value: 1.5 }  // Ensures we check goals_over_1_5
  }
}
```
**Behavior:** Only triggers when stats are hot AND bookies still offer value odds (>1.72)

### Scenario 2: Safe BTTS
```typescript
{
  name: "Both Teams Scoring Pattern",
  conditions: {
    both_teams_score: true,  // Already 1-1 or similar
    match_time: { min: 50, max: 80 },
    
    // Odds condition
    odds: { min: 1.50, max: 2.10 }  // BTTS Yes odds
  }
}
```

### Scenario 3: Live Arbitrage (Advanced)
```typescript
{
  name: "Home Win Value After Setback",
  conditions: {
    score: { home: 0, away: 1 },  // Home team down
    possession: { min: 60, team: 'home' },
    shots_on_target: { min: 4, team: 'home' },
    
    // High odds due to scoreline, but stats favor home
    odds: { min: 2.50 }  // Home win odds jumped
  }
}
```

---

## Recommendations

### ✅ DO Implement
1. **Selective odds fetching** (on-demand, 5-min intervals)
2. **Common market shortcuts** (Over 1.5, BTTS, Home/Away)
3. **Odds caching** (reduce redundant API calls)
4. **Graceful degradation** (continue without odds if unavailable)

### ⚠️ BE CAREFUL
1. **API quota management** (monitor daily usage)
2. **Latency** (odds fetch adds ~500ms per scan)
3. **Odds availability** (not all matches have full markets)

### 🚫 DON'T Do (Yet)
1. **Real-time odds updates** (30s refresh) — too expensive
2. **Exotic markets** (Asian Handicap -2.5, etc.) — complex validation
3. **Historical odds tracking** (would need separate DB table)

---

## Next Steps

1. **Quick Prototype** (2-3 hours)
   - Add `includeOdds` flag to unified-api
   - Wire up odds-provider in background scanner
   - Test with 1-2 filters manually setting odds conditions

2. **UI Implementation** (4-5 hours)
   - Add "Betting Odds" section to filter creation
   - 5 preset markets: Over 1.5, Over 2.5, BTTS, Home Win, Away Win
   - Simple min/max odds inputs

3. **Optimization** (2-3 hours)
   - Implement ON_PARTIAL_MATCH strategy
   - Add odds cache with 5-minute TTL
   - Monitor API usage dashboard

4. **Templates** (1-2 hours)
   - Create 3-5 pre-built filters with odds conditions
   - In-app tutorial: "Using Odds for Better Filters"

---

## Questions for Decision

1. **Default behavior when odds unavailable?**
   - A) Skip odds condition (permissive) ✅ Recommended
   - B) Fail filter match (strict)

2. **Fetch frequency?**
   - A) On-demand (when stats partially match) ✅ Most efficient
   - B) Every 5 minutes (predictable)
   - C) Every scan (expensive)

3. **Which markets to expose in UI?**
   - A) Just Over 1.5 / Over 2.5 (simple) ✅ Start here
   - B) 5-8 common markets (BTTS, corners, etc.)
   - C) Full 20+ markets (overwhelming)

4. **How to visualize odds in triggered matches?**
   - A) Show odds in notification / history
   - B) Show odds change over time (graph)
   - C) Both

---

## Conclusion

**You already have 80% of the infrastructure.** The odds-provider exists, filter conditions support it, and the engine validates it. You just need to:

1. Connect odds fetching to the background scanner (10 lines of code)
2. Add UI controls for odds conditions (few hours of frontend work)
3. Optimize for API quota (caching + smart fetching)

**Total effort: ~1-2 days of development** for a basic working implementation.

The hardest part is managing API-Football quota efficiently — but with on-demand fetching, you can comfortably stay within limits.
