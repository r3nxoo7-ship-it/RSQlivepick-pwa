/**
 * Prediction Engine - Core ML Models
 * Implements Poisson regression, Logistic regression, and Ensemble methods
 * for predicting football match outcomes
 */

import { LiveMatch } from '@/lib/unified-api';

// ============================================
// INTERFACES
// ============================================

export interface TeamStatistics {
  teamId: string;
  teamName: string;
  matchesAnalyzed: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  avgCorners: number;
  avgShotsOnTarget: number;
  avgPossession: number;
  avgYellowCards: number;
  cleanSheetPercentage: number; // % of matches with 0 goals conceded
  recentForm: number; // 0-100, weighted average of last 5 matches
  homeAdvantage: number; // 1.2 if typically scores more at home, 0.8 if away team
}

export interface MatchContext {
  homeTeam: TeamStatistics;
  awayTeam: TeamStatistics;
  h2hStats: {
    homeWins: number;
    awayWins: number;
    draws: number;
    avgGoalsHome: number;
    avgGoalsAway: number;
    bttsFrequency: number; // 0-1
    cornersAverage: number;
    totalMatches: number;
  };
  impliedOdds: {
    over0_5: number; // 0-1 probability
    over1_5: number;
    over2_5: number;
    bttsYes: number;
    bttsNo: number;
  };
  matchContext: {
    isHomeTeamHome: boolean;
    matchImportance: 'league' | 'cup' | 'relegation' | 'title'; // affects intensity
    refereeStrictness?: 'lenient' | 'normal' | 'strict'; // affects cards
  };
}

export interface PredictionResult {
  market: string;
  probability: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  modelBreakdown?: {
    poissonProbability?: number;
    logisticProbability?: number;
    impliedOddsProbability?: number;
    h2hProbability?: number;
  };
}

export interface FullPredictions {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  predictionTimestamp: Date;
  matchKickoff: Date;
  predictions: {
    firstHalf: {
      over0_5: PredictionResult;
      over1_5: PredictionResult;
    };
    fullMatch: {
      over0_5: PredictionResult;
      over1_5: PredictionResult;
      over2_5: PredictionResult;
    };
    btts: {
      yes: PredictionResult;
      no: PredictionResult;
    };
    corners: {
      over8: PredictionResult;
      over9: PredictionResult;
    };
    cards: {
      over4_5: PredictionResult;
    };
  };
  overallConfidence: number;
  bestValue: {
    market: string;
    probability: number;
    reason: string;
  }[];
}

// ============================================
// POISSON REGRESSION (Goals Prediction)
// ============================================

/**
 * Calculate Poisson probability: P(X = k) = (λ^k * e^-λ) / k!
 */
function poissonPDF(k: number, lambda: number): number {
  const javaFactorial = (n: number): number => {
    if (n <= 1) return 1;
    return n * javaFactorial(n - 1);
  };

  const numerator = Math.pow(lambda, k) * Math.exp(-lambda);
  const denominator = javaFactorial(k);
  return numerator / denominator;
}

/**
 * Poisson CDF: P(X <= k) = sum of P(X=i) for i=0..k
 * Used to derive "over N" probabilities from H2H average goals
 */
function poissonCDF(k: number, lambda: number): number {
  let cdf = 0;
  for (let i = 0; i <= k; i++) {
    cdf += poissonPDF(i, lambda);
  }
  return Math.min(1, cdf);
}

/**
 * Convert H2H average goals into over/under probabilities (continuous, not binary).
 * Returns P(goals > threshold) based on historical average using Poisson CDF.
 * Falls back to neutral 50% when insufficient H2H data.
 */
function h2hToOverProb(avgGoals: number, threshold: number, h2hMatches: number): number {
  if (h2hMatches < 3) return 50; // too few meetings to trust
  const prob = (1 - poissonCDF(Math.floor(threshold), avgGoals)) * 100;
  return Math.round(Math.max(5, Math.min(95, prob)));
}

/**
 * Calculate goals distribution for one team
 * Uses team attack strength vs opponent defense weakness
 */
function predictTeamGoals(
  attackingTeam: TeamStatistics,
  defendingTeam: TeamStatistics,
  isHomeTeam: boolean
): { lambda: number; probabilities: Record<number, number> } {
  // Base lambda from historical average
  let lambda = attackingTeam.avgGoalsScored;
  
  // Adjust for opponent defense
  const defenseAdjustment = defendingTeam.avgGoalsConceded / 1.5; // Average conceded suggests defense weakness
  lambda = lambda * (defenseAdjustment / 1.5); // Normalize to ~1.5 avg conceded
  
  // Home advantage multiplier
  if (isHomeTeam) {
    lambda *= attackingTeam.homeAdvantage;
  } else {
    lambda *= (2 - attackingTeam.homeAdvantage); // Away penalty
  }
  
  // Recent form adjustment (±15%) — clamp to avoid extreme values
  // form=0 → 0.85, form=50 → 1.0, form=100 → 1.15
  const formFactor = 0.85 + (Math.max(0, Math.min(100, attackingTeam.recentForm)) / 100) * 0.3;
  lambda *= formFactor;
  
  // Calculate probabilities for 0, 1, 2, 3+ goals
  const probabilities: Record<number, number> = {
    0: poissonPDF(0, lambda),
    1: poissonPDF(1, lambda),
    2: poissonPDF(2, lambda),
    3: poissonPDF(3, lambda),
  };
  
  // Tail probability (4+ goals)
  probabilities[4] = Math.max(0, 1 - (probabilities[0] + probabilities[1] + probabilities[2] + probabilities[3]));
  
  return { lambda, probabilities };
}

/**
 * Predict full match goals using combined Poisson distributions
 */
export function predictFullMatchGoals(context: MatchContext): {
  over0_5: number;
  over1_5: number;
  over2_5: number;
  under2_5: number;
  expectedGoals: number;
} {
  const homeGoals = predictTeamGoals(context.homeTeam, context.awayTeam, true);
  const awayGoals = predictTeamGoals(context.awayTeam, context.homeTeam, false);
  
  // Convolve distributions: P(Total = n) = sum of P(Home=i) * P(Away=n-i)
  const totalDistribution: Record<number, number> = {};
  
  for (let home = 0; home <= 4; home++) {
    for (let away = 0; away <= 4; away++) {
      const total = home + away;
      if (!totalDistribution[total]) {
        totalDistribution[total] = 0;
      }
      totalDistribution[total] += homeGoals.probabilities[home] * awayGoals.probabilities[away];
    }
  }
  
  // Calculate cumulative probabilities: P(X > n) = 1 - P(X <= n)
  const over0_5 = 1 - (totalDistribution[0] || 0);
  const over1_5 = 1 - (totalDistribution[0] || 0) - (totalDistribution[1] || 0);
  const over2_5 = 1 - (totalDistribution[0] || 0) - (totalDistribution[1] || 0) - (totalDistribution[2] || 0);

  // Expected goals (E[X])
  const expectedGoals = homeGoals.lambda + awayGoals.lambda;

  return {
    over0_5: Math.round(Math.max(0, Math.min(1, over0_5)) * 100),
    over1_5: Math.round(Math.max(0, Math.min(1, over1_5)) * 100),
    over2_5: Math.round(Math.max(0, Math.min(1, over2_5)) * 100),
    under2_5: 100 - Math.round(Math.max(0, Math.min(1, over2_5)) * 100),
    expectedGoals,
  };
}

/**
 * Predict first half goals (typically 35-40% of final goals)
 */
export function predictFirstHalfGoals(context: MatchContext): {
  over0_5: number;
  over1_5: number;
} {
  // First half goals: use Poisson with ~42% of full-match lambda
  // (empirical: ~42% of goals in top leagues happen in 1st half)
  const homeGoals = predictTeamGoals(context.homeTeam, context.awayTeam, true);
  const awayGoals = predictTeamGoals(context.awayTeam, context.homeTeam, false);
  const fhHomeLambda = homeGoals.lambda * 0.42;
  const fhAwayLambda = awayGoals.lambda * 0.42;

  // Convolve first-half distributions
  const fhDist: Record<number, number> = {};
  for (let h = 0; h <= 3; h++) {
    for (let a = 0; a <= 3; a++) {
      const total = h + a;
      if (!fhDist[total]) fhDist[total] = 0;
      fhDist[total] += poissonPDF(h, fhHomeLambda) * poissonPDF(a, fhAwayLambda);
    }
  }

  const fhOver0_5 = 1 - (fhDist[0] || 0);
  const fhOver1_5 = 1 - (fhDist[0] || 0) - (fhDist[1] || 0);

  return {
    over0_5: Math.round(Math.max(0, Math.min(1, fhOver0_5)) * 100),
    over1_5: Math.round(Math.max(0, Math.min(1, fhOver1_5)) * 100),
  };
}

// ============================================
// LOGISTIC REGRESSION (Binary Outcomes)
// ============================================

/**
 * Sigmoid function: 1/(1 + e^-z)
 */
function sigmoid(z: number): number {
  // Clamp z to prevent overflow
  const clamped = Math.max(-50, Math.min(50, z));
  return 1 / (1 + Math.exp(-clamped));
}

/**
 * Predict BTTS (Both Teams To Score)
 * Factors: offensive strength of both teams, defensive weakness of both teams
 */
export function predictBTTS(context: MatchContext): {
  yes: number;
  no: number;
} {
  // Calculate team scoring likelihood
  const homeScoresProb = 1 - poissonPDF(0, predictTeamGoals(context.homeTeam, context.awayTeam, true).lambda);
  const awayScoresProb = 1 - poissonPDF(0, predictTeamGoals(context.awayTeam, context.homeTeam, false).lambda);
  
  // BTTS = both score at least 1
  // cleanSheetPercentage is 0-100, normalize to 0-1 for sigmoid
  const cleanSheetRate = (context.homeTeam.cleanSheetPercentage + context.awayTeam.cleanSheetPercentage) / 200;

  // Logistic model: incorporate H2H BTTS frequency
  const z =
    (homeScoresProb - 0.5) * 2 + // offensive strength
    (awayScoresProb - 0.5) * 2 + // opposing offense
    (cleanSheetRate - 0.3) * (-2) + // defensive factor (avg ~30% clean sheets)
    (context.h2hStats.bttsFrequency - 0.5) * 1.5; // H2H pattern
  
  const bttsYesProbability = sigmoid(z);
  
  return {
    yes: Math.round(bttsYesProbability * 100),
    no: Math.round((1 - bttsYesProbability) * 100),
  };
}

/**
 * Predict Corners
 * Factors: team possession, crossing style, opponent defensive setup
 */
export function predictCorners(context: MatchContext): {
  over8: number;
  over9: number;
  expectedCorners: number;
} {
  // Average of team averages (corners tend to correlate with possession)
  const avgTeamCorners = (context.homeTeam.avgCorners + context.awayTeam.avgCorners) / 2;
  
  // Possession factor: more possession = more corners
  const possessionDiff = Math.abs(context.homeTeam.avgPossession - context.awayTeam.avgPossession);
  const possessionFactor = 1 + (possessionDiff / 100) * 0.3; // ±30% swing
  
  // H2H pattern
  const h2hFactor = context.h2hStats.cornersAverage / 8.5; // Normalize to 8.5 corners average
  
  // Expected corners
  const expectedCorners = avgTeamCorners * possessionFactor * (h2hFactor / 1);
  
  // Use Poisson CDF: P(X > n) = 1 - sum(P(X=k) for k=0..n)
  let cdf8 = 0; // P(X <= 8)
  let cdf9 = 0; // P(X <= 9)
  for (let k = 0; k <= 9; k++) {
    const p = poissonPDF(k, expectedCorners);
    if (k <= 8) cdf8 += p;
    cdf9 += p;
  }

  return {
    over8: Math.round(Math.max(0, Math.min(1, 1 - cdf8)) * 100),
    over9: Math.round(Math.max(0, Math.min(1, 1 - cdf9)) * 100),
    expectedCorners: Math.round(expectedCorners * 10) / 10,
  };
}

/**
 * Predict Yellow Cards
 * Factors: team discipline, match intensity, referee reputation
 */
export function predictYellowCards(context: MatchContext): {
  over4_5: number;
  expectedCards: number;
} {
  const avgTeamCards = (context.homeTeam.avgYellowCards + context.awayTeam.avgYellowCards) / 2;
  
  // Match importance multiplier (cup/relegation = more cards)
  let intensityMultiplier = 1;
  if (context.matchContext.matchImportance === 'relegation') {
    intensityMultiplier = 1.4;
  } else if (context.matchContext.matchImportance === 'cup') {
    intensityMultiplier = 1.2;
  }
  
  // Referee strictness
  const refereeMultiplier = context.matchContext.refereeStrictness === 'strict' ? 1.3 :
    context.matchContext.refereeStrictness === 'lenient' ? 0.7 : 1;
  
  const expectedCards = avgTeamCards * intensityMultiplier * refereeMultiplier;
  
  return {
    over4_5: Math.round((1 - poissonPDF(0, expectedCards) - poissonPDF(1, expectedCards) - 
      poissonPDF(2, expectedCards) - poissonPDF(3, expectedCards) - poissonPDF(4, expectedCards)) * 100),
    expectedCards: Math.round(expectedCards * 10) / 10,
  };
}

// ============================================
// ENSEMBLE BLENDING
// ============================================

/**
 * Blend model prediction with implied odds + H2H pattern.
 * Weights are dynamic based on data quality:
 *  - Good form + good H2H: 45% form, 35% odds, 20% H2H
 *  - No form data (new leagues): 20% form, 30% odds, 50% H2H (lean on history)
 *  - No H2H data: 55% form, 45% odds, 0% H2H
 *  - Neither: 50% odds, 50% form-defaults
 */
export function blendPredictions(
  modelProbability: number,
  impliedOddsProbability: number,
  h2hProbability: number = 50,
  confidence: number = 75,
  dataWeights?: { formMatches: number; h2hMatches: number }
): {
  blended: number;
  confidence: number;
  reasoning: string;
} {
  const formMatches = dataWeights?.formMatches ?? 10;
  const h2hMatches = dataWeights?.h2hMatches ?? 5;

  const hasGoodForm = formMatches >= 5;
  const hasGoodH2H  = h2hMatches >= 3;

  let wModel: number, wOdds: number, wH2H: number;
  if (hasGoodForm && hasGoodH2H) {
    // Both sources available — balanced, slight form preference
    wModel = 0.45; wOdds = 0.35; wH2H = 0.20;
  } else if (hasGoodForm && !hasGoodH2H) {
    // Form only — ignore H2H, boost form
    wModel = 0.55; wOdds = 0.45; wH2H = 0.00;
  } else if (!hasGoodForm && hasGoodH2H) {
    // New league / no recent data — lean heavily on H2H history
    wModel = 0.20; wOdds = 0.30; wH2H = 0.50;
  } else {
    // Neither — split evenly between model defaults and odds
    wModel = 0.50; wOdds = 0.50; wH2H = 0.00;
  }

  const blended = modelProbability * wModel + impliedOddsProbability * wOdds + h2hProbability * wH2H;

  // Confidence: penalise when form & H2H disagree strongly
  const maxDiff = Math.max(
    Math.abs(modelProbability - impliedOddsProbability),
    Math.abs(modelProbability - h2hProbability),
    Math.abs(impliedOddsProbability - h2hProbability)
  );
  const agreementBonus = Math.max(0, 25 - maxDiff / 10);

  // Cap maximum confidence based on data quality:
  // - No H2H + sparse form → max 72% (we really don't know)
  // - Good form but no H2H → max 85%
  // - Good H2H but sparse form → max 82%
  // - Both available → allow up to 95%
  let maxConfidence: number;
  if (!hasGoodForm && !hasGoodH2H) maxConfidence = 72;
  else if (!hasGoodH2H) maxConfidence = 85;
  else if (!hasGoodForm) maxConfidence = 82;
  else maxConfidence = 95;

  const finalConfidence = Math.min(maxConfidence, confidence + agreementBonus);

  let reasoning = '';
  if (!hasGoodForm && hasGoodH2H) {
    reasoning = `H2H history dominates (${h2hMatches} meetings, limited recent form)`;
  } else if (hasGoodForm && !hasGoodH2H) {
    reasoning = `Recent form dominates (${formMatches} matches, no H2H data)`;
  } else if (modelProbability > impliedOddsProbability + 10) {
    reasoning = 'Recent form suggests value vs market odds';
  } else if (impliedOddsProbability > modelProbability + 10) {
    reasoning = 'Market odds suggest value';
  } else {
    reasoning = 'Form and H2H agree';
  }

  return {
    blended: Math.round(blended),
    confidence: Math.round(finalConfidence),
    reasoning,
  };
}

// ============================================
// FULL PREDICTION PIPELINE
// ============================================

/**
 * Generate complete predictions for a match
 */
export function generateFullPredictions(
  fixtureId: number,
  homeTeam: string,
  awayTeam: string,
  context: MatchContext,
  matchKickoff: Date
): FullPredictions {
  // Generate model predictions for each market
  const fullMatchGoals = predictFullMatchGoals(context);
  const firstHalfGoals = predictFirstHalfGoals(context);
  const bttsResults = predictBTTS(context);
  const cornersResults = predictCorners(context);
  const cardsResults = predictYellowCards(context);

  // Data availability metadata — drives dynamic blend weights
  const formMatches = Math.min(context.homeTeam.matchesAnalyzed, context.awayTeam.matchesAnalyzed);
  const h2hMatches  = context.h2hStats.totalMatches;
  const dataWeights = { formMatches, h2hMatches };

  // Continuous H2H goal probabilities (Poisson CDF, not binary 65/35)
  const h2hTotalGoals = context.h2hStats.avgGoalsHome + context.h2hStats.avgGoalsAway;
  const h2hOver1_5Prob = h2hToOverProb(h2hTotalGoals, 1, h2hMatches);
  const h2hOver2_5Prob = h2hToOverProb(h2hTotalGoals, 2, h2hMatches);
  const h2hBTTSProb    = Math.round(context.h2hStats.bttsFrequency * 100);

  // Blend each market with dynamic weights
  const over1_5_Full = blendPredictions(
    fullMatchGoals.over1_5,
    context.impliedOdds.over1_5 * 100,
    h2hOver1_5Prob,
    80,
    dataWeights
  );

  const over2_5_Full = blendPredictions(
    fullMatchGoals.over2_5,
    context.impliedOdds.over2_5 * 100,
    h2hOver2_5Prob,
    70,
    dataWeights
  );

  const bttsBlended = blendPredictions(
    bttsResults.yes,
    context.impliedOdds.bttsYes * 100,
    h2hBTTSProb,
    85,
    dataWeights
  );
  
  return {
    fixtureId,
    homeTeam,
    awayTeam,
    predictionTimestamp: new Date(),
    matchKickoff,
    predictions: {
      firstHalf: {
        over0_5: {
          market: 'Over 0.5 FH Goals',
          probability: firstHalfGoals.over0_5,
          confidence: 78,
          reasoning: `${homeTeam} pace (${context.homeTeam.recentForm}%) vs ${awayTeam} defense (${context.awayTeam.cleanSheetPercentage}%)`,
        },
        over1_5: {
          market: 'Over 1.5 FH Goals',
          probability: firstHalfGoals.over1_5,
          confidence: 72,
          reasoning: `First half typically 35-40% of match goals`,
        },
      },
      fullMatch: {
        over0_5: {
          market: 'Over 0.5 Goals',
          probability: fullMatchGoals.over0_5,
          confidence: 95,
          reasoning: `Very likely at least 1 goal in modern football`,
        },
        over1_5: {
          market: 'Over 1.5 Goals',
          probability: over1_5_Full.blended,
          confidence: over1_5_Full.confidence,
          reasoning: over1_5_Full.reasoning,
        },
        over2_5: {
          market: 'Over 2.5 Goals',
          probability: over2_5_Full.blended,
          confidence: over2_5_Full.confidence,
          reasoning: over2_5_Full.reasoning,
        },
      },
      btts: {
        yes: {
          market: 'BTTS Yes',
          probability: bttsBlended.blended,
          confidence: bttsBlended.confidence,
          reasoning: bttsBlended.reasoning,
        },
        no: {
          market: 'BTTS No',
          probability: 100 - bttsBlended.blended,
          confidence: bttsBlended.confidence,
          reasoning: `${homeTeam} clean sheets: ${context.homeTeam.cleanSheetPercentage}%`,
        },
      },
      corners: {
        over8: {
          market: 'Over 8 Corners',
          probability: cornersResults.over8,
          confidence: 71,
          reasoning: `Expected corners: ${cornersResults.expectedCorners}`,
        },
        over9: {
          market: 'Over 9 Corners',
          probability: cornersResults.over9,
          confidence: 68,
          reasoning: `${homeTeam} avg corners: ${context.homeTeam.avgCorners}`,
        },
      },
      cards: {
        over4_5: {
          market: 'Over 4.5 Yellow Cards',
          probability: cardsResults.over4_5,
          confidence: 62,
          reasoning: `Expected cards: ${cardsResults.expectedCards} (intensity: ${context.matchContext.matchImportance})`,
        },
      },
    },
    overallConfidence: Math.round((over1_5_Full.confidence + bttsBlended.confidence) / 2),
    bestValue: [
      {
        market: 'Over 1.5 Goals',
        probability: over1_5_Full.blended,
        reason: over1_5_Full.reasoning,
      },
      {
        market: 'BTTS Yes',
        probability: bttsBlended.blended,
        reason: bttsBlended.reasoning,
      },
    ],
  };
}

/**
 * Calculate confidence based on data quality
 */
export function calculateConfidenceScore(
  dataQuality: {
    historicalMatches: number;
    h2hMatches: number;
    dataRecency: number; // days since last match
    sourceAgreement: number; // 0-100
  }
): number {
  let confidence = 50; // base
  
  // More historical data = higher confidence
  confidence += Math.min(15, (dataQuality.historicalMatches / 20) * 15);
  
  // H2H data boost
  confidence += Math.min(15, (dataQuality.h2hMatches / 10) * 15);
  
  // Recency bonus (recent data = more accurate)
  if (dataQuality.dataRecency < 7) {
    confidence += 15;
  } else if (dataQuality.dataRecency < 14) {
    confidence += 10;
  }
  
  // Source agreement bonus
  confidence += (dataQuality.sourceAgreement / 100) * 15;
  
  return Math.min(100, confidence);
}
