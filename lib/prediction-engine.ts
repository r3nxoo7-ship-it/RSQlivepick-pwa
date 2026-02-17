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
 * Blend model prediction with implied odds probability
 * Formula: 0.4*model + 0.4*odds + 0.2*h2h_pattern
 */
export function blendPredictions(
  modelProbability: number,
  impliedOddsProbability: number,
  h2hProbability: number = 50,
  confidence: number = 75
): {
  blended: number;
  confidence: number;
  reasoning: string;
} {
  const blended = (
    modelProbability * 0.4 +
    impliedOddsProbability * 0.4 +
    h2hProbability * 0.2
  );
  
  // Confidence increases if sources agree
  const maxDiff = Math.max(
    Math.abs(modelProbability - impliedOddsProbability),
    Math.abs(modelProbability - h2hProbability),
    Math.abs(impliedOddsProbability - h2hProbability)
  );
  
  const agreementBonus = Math.max(0, 25 - (maxDiff / 10)); // ±25% swing based on disagreement
  const finalConfidence = Math.min(100, confidence + agreementBonus);
  
  let reasoning = '';
  if (modelProbability > impliedOddsProbability + 10) {
    reasoning = 'Model suggests value vs market odds';
  } else if (impliedOddsProbability > modelProbability + 10) {
    reasoning = 'Market odds suggest value bet';
  } else {
    reasoning = 'Model and odds agree';
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
  
  // Get H2H probabilities for blending
  const h2hOverUnderProb = (context.h2hStats.avgGoalsHome + context.h2hStats.avgGoalsAway) > 2.5 ? 65 : 35;
  
  // Blend each market
  const over1_5_Full = blendPredictions(
    fullMatchGoals.over1_5,
    (context.impliedOdds.over1_5 * 100),
    h2hOverUnderProb,
    80
  );
  
  const bttsBlended = blendPredictions(
    bttsResults.yes,
    (context.impliedOdds.bttsYes * 100),
    ((context.h2hStats.bttsFrequency) * 100),
    85
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
          probability: fullMatchGoals.over2_5,
          confidence: 65,
          reasoning: `H2H average: ${context.h2hStats.avgGoalsHome + context.h2hStats.avgGoalsAway} goals`,
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
    overallConfidence: 75,
    bestValue: [
      {
        market: 'Over 1.5 Goals',
        probability: over1_5_Full.blended,
        reason: 'Model slightly favors over vs market odds',
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
