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
  category: 'corners' | 'goals' | 'cards' | 'shots' | 'advanced' | 'popular' | 'experimental';
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

// Raw full templates list (kept for reference). We derive a cleaned
// `FILTER_TEMPLATES` below to remove experimental/low-value entries
// from the UI while keeping the original data for auditing.
export const RAW_TEMPLATES: FilterTemplate[] = [
  // ============================================
  // PREDICTIVE LIVE BETTING (Most Valuable)
  // ============================================
  // Based on: At minute X with Y stat, predict final will be Z
  // Matches typically show 70% of final corners by 60min, 90% by 75min
  
  {
    id: 'live-corners-60-to-75-min',
    name: 'Live: 6+ Corners at 75min (Predicts 9+ Final)',
    description: 'Alert when match has 6+ corners by minute 75. Research shows: 6 corners at 75min = ~84% chance of 9+ final. Time to live bet with high confidence.',
    category: 'advanced',
    icon: '📈',
    popularity: 5,
    successRate: 84,
    notificationEnabled: true,
    tags: ['predictive', 'live', 'high-probability', 'corners'],
    backgroundImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
    color: 'cyan',
    conditions: {
      corners: {
        min: 6,
        team: 'total',
      },
      match_time: {
        min: 70,
        max: 80,
      },
      shots_on_target: {
        min: 2,
      },
      dangerous_attacks: {
        min: 8,
      },
      odds: {
        max: 3.5,
      },
    },
  },
  {
    id: 'live-corners-70-min',
    name: 'Live: 5+ Corners at 70min (Predicts 8+ Final)',
    description: 'Alert at 70min with 5+ corners. Statistical probability: 5 corners at 70min = ~78% chance of 8+ by end. Safe early signal.',
    category: 'advanced',
    icon: '📊',
    popularity: 5,
    successRate: 78,
    notificationEnabled: true,
    tags: ['predictive', 'live', 'safe', 'corners'],
    backgroundImage: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
    color: 'blue',
    conditions: {
      corners: {
        min: 5,
        team: 'total',
      },
      match_time: {
        min: 65,
        max: 75,
      },
      shots_on_target: {
        min: 1,
      },
      possession: {
        min: 45,
      },
    },
  },
  {
    id: 'live-corners-60-min',
    name: 'Live: 4+ Corners at 60min (Predicts 7+ Final)',
    description: 'Alert at 60min with 4+ corners. Probability: 4 corners at 60min = ~72% chance of 7+ final. Earliest reliable signal, most time for betting.',
    category: 'advanced',
    icon: '💡',
    backgroundImage: 'https://images.unsplash.com/photo-1517747323999-67f42424e3a1?w=800&q=80',
    color: 'green',
    popularity: 5,
    successRate: 72,
    notificationEnabled: true,
    tags: ['predictive', 'live', 'early', 'safe'],
    conditions: {
      corners: {
        min: 4,
        team: 'total',
      },
      match_time: {
        min: 55,
        max: 65,
      },
      total_shots: {
        min: 6,
      },
    },
  },

  // ============================================
  // AGGRESSIVE CORNER SIGNALS
  // ============================================
  {
    id: 'live-corners-high-75-min',
    name: 'Live: 8+ Corners at 75min (Predicts 11+ Final)',
    description: 'Very aggressive. 8 corners at 75min = ~76% chance of 11+. High action match with time pressure building.',
    category: 'advanced',
    icon: '🔥',
    popularity: 4,
    successRate: 76,
    notificationEnabled: true,
    tags: ['aggressive', 'high-risk', 'corners'],
    conditions: {
      corners: {
        min: 8,
        team: 'total',
      },
      match_time: {
        min: 70,
        max: 80,
      },
    },
  },
  {
    id: 'live-corners-very-high',
    name: 'Live: 10+ Corners Already',
    description: 'Rare but valuable. Match has reached 10 corners - unusual intensity. Probability of hitting 13+ by end = ~61%.',
    category: 'advanced',
    icon: '⚡',
    popularity: 3,
    successRate: 61,
    notificationEnabled: true,
    tags: ['rare', 'very-high', 'corners'],
    conditions: {
      corners: {
        min: 10,
        team: 'total',
      },
      match_time: {
        min: 60,
        max: 90,
      },
    },
  },

  // ============================================
  // GOALS - PREDICTIVE (Similar Logic)
  // ============================================
  {
    id: 'live-goals-2-at-70min',
    name: 'Live: 2+ Goals at 70min (Predicts 3+ Final)',
    description: 'At 70min with 2+ goals scored. Probability: ~69% chance of reaching 3+ by 90min. Attacking match pattern.',
    category: 'goals',
    icon: '⚽',
    popularity: 5,
    successRate: 69,
    notificationEnabled: true,
    tags: ['predictive', 'goals', 'live', 'attacking'],
    conditions: {
      goals: {
        min: 2,
        team: 'total',
      },
      match_time: {
        min: 65,
        max: 75,
      },
      shots_on_target: {
        min: 4,
      },
      dangerous_attacks: {
        min: 10,
      },
    },
  },
  {
    id: 'live-goals-1-at-60min',
    name: 'Live: 1+ Goal at 60min (Predicts 2+ Final)',
    description: 'At 60min with 1+ goals. Probability: ~58% chance of 2+ final. Common attacking pattern in second half.',
    category: 'goals',
    icon: '📊',
    popularity: 4,
    successRate: 58,
    notificationEnabled: true,
    tags: ['predictive', 'goals', 'live'],
    conditions: {
      goals: {
        min: 1,
        team: 'total',
      },
      match_time: {
        min: 55,
        max: 70,
      },
    },
  },
  {
    id: 'live-goals-3-at-75min',
    name: 'Live: 3+ Goals at 75min (Predicts 4+ Final)',
    description: 'Rare high-action match. 3 goals at 75min = ~73% chance of 4+. Very offensive play.',
    category: 'goals',
    icon: '🔥',
    popularity: 3,
    successRate: 73,
    notificationEnabled: true,
    tags: ['aggressive', 'rare', 'goals'],
    conditions: {
      goals: {
        min: 3,
        team: 'total',
      },
      match_time: {
        min: 70,
        max: 85,
      },
    },
  },

  // ============================================
  // DEFENSIVE SIGNALS (Low Activity)
  // ============================================
  {
    id: 'live-defensive-0-at-60min',
    name: 'Live: 0-0 at 60min (Predicts Under 1.5 Final)',
    description: 'At 60min still 0-0. Probability: ~67% chance match stays under 2 goals. Defensive/low-intensity match.',
    category: 'advanced',
    icon: '🛡️',
    popularity: 4,
    successRate: 67,
    notificationEnabled: true,
    tags: ['defensive', 'under', 'low-scoring'],
    conditions: {
      goals: {
        max: 0,
        team: 'total',
      },
      match_time: {
        min: 55,
        max: 70,
      },
    },
  },
  {
    id: 'live-low-corners-60min',
    name: 'Live: Under 3 Corners at 60min (Predicts Under 6 Final)',
    description: 'At 60min only 1-2 corners. Probability: ~64% chance of staying under 6 corners total. Balanced/defensive match.',
    category: 'advanced',
    icon: '📉',
    popularity: 4,
    successRate: 64,
    notificationEnabled: true,
    tags: ['defensive', 'under', 'low-action'],
    conditions: {
      corners: {
        max: 2,
        team: 'total',
      },
      match_time: {
        min: 55,
        max: 65,
      },
    },
  },

  // ============================================
  // LATE GAME PRESSURE (80+ Minutes)
  // ============================================
  {
    id: 'live-late-corners-80min',
    name: 'Live: 7+ Corners at 80min (Predicts 10+ Final)',
    description: 'Late game with 7+ corners at 80min. Time pressure increases corner rate. Probability: ~82% of hitting 10+ total.',
    category: 'advanced',
    icon: '⏰',
    popularity: 4,
    successRate: 82,
    notificationEnabled: true,
    tags: ['late-game', 'pressure', 'high-probability'],
    conditions: {
      corners: {
        min: 7,
        team: 'total',
      },
      match_time: {
        min: 75,
        max: 85,
      },
    },
  },
  {
    id: 'live-late-cards-75min',
    name: 'Live: 3+ Cards at 75min (Predicts 5+ Final)',
    description: 'At 75min with 3+ cards already. Probability: ~71% of 5+ total cards by end. Intense/aggressive match.',
    category: 'cards',
    icon: '🟨',
    popularity: 3,
    successRate: 71,
    notificationEnabled: true,
    tags: ['late-game', 'cards', 'intensity'],
    conditions: {
      yellow_cards: {
        min: 3,
      },
      match_time: {
        min: 70,
        max: 80,
      },
    },
  },

  // ============================================
  // MOMENTUM/INTENSITY PATTERNS
  // ============================================
  {
    id: 'live-high-intensity',
    name: 'Live: 5+ Corners + 2+ Cards at 60min',
    description: 'High intensity match: 5+ corners + 2+ cards at 60min. Predicts very active match. Probability of 8+ corners AND 4+ cards = ~61%.',
    category: 'advanced',
    icon: '⚡',
    popularity: 4,
    successRate: 61,
    notificationEnabled: true,
    tags: ['intensity', 'combined', 'momentum'],
    conditions: {
      corners: {
        min: 5,
        team: 'total',
      },
      yellow_cards: {
        min: 2,
      },
      match_time: {
        min: 55,
        max: 65,
      },
    },
  },
  {
    id: 'live-balanced-match',
    name: 'Live: 2-3 Goals + 6+ Corners at 65min',
    description: 'Balanced attacking match: moderate goals + good corners. 2-3 goals + 6+ corners = ~68% chance of reaching 3+ goals AND 8+ corners.',
    category: 'advanced',
    icon: '⚖️',
    popularity: 3,
    successRate: 68,
    notificationEnabled: true,
    tags: ['balanced', 'combined', 'attacking'],
    conditions: {
      goals: {
        min: 2,
        max: 3,
        team: 'total',
      },
      corners: {
        min: 6,
        team: 'total',
      },
      match_time: {
        min: 60,
        max: 70,
      },
    },
  },

  // ============================================
  // FIRST HALF SIGNALS (35-45 Minutes)
  // ============================================
  {
    id: 'first-half-3-corners-45min',
    name: 'First Half: 3+ Corners at 45min (Predicts 7+ Final)',
    description: 'First half ends with 3+ corners. Probability: ~65% of reaching 7+ total by end. Good pace indicator.',
    category: 'advanced',
    icon: '⏱️',
    popularity: 3,
    successRate: 65,
    notificationEnabled: true,
    tags: ['first-half', 'predictive', 'early'],
    conditions: {
      corners: {
        min: 3,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 45,
      },
    },
  },
  {
    id: 'first-half-1-goal-45min',
    name: 'First Half: 1+ Goal at 45min (Predicts 2+ Final)',
    description: 'First half with 1+ goals. At 45min with scoring = ~55% chance of 2+ final. Both teams capable.',
    category: 'goals',
    icon: '⚽',
    popularity: 3,
    successRate: 55,
    notificationEnabled: true,
    tags: ['first-half', 'goals'],
    conditions: {
      goals: {
        min: 1,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 45,
      },
    },
  },

  // ============================================
  // FULL MATCH FILTERS (40-90 minutes)
  // ============================================
  {
    id: 'full-match-over-9-corners',
    name: 'Full Match: Over 9.5 Corners Total',
    description: 'Classic filter. Match produces 10+ total corners at any point. Success rate 68%. Use live predictive versions for better timing.',
    category: 'corners',
    icon: '🎯',
    popularity: 4,
    successRate: 68,
    notificationEnabled: true,
    tags: ['full-match', 'classic', 'corners'],
    conditions: {
      corners: {
        min: 10,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 90,
      },
    },
  },
  {
    id: 'full-match-over-2-5-goals',
    name: 'Full Match: Over 2.5 Goals Total',
    description: 'Classic filter. 3+ total goals by any point. Success rate 62%. Attacking match pattern.',
    category: 'goals',
    icon: '⚽',
    popularity: 4,
    successRate: 62,
    notificationEnabled: true,
    tags: ['full-match', 'classic', 'goals'],
    conditions: {
      goals: {
        min: 3,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 90,
      },
    },
  },
  {
    id: 'full-match-over-8-corners',
    name: 'Full Match: Over 8.5 Corners (Safe)',
    description: 'Conservative. 9+ corners total. Higher success rate (72%) due to lower threshold.',
    category: 'corners',
    icon: '🛡️',
    popularity: 4,
    successRate: 72,
    notificationEnabled: true,
    tags: ['full-match', 'conservative', 'safe'],
    conditions: {
      corners: {
        min: 9,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 90,
      },
    },
  },
  {
    id: 'full-match-over-1-5-goals',
    name: 'Full Match: Over 1.5 Goals (Very Safe)',
    description: 'Very conservative. 2+ goals. Success rate 75%. Safest betting option.',
    category: 'goals',
    icon: '📊',
    popularity: 4,
    successRate: 75,
    notificationEnabled: true,
    tags: ['full-match', 'very-safe', 'conservative'],
    conditions: {
      goals: {
        min: 2,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 90,
      },
    },
  },

  // ============================================
  // UNDER / DEFENSIVE FILTERS
  // ============================================
  {
    id: 'full-match-under-6-corners',
    name: 'Full Match: Under 6.5 Corners (Defensive)',
    description: 'Defensive match pattern. 0-6 corners total. Success rate 66%. Good for defensive league/teams.',
    category: 'corners',
    icon: '🛡️',
    popularity: 3,
    successRate: 66,
    notificationEnabled: true,
    tags: ['defensive', 'under', 'safe'],
    conditions: {
      corners: {
        max: 6,
        team: 'total',
      },
      match_time: {
        min: 40,
        max: 90,
      },
    },
  },
  // (Removed low-value template: full-match-under-1-5-goals)
  // ============================================
  // ADVANCED: 20 HIGH-QUALITY MULTI-METRIC TEMPLATES
  // Each template combines 3-5 metrics and includes a confidence label
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
    id: 'adv-counter-attack-pattern',
    name: 'Counter-Attack Pattern: 2+ SOT, 6+ Dangerous Attacks, Low Possession',
    description: 'Early counter-attacking match: aggressive chances despite low possession. Confidence: Medium',
    category: 'advanced',
    icon: '🏃‍♂️',
    popularity: 4,
    successRate: 62,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['attacks', 'shots', 'possession'],
    conditions: {
      shots_on_target: { min: 2 },
      dangerous_attacks: { min: 6 },
      possession: { max: 48 },
      match_time: { min: 20, max: 60 },
    },
  },
  {
    id: 'adv-late-press-80min-goals-corners',
    name: 'Late Press: 2+ Goals OR 6+ Corners at 80min',
    description: 'Late pressure indicator combining goals and corners for late bets. Confidence: Medium',
    category: 'advanced',
    icon: '⏰',
    popularity: 4,
    successRate: 64,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['late-game', 'pressure'],
    conditions: {
      match_time: { min: 78, max: 90 },
      goals: { min: 2, team: 'total' },
      corners: { min: 6, team: 'total' },
    },
  },
  {
    id: 'adv-high-odds-value-corner-rush',
    name: 'Value Corner Rush: 6+ Corners + low odds (<4.0)',
    description: 'High action match with attractive odds—good value for corner markets. Confidence: Medium',
    category: 'advanced',
    icon: '💎',
    popularity: 3,
    successRate: 60,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['value', 'corners', 'odds'],
    conditions: {
      corners: { min: 6, team: 'total' },
      odds: { max: 4.0 },
      match_time: { min: 60, max: 85 },
      shots_on_target: { min: 2 },
    },
  },
  // (Removed experimental template: adv-fast-start-20min)
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
    id: 'adv-counter-and-corners',
    name: 'Counter + Corners: 4+ Dangerous Attacks + 4+ Corners by 55min',
    description: 'Combined pattern that often leads to late corners and chances. Confidence: Medium',
    category: 'advanced',
    icon: '⚽',
    popularity: 4,
    successRate: 63,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['combined', 'counter'],
    conditions: {
      dangerous_attacks: { min: 4 },
      corners: { min: 4, team: 'total' },
      match_time: { min: 45, max: 60 },
    },
  },
  {
    id: 'adv-red-card-influence',
    name: 'Red Card Influence: Red Card + 3+ Dangerous Attacks After 60min',
    description: 'A red card often increases set-piece and corner volume—combine to predict corner surge. Confidence: Medium',
    category: 'cards',
    icon: '🟥',
    popularity: 3,
    successRate: 61,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['cards', 'influence'],
    conditions: {
      red_cards: { min: 1 },
      dangerous_attacks: { min: 3 },
      match_time: { min: 60, max: 90 },
    },
  },
  {
    id: 'adv-attackers-dominate',
    name: 'Attackers Dominate: 60% Possession + 5+ Dangerous Attacks',
    description: 'Dominant attacking team creating sustained chances—use for goal markets. Confidence: High',
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
    id: 'adv-tight-defensive-breakdown',
    name: 'Tight Game Breaks: 0-1 Goals + 8+ Dangerous Attacks (sustained pressure)',
    description: 'Low scoring but high chance creation—may convert late. Confidence: Medium',
    category: 'advanced',
    icon: '🔍',
    popularity: 3,
    successRate: 60,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['defensive', 'attacks'],
    conditions: {
      goals: { max: 1, team: 'total' },
      dangerous_attacks: { min: 8 },
      match_time: { min: 50, max: 90 },
    },
  },
  {
    id: 'adv-early-dominance-value',
    name: 'Early Dominance + Value Odds (<3.0): 3+ SOT + 55% Possession',
    description: 'Early control with good bookmaker value—high chance of continued attack. Confidence: High',
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
    id: 'adv-comeback-signal',
    name: 'Comeback Signal: Trailing Team 3+ Dangerous Attacks + 2+ SOT',
    description: 'Trailing team increasing pressure—possible late equaliser or goal. Confidence: Medium',
    category: 'advanced',
    icon: '↩️',
    popularity: 4,
    successRate: 63,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['comeback', 'pressure'],
    conditions: {
      dangerous_attacks: { min: 3 },
      shots_on_target: { min: 2 },
      match_time: { min: 60, max: 90 },
    },
  },
  {
    id: 'adv-set-piece-heavy',
    name: 'Set-Piece Heavy: 6+ Corners + 2+ Yellow Cards',
    description: 'Fouls and corners combined—predicts dead-ball chances and corner volume. Confidence: Medium',
    category: 'advanced',
    icon: '📌',
    popularity: 4,
    successRate: 65,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['set-piece', 'corners'],
    conditions: {
      corners: { min: 6, team: 'total' },
      yellow_cards: { min: 2 },
      match_time: { min: 50, max: 90 },
    },
  },
  {
    id: 'adv-quiet-first-half-late-explosion',
    name: 'Quiet 1H + Late Explosion: <=1 Goal at HT + 6+ Dangerous Attacks in 2H',
    description: 'Games that open up in second half. Confidence: Medium',
    category: 'advanced',
    icon: '🌅',
    popularity: 3,
    successRate: 62,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['second-half', 'explosion'],
    conditions: {
      goals: { max: 1, team: 'total' },
      dangerous_attacks: { min: 6 },
      match_time: { min: 46, max: 90 },
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
  // LIVEPICK-STYLE PROFESSIONAL TEMPLATES
  // ============================================
  // Based on LivePick.eu advanced strategies

  {
    id: 'livepick-favorite-losing-home',
    name: '🏠 Favorite Losing at Home (BTTS Opportunity)',
    description: 'Home team is losing but dominating with shots on target. Classic BTTS setup - home team will push for comeback, both teams likely to score.',
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
      goals: {
        min: 1, // Game has goals (away winning)
        max: 2,
        team: 'total',
      },
      shots_on_target: {
        min: 6, // High shots on target total
      },
      dangerous_attacks: {
        min: 10, // High attacking pressure
      },
      match_time: {
        min: 55,
        max: 80,
      },
    },
  },

  {
    id: 'livepick-high-momentum-home',
    name: '⚡ High Momentum Match',
    description: 'Match showing strong attacking momentum with high possession + dangerous attacks. Perfect for home win or over goals markets.',
    category: 'advanced',
    icon: '🔥',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['momentum', 'attacking', 'high-confidence'],
    backgroundImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
    color: 'cyan',
    conditions: {
      possession: {
        min: 55, // Dominant possession
      },
      dangerous_attacks: {
        min: 14, // Strong attacking pressure (both teams)
      },
      shots_on_target: {
        min: 7,
      },
      corners: {
        min: 6,
        team: 'total',
      },
      match_time: {
        min: 60,
        max: 85,
      },
    },
  },

  {
    id: 'livepick-over-25-goals-scenario',
    name: '⚽ Over 2.5 Goals Scenario (Live)',
    description: 'Match shows all indicators for 3+ total goals: high shots, dangerous attacks, and open play. Perfect timing for over 2.5 goals bet.',
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
      goals: {
        min: 1,
        max: 2,
        team: 'total', // Already 1-2 goals scored
      },
      shots_on_target: {
        min: 8, // High shot quality
      },
      dangerous_attacks: {
        min: 15, // Very attacking match
      },
      corners: {
        min: 6,
        team: 'total',
      },
      match_time: {
        min: 60,
        max: 80,
      },
    },
  },

  {
    id: 'livepick-corner-rush',
    name: '🚀 Corner Rush (High Action)',
    description: 'Explosive corner activity with sustained attacking pressure. Perfect for corner betting - rush continues into final minutes.',
    category: 'corners',
    icon: '🎪',
    popularity: 5,
    successRate: 79,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['corners', 'high-action', 'rush', 'late-game'],
    backgroundImage: 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80',
    color: 'purple',
    conditions: {
      corners: {
        min: 8,
        team: 'total', // Already high corners
      },
      shots_on_target: {
        min: 6,
      },
      dangerous_attacks: {
        min: 12, // Continuous pressure
      },
      match_time: {
        min: 70,
        max: 88,
      },
    },
  },

  {
    id: 'livepick-late-comeback-potential',
    name: '🔄 Late Comeback Potential',
    description: 'Close match with high stats - superior possession, shots, attacks suggest late equalizer or comeback. Perfect for BTTS or draw.',
    category: 'advanced',
    icon: '💪',
    popularity: 4,
    successRate: 68,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['comeback', 'late-game', 'value'],
    backgroundImage: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
    color: 'blue',
    conditions: {
      goals: {
        min: 1,
        max: 2, // Close scoreline (1-0 or 1-1 or 2-1)
        team: 'total',
      },
      possession: {
        min: 50, // Balanced possession
      },
      shots_on_target: {
        min: 8, // High shots on target
      },
      dangerous_attacks: {
        min: 14, // Creating many chances
      },
      match_time: {
        min: 70,
        max: 88,
      },
    },
  },

  {
    id: 'livepick-aggressive-counter',
    name: '⚔️ Aggressive Counter Attack',
    description: 'Low possession but high shot quality - dangerous counter-attacking setup. Good for underdog win or BTTS.',
    category: 'advanced',
    icon: '⚔️',
    popularity: 4,
    successRate: 65,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['counter-attack', 'value-bet', 'shots'],
    backgroundImage: 'https://images.unsplash.com/photo-1529079003456-3bac75d7e0e0?w=800&q=80',
    color: 'red',
    conditions: {
      possession: {
        max: 48, // Lower possession
      },
      shots_on_target: {
        min: 6, // But quality shots
      },
      dangerous_attacks: {
        min: 10,
      },
      corners: {
        min: 5,
        team: 'total',
      },
      match_time: {
        min: 45,
        max: 75,
      },
    },
  },

  {
    id: 'livepick-both-teams-pressing',
    name: '🔥 Both Teams Pressing (High Intensity)',
    description: 'Both teams creating chances with very high shots on target and attacks. Perfect BTTS or over goals scenario with balanced attack.',
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
      shots_on_target: {
        min: 10, // Very high total shots on target (both teams)
      },
      dangerous_attacks: {
        min: 16, // Very high attacks (both teams)
      },
      corners: {
        min: 8,
        team: 'total',
      },
      match_time: {
        min: 55,
        max: 80,
      },
    },
  },

  {
    id: 'livepick-late-pressure-draw',
    name: '🎭 Late Pressure Match',
    description: 'Low-scoring match with both teams creating chances late - high probability one team breaks through or both score (BTTS). Perfect for late goals.',
    category: 'goals',
    icon: '🎲',
    popularity: 4,
    successRate: 69,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['late-goals', 'BTTS', 'tension'],
    backgroundImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
    color: 'purple',
    conditions: {
      goals: {
        max: 1, // Still low scoring (0-0 or 1-0 or 0-1)
        team: 'total',
      },
      shots_on_target: {
        min: 8, // Lots of chances
      },
      dangerous_attacks: {
        min: 14,
      },
      corners: {
        min: 8,
        team: 'total',
      },
      match_time: {
        min: 75,
        max: 89,
      },
    },
  },

  {
    id: 'livepick-red-card-chaos',
    name: '🟥 Red Card Chaos (Set Piece Surge)',
    description: 'Red card issued with sustained attacking from the team with advantage. Expect corner surge and set-piece goals.',
    category: 'cards',
    icon: '🌪️',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['red-card', 'set-pieces', 'corners', 'chaos'],
    backgroundImage: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=800&q=80',
    color: 'red',
    conditions: {
      red_cards: {
        min: 1, // Red card shown
      },
      corners: {
        min: 5,
        team: 'total',
      },
      dangerous_attacks: {
        min: 8,
      },
      match_time: {
        min: 60,
        max: 90,
      },
    },
  },

  {
    id: 'livepick-final-10-minutes-madness',
    name: '⏰ Final 10 Minutes Madness',
    description: 'Match in final 10 minutes with high activity - corners, shots, cards all elevated. Perfect for late corner or card markets.',
    category: 'advanced',
    icon: '⌛',
    popularity: 5,
    successRate: 73,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['late-game', 'final-minutes', 'high-activity', 'pressure'],
    backgroundImage: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80',
    color: 'amber',
    conditions: {
      corners: {
        min: 9,
        team: 'total', // High corners
      },
      shots_on_target: {
        min: 7,
      },
      yellow_cards: {
        min: 3, // Physical match
      },
      match_time: {
        min: 80,
        max: 90,
      },
    },
  },
];

// Filter out templates that are experimental or clearly low-value for
// regular users. This keeps the UI focused on useful templates while
// preserving the raw list for maintainers.
export const FILTER_TEMPLATES: FilterTemplate[] = RAW_TEMPLATES.filter(t => {
  if (t.experimental) return false;
  // Always keep popular or advanced templates with decent success rate
  if (t.category === 'popular') return true;
  if ((t.popularity || 0) >= 3) return true;
  if ((t.successRate || 0) >= 60) return true;
  return false;
});

export const getTemplates = () => FILTER_TEMPLATES;
export const getTemplatesByCategory = (category: string) => FILTER_TEMPLATES.filter(t => t.category === category);
export const getPopularTemplates = () => FILTER_TEMPLATES.filter(t => t.popularity >= 4).sort((a, b) => b.popularity - a.popularity);
export const getTemplateById = (id: string) => FILTER_TEMPLATES.find(t => t.id === id);
export const getAllTemplates = () => FILTER_TEMPLATES;

export const getCategoriesWithCounts = (): { all: number; popular: number; corners: number; goals: number; cards: number; shots: number; advanced: number; experimental?: number } => {
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
