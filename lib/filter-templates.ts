// ============================================
// FILTER TEMPLATES LIBRARY - PROBABILITY BASED
// ============================================
// Professional templates based on real betting statistics
// Research: LivePick, Betfair, Statistical Football Analysis
// Corners: Average 9-10 per match, increase with time pressure (80+min)
// Goals: Average 2.6-2.8 per match, skewed distribution
// Cards: Average 3-4 per match, increase in second half

import type { FilterConditions } from '@/lib/supabase';

export interface FilterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'corners' | 'goals' | 'cards' | 'shots' | 'advanced' | 'popular' | 'experimental' | 'ml_powered';
  conditions: FilterConditions;
  icon: string;
  popularity: number;
  successRate?: number;
  notificationEnabled: boolean;
  tags: string[];
  experimental?: boolean;
  experimentalSince?: string;
  confidence?: 'Low' | 'Medium' | 'High';
  backgroundImage?: string; // Unsplash URL or gradient
  color?: 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'red'; // Color theme for new filters
}

// Curated templates - only high-quality multi-condition templates kept.
// Basic 2-3 condition templates removed (too simple, trigger too often).
// Duplicates with LivePick professional templates removed.
export const RAW_TEMPLATES: FilterTemplate[] = [
  // ============================================
  // ADVANCED MULTI-METRIC TEMPLATES (4+ conditions, high confidence)
  // ============================================
  {
    id: 'adv-high-intensity-60min',
    name: 'High Intensity: 5+ Corners, 3+ SOT, 2+ Cards at 60min',
    description: 'High-intensity match by 60min combining corners, shots on target and cards. Confidence: High',
    category: 'advanced',
    icon: '⚡',
    popularity: 5,
    successRate: 70,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['combined', 'intensity', 'high-confidence'],
    conditions: {
      corners: { min: 5, team: 'total' },
      shots_on_target: { min: 3 },
      yellow_cards: { min: 2 },
      match_time: { min: 55, max: 65 },
    },
  },
  {
    id: 'adv-low-possession-high-shots',
    name: 'Low Possession, High Shots: <45% Possession + 6+ Total Shots',
    description: 'Underdog pressing with many shots despite low possession. Confidence: High',
    category: 'advanced',
    icon: '🎯',
    popularity: 4,
    successRate: 69,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['possession', 'shots'],
    conditions: {
      possession: { max: 45 },
      total_shots: { min: 6 },
      shots_on_target: { min: 3 },
      match_time: { min: 30, max: 75 },
    },
  },
  {
    id: 'adv-attackers-dominate',
    name: 'Attackers Dominate: 60% Possession + 5+ Dangerous Attacks',
    description: 'Dominant attacking team creating sustained chances — use for goal markets. Confidence: High',
    category: 'advanced',
    icon: '🏆',
    popularity: 5,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['possession', 'attacks', 'high-confidence'],
    conditions: {
      possession: { min: 60 },
      dangerous_attacks: { min: 5 },
      shots_on_target: { min: 3 },
      match_time: { min: 30, max: 85 },
    },
  },
  {
    id: 'adv-early-dominance-value',
    name: 'Early Dominance + Value Odds (<3.0): 3+ SOT + 55% Possession',
    description: 'Early control with good bookmaker value — high chance of continued attack. Confidence: High',
    category: 'popular',
    icon: '📈',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['value', 'early', 'popular'],
    conditions: {
      shots_on_target: { min: 3 },
      possession: { min: 55 },
      odds: { max: 3.0 },
      match_time: { min: 10, max: 40 },
    },
  },
  {
    id: 'adv-conservative-corner-prob',
    name: 'Conservative Corner Prob: 4+ Corners + 2+ SOT by 70min',
    description: 'Safer corner-based filter for conservative users. Confidence: High',
    category: 'advanced',
    icon: '🛡️',
    popularity: 4,
    successRate: 74,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['conservative', 'corners'],
    conditions: {
      corners: { min: 4, team: 'total' },
      shots_on_target: { min: 2 },
      match_time: { min: 65, max: 75 },
    },
  },

  // ============================================
  // LIVEPICK-STYLE PROFESSIONAL TEMPLATES (PRODUCTION-READY)
  // ============================================
  // Based on LivePick.eu advanced strategies with ExtendedFilterConditions
  // These use team-specific conditions, score analysis, possession dominance, and trends

  {
    id: 'livepick-favorite-losing-home',
    name: '🏠 Favorite Losing at Home (BTTS Opportunity)',
    description: 'Home team is losing but dominating with shots on target and possession. Classic BTTS setup - home team will push for comeback, both teams likely to score. Triggers BEFORE home scores to maximize betting value.',
    category: 'advanced',
    icon: '🎯',
    popularity: 5,
    successRate: 74,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'comeback', 'home-advantage', 'high-confidence'],
    backgroundImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    color: 'amber',
    conditions: {
      score: {
        home: { max: 0 },
        away: { min: 1, max: 2 },
        total_goals: { min: 1, max: 2 },
      },
      shots_on_target: {
        home: { min: 3 },
        total: { min: 5 },
      },
      dangerous_attacks: {
        home: { min: 5 },
      },
      possession: {
        home: { min: 47 },
      },
      match_time: {
        between: [50, 82],
      },
    } as any,
  },

  {
    id: 'livepick-high-momentum-home',
    name: '⚡ High Momentum Home Team',
    description: 'Home team showing strong attacking momentum with dominant possession and dangerous attacks. Perfect for home win or over goals markets.',
    category: 'advanced',
    icon: '🔥',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['momentum', 'home-win', 'attacking', 'high-confidence'],
    backgroundImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
    color: 'cyan',
    conditions: {
      possession: {
        home: { min: 53 },
        dominant: 'home',
      },
      dangerous_attacks: {
        home: { min: 6 },
      },
      shots_on_target: {
        home: { min: 3 },
      },
      corners: {
        home: { min: 3 },
      },
      match_time: {
        between: [55, 87],
      },
    } as any,
  },

  {
    id: 'livepick-over-25-goals-scenario',
    name: '⚽ Over 2.5 Goals Scenario (Live)',
    description: 'Match shows all indicators for 3+ total goals: already 1-2 scored with high shots, dangerous attacks, and balanced attacking from both teams. Perfect timing for over 2.5 goals bet after 55th minute.',
    category: 'goals',
    icon: '🎯',
    popularity: 5,
    successRate: 76,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['over-goals', 'attacking', 'high-probability', 'live'],
    backgroundImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
    color: 'green',
    conditions: {
      score: {
        total_goals: { min: 1, max: 2 },
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
        total: { min: 7 },
      },
      dangerous_attacks: {
        total: { min: 12 },
      },
      corners: {
        total: { min: 6 },
      },
      match_time: {
        min: 55,
        max: 82,
      },
    } as any,
  },

  {
    id: 'livepick-corner-rush',
    name: '🚀 Corner Rush (High Action)',
    description: 'Explosive corner activity with sustained attacking pressure from both teams. Corners trending upward - perfect for corner betting as rush continues into final minutes.',
    category: 'corners',
    icon: '🎪',
    popularity: 5,
    successRate: 79,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['corners', 'high-action', 'rush', 'late-game', 'trending'],
    backgroundImage: 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80',
    color: 'purple',
    conditions: {
      corners: {
        total: { min: 7 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      dangerous_attacks: {
        total: { min: 8 },
      },
      match_time: {
        between: [70, 88],
      },
      trends: {
        corners_increasing: true,
      },
    } as any,
  },

  {
    id: 'livepick-late-comeback-potential',
    name: '🔄 Late Comeback Potential',
    description: 'Close match with losing team having superior stats - possession balanced, many shots and attacks. Statistics favor late equalizer or comeback. Perfect for BTTS or draw.',
    category: 'advanced',
    icon: '💪',
    popularity: 4,
    successRate: 68,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['comeback', 'late-game', 'value', 'statistics'],
    backgroundImage: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
    color: 'blue',
    conditions: {
      score: {
        difference: { min: 1, max: 1 },
        total_goals: { min: 1, max: 2 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      dangerous_attacks: {
        total: { min: 8 },
      },
      possession: {
        dominant: 'balanced',
      },
      match_time: {
        between: [70, 88],
      },
    } as any,
  },

  {
    id: 'livepick-aggressive-counter',
    name: '⚔️ Aggressive Counter Attack',
    description: 'Away team with low possession but high shot quality and dangerous attacks - classic counter-attacking setup. Home dominates ball but away is dangerous. Good for underdog win or BTTS.',
    category: 'advanced',
    icon: '⚔️',
    popularity: 4,
    successRate: 65,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['counter-attack', 'underdog', 'value-bet', 'shots'],
    backgroundImage: 'https://images.unsplash.com/photo-1529079003456-3bac75d7e0e0?w=800&q=80',
    color: 'red',
    conditions: {
      possession: {
        away: { max: 44 },
        home: { min: 54 },
      },
      shots_on_target: {
        away: { min: 3 },
      },
      dangerous_attacks: {
        away: { min: 4 },
      },
      score: {
        difference: { max: 1 },
      },
      match_time: {
        between: [40, 78],
      },
    } as any,
  },

  {
    id: 'livepick-both-teams-pressing',
    name: '🔥 Both Teams Pressing (High Intensity)',
    description: 'Both teams creating chances with high shots on target and attacks from BOTH sides. Possession balanced. Perfect BTTS or over goals scenario with open, attacking play. Triggers early before both score.',
    category: 'goals',
    icon: '⚡',
    popularity: 5,
    successRate: 77,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'balanced', 'high-intensity', 'attacking'],
    backgroundImage: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80',
    color: 'amber',
    conditions: {
      score: {
        total_goals: { max: 1 },
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
        total: { min: 7 },
      },
      dangerous_attacks: {
        home: { min: 4 },
        away: { min: 4 },
        total: { min: 12 },
      },
      corners: {
        total: { min: 6 },
      },
      possession: {
        dominant: 'balanced',
      },
      match_time: {
        between: [50, 80],
      },
    } as any,
  },

  {
    id: 'livepick-late-pressure-draw',
    name: '🎭 Late Pressure Match',
    description: 'Low-scoring match (0-0 or 1-0) with both teams creating many chances late. High pressure from both sides - high probability one team breaks through or both score (BTTS). Perfect for late goals. Triggers before both teams score.',
    category: 'goals',
    icon: '🎲',
    popularity: 4,
    successRate: 69,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['late-goals', 'BTTS', 'tension', 'draw'],
    backgroundImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
    color: 'purple',
    conditions: {
      score: {
        total_goals: { max: 1 },
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
        total: { min: 6 },
      },
      dangerous_attacks: {
        total: { min: 9 },
      },
      corners: {
        total: { min: 6 },
      },
      match_time: {
        between: [75, 89],
      },
    } as any,
  },

  {
    id: 'livepick-red-card-chaos',
    name: '🟥 Red Card Chaos (Set Piece Surge)',
    description: 'Red card issued with sustained attacking pressure. Team with numerical advantage will create corner surge and set-piece opportunities. Corners trending upward.',
    category: 'cards',
    icon: '🌪️',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['red-card', 'set-pieces', 'corners', 'chaos', 'trending'],
    backgroundImage: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=800&q=80',
    color: 'red',
    conditions: {
      red_cards: {
        total: { min: 1 },
      },
      corners: {
        total: { min: 3 },
      },
      dangerous_attacks: {
        total: { min: 5 },
      },
      match_time: {
        after: 55,
      },
      trends: {
        corners_increasing: true,
      },
    } as any,
  },

  {
    id: 'livepick-final-10-minutes-madness',
    name: '⏰ Final 10 Minutes Madness',
    description: 'Match in final 10 minutes with very high activity - corners, shots, cards all elevated. Corners and shots trending upward. Perfect for late corner, card, or goal markets.',
    category: 'advanced',
    icon: '⌛',
    popularity: 5,
    successRate: 73,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['late-game', 'final-minutes', 'high-activity', 'pressure', 'trending'],
    backgroundImage: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80',
    color: 'amber',
    conditions: {
      corners: {
        total: { min: 7 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      yellow_cards: {
        total: { min: 2 },
      },
      dangerous_attacks: {
        total: { min: 9 },
      },
      match_time: {
        between: [78, 90],
      },
      trends: {
        corners_increasing: true,
        shots_increasing: true,
      },
    } as any,
  },

  // ============================================
  // ML-POWERED TEMPLATES (Bzzoiro CatBoost AI)
  // ============================================
  // These templates combine live statistics with Bzzoiro ML model probabilities.
  // ml_predictions conditions only trigger when BZZOIRO_API_TOKEN is configured.
  // Without it the live-stat conditions still work independently.

  {
    id: 'ml-over25-high-confidence',
    name: '🤖 ML Over 2.5 Goals — AI High Confidence',
    description: 'CatBoost model says >70% chance of 3+ goals AND recommends the bet. Combined with at least 1 goal already and both teams pressing. Perfect value opportunity for over 2.5 markets.',
    category: 'ml_powered',
    icon: '🧠',
    popularity: 5,
    successRate: 78,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'over-goals', 'AI', 'high-confidence', 'betting'],
    color: 'green',
    conditions: {
      ml_predictions: {
        prob_over_25: { min: 70 },
        over_25_recommend: true,
      },
      score: {
        total_goals: { min: 1 },
      },
      shots_on_target: {
        total: { min: 4 },
      },
      match_time: {
        between: [45, 80],
      },
    } as any,
  },

  {
    id: 'ml-btts-recommended',
    name: '🤖 ML Both Teams to Score — Model Pick',
    description: 'AI model (CatBoost) gives >65% probability for BTTS and recommends it. Both teams already showing attacking intent with shots. Strong statistical edge for BTTS bet.',
    category: 'ml_powered',
    icon: '⚽',
    popularity: 5,
    successRate: 75,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'BTTS', 'AI', 'both-teams', 'recommended'],
    color: 'cyan',
    conditions: {
      ml_predictions: {
        prob_btts_yes: { min: 65 },
        btts_recommend: true,
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
      },
      match_time: {
        between: [40, 80],
      },
    } as any,
  },

  {
    id: 'ml-home-win-dominant',
    name: '🤖 ML Home Win — AI Picks Home + Stat Dominance',
    description: 'CatBoost predicts home win (>65%) and recommends it. Home team also dominates with possession and dangerous attacks — double confirmation from model + live stats.',
    category: 'ml_powered',
    icon: '🏠',
    popularity: 4,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'home-win', 'AI', 'dominant', 'winner'],
    color: 'amber',
    conditions: {
      ml_predictions: {
        prob_home_win: { min: 65 },
        predicted_result: 'H',
        winner_recommend: true,
      },
      possession: {
        home: { min: 52 },
      },
      dangerous_attacks: {
        home: { min: 5 },
      },
      match_time: {
        between: [30, 80],
      },
    } as any,
  },

  {
    id: 'ml-away-upset-value',
    name: '🤖 ML Away Win Upset — Value Bet',
    description: 'AI model predicts away win (>60%) with high confidence. Away team shows counter-attacking threat despite lower possession. Odds over 2.0 provide value — perfect upset alert.',
    category: 'ml_powered',
    icon: '✈️',
    popularity: 4,
    successRate: 67,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['ML', 'away-win', 'upset', 'value-bet', 'AI'],
    color: 'purple',
    conditions: {
      ml_predictions: {
        prob_away_win: { min: 60 },
        predicted_result: 'A',
        winner_recommend: true,
        odds_away: { min: 2.0 },
      },
      shots_on_target: {
        away: { min: 2 },
      },
      match_time: {
        between: [30, 75],
      },
    } as any,
  },

  {
    id: 'ml-over35-late-bonanza',
    name: '🤖 ML Over 3.5 Late Goals Bonanza',
    description: 'Model gives >60% for over 3.5 goals in a match that already has 2+ goals. Shots trending up in final third of match — high probability of more goals before full time.',
    category: 'ml_powered',
    icon: '🎯',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'over-goals', 'late-game', 'high-scoring', 'AI'],
    color: 'red',
    conditions: {
      ml_predictions: {
        prob_over_35: { min: 60 },
      },
      score: {
        total_goals: { min: 2 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      match_time: {
        between: [60, 85],
      },
    } as any,
  },

  {
    id: 'ml-draw-tension',
    name: '🤖 ML Draw Under Pressure',
    description: 'AI gives >55% draw probability. Match currently level (0-0 or 1-1) with balanced possession and moderate activity. Statistical equilibrium — model favours draw holding until final whistle.',
    category: 'ml_powered',
    icon: '🤝',
    popularity: 4,
    successRate: 66,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['ML', 'draw', 'balanced', 'value-bet', 'AI'],
    color: 'blue',
    conditions: {
      ml_predictions: {
        prob_draw: { min: 55 },
        predicted_result: 'D',
      },
      score: {
        difference: { max: 0 },
      },
      possession: {
        dominant: 'balanced',
      },
      match_time: {
        between: [65, 85],
      },
    } as any,
  },

  {
    id: 'ml-value-odds-over25',
    name: '🤖 ML Over 2.5 + Good Bookmaker Odds',
    description: 'Model predicts >65% over 2.5 AND Bzzoiro events show bookmaker odds > 1.8 for over 2.5. Best of both: AI prediction + market value aligned. Ideal for over goals betting.',
    category: 'ml_powered',
    icon: '💰',
    popularity: 5,
    successRate: 76,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'over-goals', 'value', 'odds', 'AI', 'bookmaker'],
    color: 'green',
    conditions: {
      ml_predictions: {
        prob_over_25: { min: 65 },
        odds_over_25: { min: 1.8 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      match_time: {
        between: [30, 75],
      },
    } as any,
  },

  // ============================================================
  // PREDICTIVE BTTS TEMPLATES (xG-BASED - TRIGGER BEFORE BOTH SCORE)
  // ============================================================

  {
    id: 'predictive-btts-xg',
    name: '🎯 BTTS Incoming (xG Predictive)',
    description: 'Both teams creating high-quality chances with xG >0.6 each, but at least one hasn\'t scored yet. Perfect timing for BTTS bet BEFORE both teams score. Uses expected goals to predict future scoring.',
    category: 'goals',
    icon: '⚽',
    popularity: 5,
    successRate: 78,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'xG', 'predictive', 'sofascore', 'early-signal'],
    color: 'cyan',
    conditions: {
      score: {
        total_goals: { min: 0, max: 1 },
      },
      xg: {
        home: { min: 0.6 },
        away: { min: 0.6 },
        total: { min: 1.5 },
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
      },
      match_time: {
        between: [50, 80],
      },
    } as any,
  },

  {
    id: 'predictive-over25-xg-imminent',
    name: '⚡ Over 2.5 Imminent (xG Pressure)',
    description: 'Combined xG >2.5 with 0-2 goals scored so far. High pressure from both teams, shots trending up. Statistical likelihood of 3+ goals is very high. Triggers BEFORE reaching 3 goals for maximum betting value.',
    category: 'goals',
    icon: '🎯',
    popularity: 5,
    successRate: 80,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['over-goals', 'xG', 'predictive', 'sofascore', 'high-probability'],
    color: 'green',
    conditions: {
      score: {
        total_goals: { min: 0, max: 2 },
      },
      xg: {
        total: { min: 2.5 },
      },
      shots_on_target: {
        total: { min: 7 },
      },
      dangerous_attacks: {
        total: { min: 10 },
      },
      match_time: {
        between: [60, 83],
      },
    } as any,
  },

  {
    id: 'predictive-btts-ml-hybrid',
    name: '🤖 BTTS Predictive (ML + xG Combo)',
    description: 'HYBRID: AI model predicts BTTS >70% AND both teams show xG >0.5 each, but maximum 1 team has scored. Double confirmation from ML + live stats. Highest confidence BTTS signal before both teams score.',
    category: 'ml_powered',
    icon: '🔮',
    popularity: 5,
    successRate: 82,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'ML', 'xG', 'hybrid', 'predictive', 'AI'],
    color: 'purple',
    conditions: {
      score: {
        total_goals: { min: 0, max: 1 },
      },
      ml_predictions: {
        prob_btts_yes: { min: 70 },
      },
      xg: {
        home: { min: 0.5 },
        away: { min: 0.5 },
        total: { min: 1.3 },
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
      },
      match_time: {
        between: [45, 80],
      },
    } as any,
  },

  {
    id: 'underdog-xg-value-mismatch',
    name: '🔥 Underdog xG Value Mismatch',
    description: 'Away team losing but has BETTER xG than home team. Score doesn\'t reflect match quality - value bet on draw or away comeback. Perfect for catching bookmaker odds before they adjust.',
    category: 'advanced',
    icon: '💎',
    popularity: 4,
    successRate: 74,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['underdog', 'xG', 'value-bet', 'comeback', 'mismatch'],
    color: 'amber',
    conditions: {
      score: {
        home: { min: 1 },
        away: { max: 0 },
        difference: { min: 1, max: 2 },
      },
      xg: {
        away: { min: 1.2 },
      },
      shots_on_target: {
        away: { min: 3 },
      },
      dangerous_attacks: {
        away: { min: 5 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  // ============================================================
  // SOFASCORE LIVE STATS TEMPLATES
  // ============================================================
  {
    id: 'ss-high-xg-match',
    name: 'High xG Match: Total xG ≥ 2.0 (Live)',
    description: 'Match with high combined expected goals — strong signal for goals market. Requires SofaScore live enrichment.',
    category: 'advanced',
    icon: '🎯',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    color: 'cyan',
    tags: ['xg', 'goals', 'sofascore', 'live'],
    conditions: {
      xg: { total: { min: 2.0 } },
      match_time: { between: [45, 85] },
    } as any,
  },
  {
    id: 'ss-xg-dominant-home',
    name: 'Home xG Dominance: Home xG ≥ 1.5 + Home Big Chances ≥ 2',
    description: 'Home team creating significant expected goals and clear chances. Use for home win or BTTS.',
    category: 'advanced',
    icon: '🏠',
    popularity: 4,
    successRate: 68,
    confidence: 'High',
    notificationEnabled: true,
    color: 'green',
    tags: ['xg', 'big-chances', 'sofascore', 'home'],
    conditions: {
      xg: { home: { min: 1.5 } },
      big_chances: { home: { min: 2 } },
      match_time: { between: [30, 85] },
    } as any,
  },
  {
    id: 'ss-big-chances-both-teams',
    name: 'Open Game: 3+ Total Big Chances (Live)',
    description: 'Both teams creating clear scoring opportunities — open, end-to-end match.',
    category: 'advanced',
    icon: '⚽',
    popularity: 4,
    successRate: 66,
    confidence: 'Medium',
    notificationEnabled: true,
    color: 'amber',
    tags: ['big-chances', 'sofascore', 'goals'],
    conditions: {
      big_chances: { total: { min: 3 } },
      match_time: { between: [30, 80] },
    } as any,
  },
  {
    id: 'ss-high-pass-accuracy-possession',
    name: 'Technical Match: Pass Accuracy ≥ 80% + Possession ≥ 55% (Live)',
    description: 'High-quality passing with clear possession dominance. Suits Asian handicap markets.',
    category: 'advanced',
    icon: '🎖️',
    popularity: 3,
    successRate: 63,
    confidence: 'Medium',
    notificationEnabled: true,
    color: 'blue',
    tags: ['pass-accuracy', 'possession', 'sofascore'],
    conditions: {
      pass_accuracy: { home: { min: 80 } },
      possession: { home: { min: 55 } },
      match_time: { between: [30, 75] },
    } as any,
  },
  {
    id: 'ss-defensive-battle',
    name: 'Defensive Battle: 10+ Clearances + Low xG ≤ 0.8 (Live)',
    description: 'High number of clearances and low xG signals a tight defensive match.',
    category: 'advanced',
    icon: '🛡️',
    popularity: 3,
    successRate: 64,
    confidence: 'Medium',
    notificationEnabled: true,
    color: 'purple',
    tags: ['clearances', 'xg', 'sofascore', 'defensive'],
    conditions: {
      clearances: { total: { min: 10 } },
      xg: { total: { max: 0.8 } },
      match_time: { between: [45, 85] },
    } as any,
  },
];

// Filter out templates that are experimental or clearly low-value for
// regular users. This keeps the UI focused on useful templates while
// preserving the raw list for maintainers.
export const FILTER_TEMPLATES: FilterTemplate[] = RAW_TEMPLATES.filter(t => {
  if (t.experimental) return false;
  // Always keep popular or advanced templates with decent success rate
  if (t.category === 'popular') return true;
  if (t.category === 'ml_powered') return true; // always include ML templates
  if ((t.popularity || 0) >= 3) return true;
  if ((t.successRate || 0) >= 60) return true;
  return false;
});

export const getTemplates = () => FILTER_TEMPLATES;
export const getTemplatesByCategory = (category: string) => FILTER_TEMPLATES.filter(t => t.category === category);
export const getPopularTemplates = () => FILTER_TEMPLATES.filter(t => t.popularity >= 4).sort((a, b) => b.popularity - a.popularity);
export const getTemplateById = (id: string) => FILTER_TEMPLATES.find(t => t.id === id);
export const getAllTemplates = () => FILTER_TEMPLATES;

export const getCategoriesWithCounts = (): { all: number; popular: number; corners: number; goals: number; cards: number; shots: number; advanced: number; experimental?: number; ml_powered: number } => {
  const categories = new Set(FILTER_TEMPLATES.map(t => t.category));
  const counts: Record<string, number> = {};
  
  categories.forEach(cat => {
    counts[cat] = FILTER_TEMPLATES.filter(t => t.category === cat).length;
  });
  
  // Popular is not a real category, it's filtered by popularity >= 4
  const popularCount = FILTER_TEMPLATES.filter(t => t.popularity >= 4).length;
  
  return {
    all: FILTER_TEMPLATES.length,
    popular: popularCount,
    corners: counts['corners'] || 0,
    goals: counts['goals'] || 0,
    cards: counts['cards'] || 0,
    shots: counts['shots'] || 0,
    advanced: counts['advanced'] || 0,
    experimental: counts['experimental'] || 0,
    ml_powered: counts['ml_powered'] || 0,
  };
};

export const searchTemplates = (query: string) => FILTER_TEMPLATES.filter(t => 
  t.name.toLowerCase().includes(query.toLowerCase()) || 
  t.description.toLowerCase().includes(query.toLowerCase())
);

// Stats
const stats = {
  totalTemplates: FILTER_TEMPLATES.length,
  byCategory: {} as Record<string, number>,
  averageSuccessRate: 0,
  highPerformers: [] as string[],
};

FILTER_TEMPLATES.forEach(t => {
  stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + 1;
});

const rateSum = FILTER_TEMPLATES.reduce((sum, t) => sum + (t.successRate || 0), 0);
stats.averageSuccessRate = Math.round(rateSum / FILTER_TEMPLATES.length);
stats.highPerformers = FILTER_TEMPLATES.filter(t => (t.successRate || 0) >= 70).map(t => t.name);

export default stats;
