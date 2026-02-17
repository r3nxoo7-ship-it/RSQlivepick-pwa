# 🚀 ML Predictions System - Quick Start Guide

## Installation (15 minutes)

### Step 1: Copy Files
All files have been created in your project:
```
✅ lib/prediction-engine.ts          # Core ML models
✅ lib/prediction-data-aggregation.ts # Data consolidation
✅ components/MatchPredictionCard.tsx # UI component
✅ app/api/predictions/match/route.ts # API endpoint
```

### Step 2: Update Matches Dashboard

**File:** `app/dashboard/matches/page.tsx`

Add import at top:
```typescript
import MatchPredictionCard from '@/components/MatchPredictionCard';
import type { FullPredictions } from '@/lib/prediction-engine';
```

Find where you render match cards (likely `<LiveMatchesDashboardV2/>`) and add predictions card after:

```tsx
// After each MatchCard or in list rendering
{matches.map((match) => (
  <div key={match.fixture?.id}>
    {/* Existing match card */}
    <MatchCard match={match} />
    
    {/* NEW: Add predictions card below */}
    <MatchPredictions match={match} />
  </div>
))}
```

Create a wrapper component `MatchPredictions`:

```tsx
function MatchPredictions({ match }: { match: LiveMatch }) {
  const [predictions, setPredictions] = useState<FullPredictions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match.fixture?.id) return;

    const fetchPredictions = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/predictions/match/${match.fixture?.id}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data);
        } else {
          setError('Failed to load predictions');
        }
      } catch (err) {
        console.error('Predictions error:', err);
        setError('Error loading predictions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPredictions();
  }, [match.fixture?.id]);

  if (!predictions && !isLoading) return null;

  return (
    <div className="mt-2">
      <MatchPredictionCard
        predictions={predictions!}
        isLoading={isLoading}
        error={error || undefined}
      />
    </div>
  );
}
```

### Step 3: Test the API

```bash
# Test a specific match (replace 12345 with real match ID)
curl "http://localhost:3000/api/predictions/match/12345"

# Response should be:
{
  "fixtureId": 12345,
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  "predictions": {
    "firstHalf": {
      "over_0_5": { "probability": 78, "confidence": 82, "reasoning": "..." },
      "over_1_5": { "probability": 42, "confidence": 68, "reasoning": "..." }
    },
    "fullMatch": {
      "over_0_5": { "probability": 96, "confidence": 95, "reasoning": "..." },
      "over_1_5": { "probability": 78, "confidence": 85, "reasoning": "..." },
      "over_2_5": { "probability": 52, "confidence": 72, "reasoning": "..." }
    },
    ...
  },
  "overallConfidence": 75,
  "bestValue": [
    {
      "market": "Over 1.5 Goals",
      "probability": 78,
      "reason": "Model slightly favors over vs market odds"
    }
  ]
}
```

### Step 4: Deploy & Verify

```bash
# Build to catch any TypeScript errors
npm run build

# Dev server (hot reload)
npm run dev

# Navigate to dashboard/matches and verify:
# - Spin icon should appear while loading
# - Colored cards should appear (green/amber/red based on probability)
# - Clicking Info icon should show reasoning
```

---

## 🎯 Key Features & Usage

### Feature 1: Smart Ranking
Predictions are ranked by:
1. **Confidence + Interest** - High confidence + deviation from 50% odds
2. **Top 5-6** shown by default
3. **Expandable** to see all 7 markets

### Feature 2: Color Coding
```
🟢 Green   (70%+)  = High confidence → LIKELY to hit
🟡 Amber  (50-70%) = Moderate         → Toss-up
🔴 Red    (<50%)   = Low confidence   → UNLIKELY
```

### Feature 3: Reasoning & Details
Click **ℹ️ Info** on any prediction to see:
- Probability breakdown
- Key stats that influence prediction
- Model vs odds comparison

### Feature 4: Best Value
Top card shows "Best Value" market - where model disagrees favorably with odds

---

## 📊 Data Flow Explained

```
1. User loads /dashboard/matches
   ↓
2. MatchPredictions component fetches:
   - GET /api/predictions/match/{fixtureId}
   ↓
3. API endpoint:
   a. Checks cache (30-min TTL)
   b. If miss:
      - Fetch match details from ESPN/API
      - Fetch team form (last 10 matches)
      - Fetch H2H history (last 10 matches)
      - Fetch live odds
   c. Aggregate all data
   d. Run ML models:
      - Poisson regression (goals)
      - Logistic regression (BTTS)
      - Ensemble (blend with odds)
   e. Return predictions
   ↓
4. UI renders with color coding
   - Each market = probability bar
   - Icons indicate market type
   - Expandable for details
```

---

## 🔧 Customization

### Change Confidence Colors

**File:** `components/MatchPredictionCard.tsx`, function `getConfidenceColor`

```typescript
function getConfidenceColor(probability: number) {
  if (probability >= 75) {  // ← Change threshold
    return { bg: 'bg-green-500/10', ... };
  } else if (probability >= 55) {  // ← Change thresholds
    return { bg: 'bg-amber-500/10', ... };
  } else {
    return { bg: 'bg-red-500/10', ... };
  }
}
```

### Change Markets Displayed

**File:** `components/MatchPredictionCard.tsx`, variable `allPredictions`

Add/remove markets:
```typescript
const allPredictions = [
  predictions.predictions.firstHalf.over0_5,
  predictions.predictions.firstHalf.over1_5,
  predictions.predictions.fullMatch.over1_5,
  predictions.predictions.fullMatch.over2_5,
  // predictions.predictions.fullMatch.over_0_5,  // ← Uncomment to show
  predictions.predictions.btts.yes,
  predictions.predictions.corners.over8,
  // predictions.predictions.cards.over4_5,      // ← Uncomment to show
];
```

### Adjust Model Weights (40/40/20 Blend)

**File:** `lib/prediction-engine.ts`, function `blendPredictions`

```typescript
const blended = (
  modelProbability * 0.5 +      // ← Increase model weight
  impliedOddsProbability * 0.3 + // ← Decrease odds weight
  h2hProbability * 0.2
);
```

### Change Cache Duration

**File:** `app/api/predictions/match/route.ts`, top of file

```typescript
const CACHE_DURATION = 60 * 60 * 1000; // ← Change to 1 hour (currently 30 min)
```

---

## 📈 Monitoring & Accuracy

### View Cache Stats

```bash
# Check if endpoint is being cached
curl -i "http://localhost:3000/api/predictions/match/12345" 
# Look for: Cache-Control: public, max-age=1800

# Clear cache when updated
curl -X DELETE "http://localhost:3000/api/predictions?fixtureId=12345"
```

### Track Predictions vs Reality

To add outcome tracking (Phase 4):

```typescript
// After match finishes, log:
POST /api/predictions/log-outcome
{
  "predictionId": "...",
  "fixtureId": 12345,
  "actualGoals": 2,
  "actualBTTS": true,
  "predictions": {
    "over1_5_hit": true,  // Did model get it right?
    "btts_yes_hit": true
  }
}
```

---

## 🐛 Troubleshooting

### Issue: "Failed to load predictions" error

**Cause:** API endpoint not accessible
```bash
# Check endpoint exists
ls -la app/api/predictions/match/route.ts

# Check for build errors
npm run build

# View logs
npm run dev
# Watch for [Predictions] logs
```

### Issue: Predictions always "Loading..." 

**Cause:** API taking too long
```bash
# Test API directly:
curl "http://localhost:3000/api/predictions/match/12345"
# Should respond within 5 seconds

# If slow, check:
# 1. Network request timing (Network tab in DevTools)
# 2. ESPN API response time
# 3. H2H fetch performance
```

### Issue: Card not appearing on dashboard

**Cause:** MatchPredictions wrapper not added OR predictions.ok failing

```tsx
// Debug: Add console.logs in MatchPredictions component
useEffect(() => {
  console.log('🔍 Fetching predictions for match:', match.fixture?.id);
  
  fetch(`/api/predictions/match/${match.fixture?.id}`)
    .then(res => {
      console.log('📥 Response status:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('✅ Predictions data:', data);
      setPredictions(data);
    })
    .catch(err => {
      console.error('❌ Fetch error:', err);
      setError(err.message);
    });
}, [match.fixture?.id]);
```

---

## ✅ Verification Checklist

- [ ] Files created: 4 new files in `lib/`, `components/`, `app/api/`
- [ ] TypeScript build succeeds: `npm run build`
- [ ] API endpoint responds: `curl /api/predictions/match/[ID]`
- [ ] Dashboard shows predictions: Navigate to `/dashboard/matches`
- [ ] Colors change: Green (70%+), Amber (50-70%), Red (<50%)
- [ ] Expand works: Click "Show All Predictions" button
- [ ] Info tooltips work: Click ℹ️ icon for details
- [ ] Cache working: Same prediction ID loads faster 2nd time

---

## 🎓 Next Steps (Optional Enhancements)

### Phase 2: Database Integration
- Store predictions in `match_predictions` table
- Create outcome logging endpoint
- Track historical accuracy

### Phase 3: Advanced Features
- Pre-compute predictions at 7am daily
- Add player injury impacts
- Real-time updates as match progresses

### Phase 4: Analytics Dashboard
- Show model accuracy: "Last 30 days: 72% hit rate"
- Identify best/worst markets
- A/B test different weightings

---

## 📞 Questions?

Check the comprehensive plan: `ML_PREDICTIONS_SYSTEM_PLAN.md`

Key sections:
- Architecture Overview (page 1-2)
- Statistical Models Explained (page 5-6)
- Implementation Roadmap (page 10-12)
- Troubleshooting (page 15)

---

## 🚀 You're Ready!

Your ML predictions system is now ready to power intelligent analytics on your football dashboard. Start with the basic integration, test thoroughly, then expand to more sophisticated features.

**Estimated Time to Full Feature:** 3-4 weeks of development
- Week 1: Basic ML engine ✅ (done)
- Week 2: Dashboard UI ✅ (done)
- Week 3: Database + outcome logging
- Week 4: Analytics + optimization

Happy predicting! ⚽🤖📊
