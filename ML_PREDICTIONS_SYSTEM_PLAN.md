# 🤖 ML-Powered Predictions System - Implementation Plan

**Objective:** Add intelligent probabilistic predictions to the matches dashboard showing what's MOST likely to happen in today's games based on **stats, recent form, odds, H2H, and live data**.

---

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PREDICTIONS ENGINE                        │
│                                                               │
│  INPUT DATA:                                                 │
│  • Live Stats (corners, goals, shots, possession, cards)    │
│  • Team Form (last 10 matches)                              │
│  • H2H History (recent matchups)                            │
│  • Odds (implied probabilities)                             │
│  • Match Context (league, day/night, home/away)             │
│                        ↓                                     │
│  PROCESSING:                                                │
│  1. Statistical Aggregation (avg, σ, trends)               │
│  2. Odds Calibration (market probability)                  │
│  3. Prediction Models (GLM + ensemble)                     │
│  4. Confidence Scoring (0-100)                             │
│                        ↓                                     │
│  OUTPUT: Market Predictions + Confidence                   │
│  • Over/Under 0.5 Goals (1H)                               │
│  • Over/Under 1.5 Goals (1H)                               │
│  • Over/Under 0.5/1.5/2.5 Goals (Full)                    │
│  • BTTS (Both Teams To Score)                              │
│  • Over 8 Corners                                          │
│                        ↓                                     │
│  DISPLAY (GREEN=High Confidence):                          │
│  Dashboard preview cards with visual indicators            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Prediction Markets (MVP)

### 1. **First Half Goals**
- **Over 0.5 FH Goals** - At least 1 goal by min 45
- **Over 1.5 FH Goals** - At least 2 goals by min 45
- **Under 0.5 FH Goals** - No goals in first half

**Factors:**
- Team pace (attacks/min) in last 5 matches
- First-half goal averaging (historical)
- Current live pace (if in-play)
- Match importance (league position, cup game)

### 2. **Full Match Goals**
- **Over 0.5** - Any goal
- **Over 1.5** - At least 2 goals
- **Over 2.5** - At least 3 goals
- **Under 2.5** - Max 2 goals

**Factors:**
- Full-match goal average (home + away)
- Team defensive strength (goals conceded)
- Possession-to-goal conversion
- Recent streaks (high-scoring vs defensive)

### 3. **Both Teams To Score (BTTS)**
- **BTTS Yes** - Both teams score at least 1
- **BTTS No** - One team doesn't score

**Factors:**
- Defensive vulnerability (team's goals conceded / 90 min)
- Offensive strength (goals scored / 90 min)
- H2H BTTS frequency
- Match stakes (tight fixture = defensive)

### 4. **Corners**
- **Over 8 Corners** - 9+ total corners
- **Over 9/10/11 Corners** - Additional thresholds
- **Under 7.5 Corners** - Few corners

**Factors:**
- Average corners per team per match
- Team crossing style (wing-play teams)
- Defensive setup (offside trap corners)
- Referee tendency (flags fouls = more corners)

### 5. **Cards**
- **Over 4.5 Yellow Cards** - 5+ yellows
- **Over 5.5 Yellow Cards** - 6+ yellows

**Factors:**
- Team discipline (yellow cards conceded)
- Match intensity (league, rivalry, relegation battle)
- Referee reputation (strict vs lenient)
- H2H red card frequency

---

## 📐 Statistical Models

### **Model 1: Poisson Regression (Goals Prediction)**

```
Goals ~ λ where λ = exp(β₀ + β₁·attack_strength + β₂·defense_weakness + β₃·home_advantage)

attack_strength = avg_goals_scored / avg_possession
defense_weakness = avg_goals_conceded / avg_possession_conceded
home_advantage = 1.2 if home_team else 0.8
```

**Interpretation:**
- Poisson model = probability of 0, 1, 2, 3+ goals
- P(Over 1.5) = P(2 goals) + P(3+) = sum of Poisson probabilities
- Calibrate λ with recent form weight (last 3 matches = 60% weight, rest = 40%)

### **Model 2: Logistic Regression (BTTS Prediction)**

```
P(BTTS=Yes) = 1/(1 + e^(-z))
where z = β₀ + β₁·team_A_attack + β₂·team_A_defense + β₃·team_B_attack + β₄·team_B_defense + β₅·league_type
```

**Interpretation:**
- Output is 0-100% probability
- Green if > 60%, Amber if 40-60%, Red if < 40%

### **Model 3: Ensemble (Odds Calibration)**

Blend multiple signals:
- **40%**: Poisson/Logistic model
- **40%**: Implied odds probability (market consensus)
- **20%**: H2H pattern matching

**Why blend?** Bookmaker odds capture wisdom of crowd; models catch patterns.

---

## 💾 Database Schema (New Tables)

### **match_predictions** (Store model outputs)
```sql
CREATE TABLE match_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fixture_id INTEGER NOT NULL,
  home_team VARCHAR,
  away_team VARCHAR,
  league_name VARCHAR,
  
  -- FIRST HALF PREDICTIONS
  fh_over_0_5_probability FLOAT (0-100),
  fh_over_1_5_probability FLOAT,
  
  -- FULL MATCH PREDICTIONS
  fm_over_0_5_probability FLOAT,
  fm_over_1_5_probability FLOAT,
  fm_over_2_5_probability FLOAT,
  fm_under_2_5_probability FLOAT,
  
  -- BTTS
  btts_yes_probability FLOAT,
  btts_no_probability FLOAT,
  
  -- CORNERS
  corners_over_8_probability FLOAT,
  corners_over_9_probability FLOAT,
  
  -- CARDS
  cards_over_4_5_probability FLOAT,
  cards_over_5_5_probability FLOAT,
  
  -- CONFIDENCE & SOURCE
  confidence_score FLOAT (0-100), -- ensemble confidence
  model_inputs JSONB, -- what fed the model {avg_goals, team_form, odds, h2h_stats}
  odds_source VARCHAR, -- which bookmaker/source
  prediction_timestamp TIMESTAMP,
  match_start_time TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Search by match ID or date range
CREATE INDEX idx_match_predictions_fixture_id ON match_predictions(fixture_id);
CREATE INDEX idx_match_predictions_match_start_time ON match_predictions(match_start_time);
```

### **prediction_outcomes** (Log results for training)
```sql
CREATE TABLE prediction_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id UUID REFERENCES match_predictions(id),
  fixture_id INTEGER,
  
  -- ACTUAL OUTCOMES
  actual_fh_goals INTEGER,
  actual_fm_goals INTEGER,
  actual_corners INTEGER,
  actual_yellow_cards INTEGER,
  actual_btts BOOLEAN,
  
  -- PREDICTION VS REALITY
  fh_over_0_5_hit BOOLEAN, -- Did prediction match actual?
  fm_over_1_5_hit BOOLEAN,
  btts_yes_hit BOOLEAN,
  corners_over_8_hit BOOLEAN,
  
  -- ACCURACY TRACKING
  hit_count INTEGER, -- How many markets hit
  total_markets INTEGER, -- Total predicted markets
  accuracy_rate FLOAT (0-100),
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_prediction_outcomes_fixture_id ON prediction_outcomes(fixture_id);
```

---

## 🔌 API Design

### **GET /api/predictions/match/:fixtureId**
Get predictions for a specific match

**Request:**
```bash
GET /api/predictions/match/123456?include=all
```

**Response:**
```json
{
  "fixtureId": 123456,
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  "predictions": {
    "firstHalf": {
      "over_0_5": {
        "probability": 78,
        "confidence": 82,
        "reasoning": "Arsenal averages 0.9 goals/FH; Chelsea concedes 0.6/FH"
      },
      "over_1_5": {
        "probability": 42,
        "confidence": 68
      }
    },
    "fullMatch": {
      "over_0_5": { "probability": 96, "confidence": 95 },
      "over_1_5": { "probability": 78, "confidence": 85 },
      "over_2_5": { "probability": 52, "confidence": 72 }
    },
    "btts": {
      "yes": { "probability": 68, "confidence": 79 },
      "no": { "probability": 32, "confidence": 79 }
    },
    "corners": {
      "over_8": { "probability": 62, "confidence": 71 }
    }
  },
  "modelInputs": {
    "homeTeamAvgGoals": 2.1,
    "awayTeamAvgGoals": 1.8,
    "homeTeamAvgKeepsClean": 35,
    "h2hBttsFrequency": 0.67,
    "impliedOddsOver2_5": 0.55
  },
  "updatedAt": "2026-02-17T14:30:00Z"
}
```

### **POST /api/predictions/batch**
Calculate predictions for all matches on a date

**Request:**
```json
{
  "date": "2026-02-17",
  "leagues": ["eng.1", "eng.2", "esp.1"],
  "includeOdds": true
}
```

**Response:**
```json
{
  "date": "2026-02-17",
  "predictions": [
    { "fixtureId": 123456, "predictions": {...} },
    { "fixtureId": 123457, "predictions": {...} }
  ],
  "generatedAt": "2026-02-17T14:30:00Z"
}
```

---

## 🎨 UI Component Design

### **MatchPredictionCard** (Display after each match card)

```tsx
// Visual hierarchy:
// 1. Title: "📊 Today's Predictions"
// 2. Grid of vertically-oriented prediction items:
//
//    ┌─────────────────────────┐
//    │ Over 0.5 FH Goals       │
//    │ 🟢 78% Likely           │  ← Green = 70%+, Amber = 50-70%, Red = <50%
//    │ ───────────────────     │
//    │ Arsenal pace: 0.9/FH    │  ← Quick reasoning
//    │ Chelsea defense: 0.6/FH │
//    └─────────────────────────┘
//
//    ┌─────────────────────────┐
//    │ Over 1.5 FH Goals       │
//    │ 🟡 42% Likely           │  ← Amber
//    │ ───────────────────     │
//    │ Slower start expected   │
//    └─────────────────────────┘
//
//    ┌─────────────────────────┐
//    │ Over 2.5 Full Match     │
//    │ 🟡 52% Likely           │
//    │ ───────────────────     │
//    │ H2H avg: 2.7 goals      │
//    └─────────────────────────┘
//
//    ┌─────────────────────────┐
//    │ BTTS Yes                │
//    │ 🟢 68% Likely           │
//    │ ───────────────────     │
//    │ 67% of H2H have BTTS    │
//    └─────────────────────────┘
//
//    ┌─────────────────────────┐
//    │ Over 8 Corners          │
//    │ 🟡 62% Likely           │
//    │ ───────────────────     │
//    │ Arsenal wing-heavy play │
//    └─────────────────────────┘
```

**Color Logic:**
- 🟢 **Green (70%+)**: High confidence - likely to hit
- 🟡 **Amber (50-70%)**: Moderate confidence - toss-up
- 🔴 **Red (<50%)**: Low confidence - unlikely

### **Visual Indicators:**
```
Probability Bar:
│████████░░│ 78% - High
│██████░░░░│ 59% - Moderate
│███░░░░░░░│ 28% - Low
```

---

## 📋 Implementation Roadmap

### **Phase 1: Core Engine (Week 1)**
1. Create `lib/prediction-engine.ts` - Poisson & Logistic models
2. Create `lib/prediction-models.ts` - Market-specific logic
3. Add database tables (migrations)
4. Create `/api/predictions/match/:id` endpoint

### **Phase 2: Data Aggregation (Week 1-2)**
1. Enhance `lib/unified-api.ts` to fetch H2H + form data automatically
2. Create helper: `aggregateMatchContext()` - consolidates all input data
3. Create helper: `calculateTeamStats()` - attack strength, defense weakness
4. Create helper: `calibrateWithOdds()` - blend model with market odds

### **Phase 3: Dashboard UI (Week 2)**
1. Create `components/MatchPredictionCard.tsx` - Display predictions
2. Add to `app/dashboard/matches/page.tsx` - Show after each match
3. Style with Tailwind + color indicators
4. Add tooltips explaining predictions

### **Phase 4: Training Loop (Week 3)**
1. Create `/api/predictions/log-outcome` endpoint
2. Add cron job to log results daily
3. Create `lib/model-trainer.ts` - Calculate accuracy, retrain model weights
4. Add dashboard stats: "Model accuracy last 30 days: 72%"

### **Phase 5: Optimization (Week 4)**
1. Cache predictions for 1 hour
2. Pre-compute for all daily matches at 7am
3. Add A/B testing: compare model vs odds on specific markets
4. Create analytics: which leagues/teams are most predictable

---

## 🚀 Key Implementation Details

### **Statistical Aggregation Function**
```typescript
async function aggregateMatchContext(match: LiveMatch) {
  // 1. Get team form (last 10 matches)
  const homeForm = await getTeamForm(match.teams.home.id);
  const awayForm = await getTeamForm(match.teams.away.id);
  
  // 2. Calculate team statistics
  const homeStats = calculateTeamStats(homeForm); // avg goals, defense, pace
  const awayStats = calculateTeamStats(awayForm);
  
  // 3. Get H2H history
  const h2h = await getH2HMatches(match.teams.home.id, match.teams.away.id);
  
  // 4. Get odds and implied probabilities
  const odds = await getOddsForMatch(match.fixture.id);
  const impliedProbs = parseOdds(odds); // convert to probabilities
  
  // 5. Get live stats (if match in-play)
  const liveStats = extractLiveStats(match);
  
  return {
    homeTeam: { stats: homeStats, form: homeForm, liveStats },
    awayTeam: { stats: awayStats, form: awayForm, liveStats },
    h2h,
    impliedProbs,
    matchContext: { league: match.league, isHomeGame: true, kickOff: match.fixture.date }
  };
}
```

### **Poisson Model for Goals**
```typescript
function predictGoals(context: MatchContext): PredictionResult {
  const homeAttack = context.homeTeam.stats.avgGoals * 1.2; // home advantage
  const homeLambda = Math.exp(
    Math.log(homeAttack) - 
    Math.log(context.awayTeam.stats.avgGoalsConceded) * 0.3 +
    recentFormFactor(context.homeTeam.form) * 0.1
  );
  
  // Calculate probabilities
  const p0 = poissonPDF(0, homeLambda);
  const p1 = poissonPDF(1, homeLambda);
  const p2 = poissonPDF(2, homeLambda);
  const p3Plus = 1 - p0 - p1 - p2;
  
  return {
    over0_5: (p1 + p2 + p3Plus) * 100, // At least 1 goal
    over1_5: (p2 + p3Plus) * 100,      // At least 2 goals
    over2_5: p3Plus * 100               // 3+ goals
  };
}
```

### **Blend with Odds**
```typescript
function blendPredictions(modelProb: number, impliedOddProb: number, confidence: number): BlendedPrediction {
  // 40% model, 40% odds, 20% recent form
  const blended = (
    modelProb * 0.4 +
    impliedOddProb * 0.4 +
    recentAccuracy * 0.2
  );
  
  return {
    probability: blended,
    confidence: Math.min(confidence, 100), // confidence from inputs
    reasoning: generateReasoning(modelProb, impliedOddProb, confidence)
  };
}
```

---

## 📊 Confidence Scoring

**Factors that INCREASE confidence:**
- More historical data (last 20 matches vs 5)
- Agreement between model & odds (both say 75%)
- Recent consistency (last 5 matches all had 2+ goals)
- High sample size in H2H (10+ historic matchups)

**Factors that DECREASE confidence:**
- Limited data (first season for team)
- Disagreement between sources (model 75%, odds 55%)
- High volatility (last 5 matches: 0, 4, 1, 3, 2 goals)
- Injury news / team rotation

**Confidence = function(data_quality, source_agreement, consistency, relevance)**

---

## 🔄 Training Loop

**Daily (at 11pm UTC):**
1. Fetch all completed matches from the day
2. For each prediction made: compare to actual outcome
3. Log into `prediction_outcomes` table
4. Calculate accuracy rate (70%, 80%, etc.)
5. Adjust model weights if accuracy <65%

**Monthly:**
1. Retrain models on last 30 days of data
2. Test on holdout set (last 7 days of predictions)
3. Update model coefficients if improvement >2%

---

## 🎯 Success Metrics

- **Accuracy Target:** 70%+ accuracy on Over/Under markets
- **Hit Rate:** 65%+ of predicted markets hit within 5%
- **User Adoption:** 40%+ of users view predictions per day
- **Engagement:** 30% click-through to place bet or analyze further

---

## 📚 References & Research

**Statistical Models:**
- Poisson Regression for goal prediction (standard in sports analytics)
- Logistic Regression for binary outcomes (BTTS)
- Ensemble methods (average predictions from multiple models)

**Sources:**
- TeamForm API (team history)
- H2H API (historical matchups)
- Odds API (market consensus)
- UnifiedAPI (live stats + ESPN sync)

**Improvements Over Time:**
- V2: Add player injury impacts
- V3: Add weather data (rain = more fouls/cards)
- V4: Add manager tactics (formation, aggressive play)
- V5: Real-time model updates as match progresses

---

## ✅ Implementation Checklist

- [ ] Create database schema (migrations)
- [ ] Implement `lib/prediction-engine.ts`
- [ ] Implement `lib/prediction-models.ts`
- [ ] Create `/api/predictions/match/:id`
- [ ] Create `components/MatchPredictionCard.tsx`
- [ ] Integrate into `/dashboard/matches`
- [ ] Create `/api/predictions/log-outcome`
- [ ] Set up daily cron for outcome logging
- [ ] Create accuracy dashboard
- [ ] Test on 2 weeks of historical data
- [ ] Deploy to production
- [ ] Monitor accuracy & user engagement

---

## 🎓 Learning Resources

1. **Poisson Goal Modeling:** https://en.wikipedia.org/wiki/Poisson_regression
2. **Sports Data Science:** "The Unofficial Football Statistics Handbook"
3. **Ensemble Methods:** Bagging, boosting, stacking blend
4. **Validation:** K-fold cross-validation on match data

---

**Next Step:** Choose Phase 1 to start with (recommend starting with prediction engine + database).
Would you like me to begin implementation?
