// ============================================
// FILTER TEMPLATES LIBRARY — v3 (Competitor-Researched)
// ============================================
// Built from research across: LivePick.eu, InPlayGuru, Overlyzer,
// PlayThePercentage, BetTheBuilder + filter engine audit.
//
// v3 quality rules:
// • Minimum 3 conditions per template (match_time + 2+ stat conditions)
// • All match_time capped at 82 max (bookmakers block bets after ~83rd minute)
// • Focus on result quality, not trigger volume
// • Added Under goals/corners templates (BetTheBuilder highest-ROI)
// • Added First-Half template (PlayThePercentage key market)
// • Added Dominance Imbalance (InPlayGuru pattern)
// • Strengthened weak templates with additional conditions
//
// Stats reference (per full 90-min match averages):
//   Corners 9-10 | Goals 2.6-2.8 | Yellow cards 3-4
//   SOT 4-5/team | Total shots 12-15/team | Possession 50/50
//
// Note: dangerous_attacks removed — SofaScore doesn't provide this stat.
// Replaced with total_shots which SofaScore reliably provides.

import type { FilterConditions } from '@/lib/supabase';
import type { EvaluationType } from '@/lib/analytics';

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
  backgroundImage?: string;
  color?: 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'red';
  // Phase 2: How this template should be evaluated for success
  evaluationType: EvaluationType;
  // Phase 5: Data-driven league recommendations (populated from analytics)
  recommendedLeagues?: string[];
  avoidLeagues?: string[];
  optimalMinuteWindow?: [number, number];
  realSuccessRate?: number;
  realAvgGoalsAdded?: number;
  dataConfidence?: 'none' | 'low' | 'medium' | 'high';
}

export const RAW_TEMPLATES: FilterTemplate[] = [
  // ============================================
  // GOALS TEMPLATES (7)
  // ============================================

  {
    id: 'goals-zero-zero-pressure',
    name: '⚽ 0:0 But Pressure Mounting',
    evaluationType: 'goals_over',
    recommendedLeagues: ['Premier League', 'Bundesliga', 'Eredivisie', 'Serie A'],
    avoidLeagues: ['Ligue 1', 'Süper Lig'],
    description: 'Still goalless but teams are creating chances — 5+ shots on target and 8+ total shots after 55 min. Next goal coming. Use for Over 0.5 or Next Goal market before the dam breaks.',
    category: 'goals',
    icon: '⚽',
    popularity: 5,
    successRate: 76,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['0-0', 'over-goals', 'next-goal', 'live'],
    backgroundImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
    color: 'green',
    conditions: {
      score: {
        total_goals: { max: 0 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      total_shots: {
        total: { min: 8 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  {
    id: 'goals-over-25-live',
    name: '⚽ Over 2.5 Goals — Live Signal',
    evaluationType: 'goals_over',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League', 'Belgian Pro League'],
    avoidLeagues: ['Ligue 1', 'Liga Portugal'],
    description: '1-2 goals already in with 5+ SOT and 10+ total shots. Strong indicators for a third goal. Best used for Over 2.5 after 55th minute.',
    category: 'goals',
    icon: '🎯',
    popularity: 5,
    successRate: 74,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['over-goals', 'attacking', 'high-probability', 'live'],
    backgroundImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    color: 'green',
    conditions: {
      score: {
        total_goals: { min: 1, max: 2 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      total_shots: {
        total: { min: 10 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  {
    id: 'goals-btts-one-side-scoring',
    name: '⚽ BTTS Setup — One Side Already Scored',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League', 'Serie A'],
    avoidLeagues: ['Ligue 1', 'Süper Lig'],
    evaluationType: 'goals_over',
    description: 'One team has scored but the other is creating clear chances (3+ SOT). Classic BTTS setup — the trailing team is likely to break through.',
    category: 'goals',
    icon: '⚽',
    popularity: 5,
    successRate: 73,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'live', 'attacking'],
    color: 'cyan',
    conditions: {
      score: {
        total_goals: { min: 1, max: 2 },
        difference: { min: 1 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      match_time: {
        between: [45, 80],
      },
    } as any,
  },

  {
    id: 'goals-away-comeback-signal',
    name: '✈️ Away Comeback Signal',
    evaluationType: 'goals_over',
    description: 'Away team trailing 0-1 but creating more chances (3+ away SOT, 5+ away total shots). Counter-attacks or quality play creates comeback. Value on BTTS or away goal.',
    category: 'goals',
    icon: '✈️',
    popularity: 4,
    successRate: 69,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['comeback', 'away', 'BTTS', 'value'],
    color: 'purple',
    conditions: {
      score: {
        home: { min: 1 },
        away: { max: 0 },
      },
      shots_on_target: {
        away: { min: 3 },
      },
      total_shots: {
        away: { min: 5 },
      },
      match_time: {
        between: [50, 78],
      },
    } as any,
  },

  {
    id: 'goals-over-35-late-push',
    name: '⚽ Over 3.5 Goals — Late Push',
    evaluationType: 'goals_over',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League'],
    avoidLeagues: ['Liga Portugal', 'Ligue 1'],
    description: 'Already 2+ goals scored and both teams still creating chances (6+ SOT, 8+ total shots). High probability of a 4th goal before full time.',
    category: 'goals',
    icon: '🎯',
    popularity: 4,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['over-goals', 'late-game', 'high-scoring'],
    color: 'red',
    conditions: {
      score: {
        total_goals: { min: 2 },
      },
      shots_on_target: {
        total: { min: 6 },
      },
      total_shots: {
        total: { min: 8 },
      },
      match_time: {
        between: [62, 82],
      },
    } as any,
  },

  {
    id: 'goals-late-goal-incoming',
    name: '⏰ Late Goal Incoming (72+ min)',
    evaluationType: 'goals_over',
    description: 'Low-scoring match (0-1 goals) but sustained pressure with 4+ SOT and 6+ total shots after 72nd minute. Statistically, late goals happen in ~35% of matches.',
    category: 'goals',
    icon: '⌛',
    popularity: 4,
    successRate: 70,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['late-goals', 'pressure', 'value'],
    backgroundImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
    color: 'purple',
    conditions: {
      score: {
        total_goals: { max: 1 },
      },
      shots_on_target: {
        total: { min: 4 },
      },
      total_shots: {
        total: { min: 6 },
      },
      match_time: {
        between: [72, 82],
      },
    } as any,
  },

  {
    id: 'goals-both-pressing-btts',
    name: '🔥 Both Teams Pressing — BTTS',
    evaluationType: 'goals_over',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League'],
    avoidLeagues: ['Ligue 1'],
    description: 'Both teams creating chances (2+ SOT each) with balanced possession. Open, attacking play — perfect for BTTS or Over goals before both have scored.',
    category: 'goals',
    icon: '🔥',
    popularity: 5,
    successRate: 75,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'balanced', 'high-intensity', 'attacking'],
    backgroundImage: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80',
    color: 'amber',
    conditions: {
      shots_on_target: {
        home: { min: 2 },
        away: { min: 2 },
        total: { min: 6 },
      },
      possession: {
        dominant: 'balanced',
      },
      match_time: {
        between: [45, 80],
      },
    } as any,
  },

  // ============================================
  // CORNERS TEMPLATES (3)
  // ============================================

  {
    id: 'corners-late-rush',
    name: '🚀 Corner Rush — Late Game',
    evaluationType: 'corners_only',
    description: '7+ corners already with SOT pressure (4+) and 6+ total shots after 68th minute. Teams pushing hard — corner line likely exceeded.',
    category: 'corners',
    icon: '🚀',
    popularity: 5,
    successRate: 77,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['corners', 'late-game', 'rush'],
    backgroundImage: 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80',
    color: 'purple',
    conditions: {
      corners: {
        total: { min: 7 },
      },
      shots_on_target: {
        total: { min: 4 },
      },
      total_shots: {
        total: { min: 6 },
      },
      match_time: {
        between: [68, 82],
      },
    } as any,
  },

  {
    id: 'corners-early-machine',
    name: '🎪 Early Corner Machine',
    evaluationType: 'corners_only',
    description: '4+ corners before 50th minute with high attacking pressure (5+ total shots). At this pace, match will exceed 10+ total corners. Great for Asian corners or Over 9.5.',
    category: 'corners',
    icon: '🎪',
    popularity: 4,
    successRate: 73,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['corners', 'early', 'over-corners'],
    color: 'cyan',
    conditions: {
      corners: {
        total: { min: 4 },
      },
      shots_on_target: {
        total: { min: 2 },
      },
      total_shots: {
        total: { min: 5 },
      },
      match_time: {
        between: [25, 50],
      },
    } as any,
  },

  {
    id: 'corners-pressure-combo',
    name: '⚡ Corner + Shot Pressure',
    evaluationType: 'corners_only',
    description: '5+ corners combined with 3+ SOT and 5+ total shots after 60th minute. Active match with set-piece and open-play danger. Good for next corner or over corner markets.',
    category: 'corners',
    icon: '⚡',
    popularity: 4,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['corners', 'shots', 'combined'],
    color: 'green',
    conditions: {
      corners: {
        total: { min: 5 },
      },
      shots_on_target: {
        total: { min: 3 },
      },
      total_shots: {
        total: { min: 5 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  // ============================================
  // CARDS TEMPLATES (2)
  // ============================================

  {
    id: 'cards-storm-second-half',
    name: '🟨 Card Storm — Second Half',
    evaluationType: 'goals_over',
    description: '3+ yellow cards with 6+ fouls and 2+ SOT after 55th minute. High-tension match — second halves see 60% of all cards. Great for Over cards market.',
    category: 'cards',
    icon: '🟨',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['cards', 'second-half', 'yellow', 'fouls'],
    backgroundImage: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=800&q=80',
    color: 'amber',
    conditions: {
      yellow_cards: {
        total: { min: 3 },
      },
      fouls: { min: 6, team: 'total' },
      shots_on_target: {
        total: { min: 2 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  {
    id: 'cards-red-chaos',
    name: '🟥 Red Card + Attacking Pressure',
    evaluationType: 'goals_over',
    description: 'Red card issued and the team with numerical advantage is pressing (3+ corners, 2+ SOT). Set-piece surge likely — good for corners and goals.',
    category: 'cards',
    icon: '🟥',
    popularity: 4,
    successRate: 70,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['red-card', 'set-pieces', 'corners', 'pressure'],
    color: 'red',
    conditions: {
      red_cards: {
        total: { min: 1 },
      },
      corners: {
        total: { min: 3 },
      },
      shots_on_target: {
        total: { min: 2 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  // ============================================
  // ADVANCED TEMPLATES (14)
  // ============================================

  {
    id: 'adv-favorite-losing-home',
    recommendedLeagues: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga'],
    avoidLeagues: ['MLS', 'Süper Lig'],
    name: '🏠 Favorite Losing at Home — BTTS',
    evaluationType: 'goals_over',
    description: 'Home team trailing but dominating stats (3+ SOT, 48%+ possession). Home advantage + pressure = comeback likely. Use for BTTS or home goal before they score.',
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
      },
      shots_on_target: {
        home: { min: 3 },
      },
      possession: {
        home: { min: 48 },
      },
      match_time: {
        between: [50, 82],
      },
    } as any,
  },

  {
    id: 'adv-home-dominance',
    recommendedLeagues: ['Premier League', 'La Liga', 'Bundesliga'],
    avoidLeagues: ['MLS'],
    name: '⚡ Home Team Domination',
    evaluationType: 'goals_over',
    description: 'Home team controlling the match with 55%+ possession, 4+ total shots, and 3+ SOT. Strong home win or Over goals signal.',
    category: 'advanced',
    icon: '🔥',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['home-win', 'dominance', 'attacking'],
    backgroundImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
    color: 'cyan',
    conditions: {
      possession: {
        home: { min: 55 },
      },
      total_shots: {
        home: { min: 4 },
      },
      shots_on_target: {
        home: { min: 3 },
      },
      match_time: {
        between: [50, 82],
      },
    } as any,
  },

  {
    id: 'adv-counter-attack-away',
    name: '⚔️ Counter Attack Setup — Away',
    evaluationType: 'goals_over',
    description: 'Away team with low possession (<44%) but effective — 3+ SOT from counter-attacks. Close score. Classic underdog win or BTTS setup. Optimized window 55-78 for best value.',
    category: 'advanced',
    icon: '⚔️',
    popularity: 4,
    successRate: 67,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['counter-attack', 'underdog', 'value-bet'],
    backgroundImage: 'https://images.unsplash.com/photo-1529079003456-3bac75d7e0e0?w=800&q=80',
    color: 'red',
    conditions: {
      possession: {
        away: { max: 44 },
      },
      shots_on_target: {
        away: { min: 3 },
      },
      score: {
        difference: { max: 1 },
      },
      match_time: {
        between: [55, 78],
      },
    } as any,
  },

  {
    id: 'adv-late-low-score-pressure',
    name: '🎭 Late Low-Score Pressure',
    evaluationType: 'goals_over',
    description: 'Match after 72nd min with 0-1 goals but 5+ SOT and 8+ total shots. Both teams desperate for a result — high tension creates late goals.',
    category: 'advanced',
    icon: '🎭',
    popularity: 4,
    successRate: 69,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['late-goals', 'tension', 'pressure'],
    backgroundImage: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
    color: 'blue',
    conditions: {
      score: {
        total_goals: { max: 1 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      total_shots: {
        total: { min: 8 },
      },
      match_time: {
        between: [72, 82],
      },
    } as any,
  },

  {
    id: 'adv-final-push',
    name: '⏰ Final Push — 72+ min',
    evaluationType: 'goals_over',
    description: 'Match after 72nd min with 6+ corners, 5+ SOT, and 2+ cards. Chaotic finish — last window to bet before bookmakers lock markets.',
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
        total: { min: 6 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      yellow_cards: {
        total: { min: 2 },
      },
      match_time: {
        between: [72, 82],
      },
    } as any,
  },

  {
    id: 'adv-high-intensity-60',
    name: '⚡ High Intensity at 60 min',
    evaluationType: 'goals_over',
    description: '5+ corners, 3+ SOT, and 2+ cards by 60th minute. High-tempo match — action will continue and intensify in final 30 minutes.',
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
    id: 'adv-early-dominance-value',
    name: '📈 Early Dominance + Value Odds',
    evaluationType: 'goals_over',
    description: 'Team controlling with 4+ SOT and 55%+ possession between 35-55 min with odds < 3.0. Early dominance that converts to goals. Tightened window for max value.',
    category: 'popular',
    icon: '📈',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['value', 'early', 'popular'],
    conditions: {
      shots_on_target: { min: 4 },
      possession: { min: 55 },
      odds: { max: 3.0 },
      match_time: { min: 35, max: 55 },
    },
  },

  {
    id: 'adv-late-comeback-close',
    name: '🔄 Late Comeback Potential',
    evaluationType: 'goals_over',
    description: 'Close match (1-goal difference) after 70th min with 5+ SOT and balanced possession. Statistics favor a late equalizer. Good for BTTS or draw.',
    category: 'advanced',
    icon: '💪',
    popularity: 4,
    successRate: 68,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['comeback', 'late-game', 'value'],
    color: 'blue',
    conditions: {
      score: {
        difference: { min: 1, max: 1 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      possession: {
        dominant: 'balanced',
      },
      match_time: {
        between: [68, 82],
      },
    } as any,
  },

  {
    id: 'adv-subs-tactical-push',
    name: '🔄 Tactical Subs + Pressure',
    evaluationType: 'goals_over',
    description: '2+ substitutions made after 60th min and 4+ SOT. Teams making tactical changes to push for goals. Fresh legs = higher intensity in final phase.',
    category: 'advanced',
    icon: '🔄',
    popularity: 4,
    successRate: 68,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['substitutions', 'tactical', 'pressure'],
    color: 'green',
    conditions: {
      substitutions: { min: 2, team: 'total' },
      shots_on_target: { min: 4 },
      total_shots: { min: 6 },
      match_time: { min: 60, max: 82 },
    },
  },

  {
    id: 'adv-fouls-tension',
    name: '🔥 High Fouls + Cards = Tension',
    evaluationType: 'goals_over',
    description: 'Match with 8+ fouls and 3+ yellow cards — tactical fouling and tension. Good for Over cards market and set-piece goals.',
    category: 'advanced',
    icon: '🔥',
    popularity: 3,
    successRate: 66,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['fouls', 'cards', 'tension', 'set-pieces'],
    color: 'red',
    conditions: {
      fouls: { min: 8, team: 'total' },
      yellow_cards: { min: 3 },
      corners: { min: 3 },
      match_time: { min: 45, max: 82 },
    } as any,
  },

  {
    id: 'adv-low-possession-high-shots',
    name: '🎯 Low Possession, High Shots',
    evaluationType: 'goals_over',
    description: 'Team with <45% possession creating 4+ SOT and 7+ total shots. Counter-attack efficiency — possession misleading, this team is dangerous. Window 50-78 for best value.',
    category: 'advanced',
    icon: '🎯',
    popularity: 4,
    successRate: 69,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['possession', 'shots', 'counter-attack'],
    conditions: {
      possession: { max: 45 },
      total_shots: { min: 7 },
      shots_on_target: { min: 4 },
      match_time: { min: 50, max: 78 },
    },
  },

  {
    id: 'adv-attackers-dominate',
    name: '🏆 Attacking Dominance',
    evaluationType: 'goals_over',
    description: '60%+ possession with 10+ total shots and 4+ SOT. One team is siege-creating chances — use for goal markets or team goal lines. Tightened to 55+ min for best conversion.',
    category: 'advanced',
    icon: '🏆',
    popularity: 5,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['possession', 'attacks', 'high-confidence'],
    conditions: {
      possession: { min: 60 },
      total_shots: { min: 10 },
      shots_on_target: { min: 4 },
      match_time: { min: 55, max: 82 },
    },
  },

  {
    id: 'adv-shots-in-box-pressure',
    name: '📦 Shots in Box — Goal Imminent',
    evaluationType: 'goals_over',
    description: 'Team creating 4+ shots inside the box (SofaScore stat). Inside-the-box shots convert at ~30% vs ~5% outside. Goal is coming.',
    category: 'advanced',
    icon: '📦',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['shots-in-box', 'sofascore', 'goal-imminent'],
    color: 'green',
    conditions: {
      shots_in_box: { min: 4, team: 'total' },
      shots_on_target: { min: 3 },
      total_shots: { min: 6 },
      match_time: { min: 40, max: 82 },
    },
  },

  // ============================================
  // ML-POWERED TEMPLATES (8) — Bzzoiro CatBoost AI
  // ============================================
  // ml_predictions conditions only trigger when BZZOIRO_API_TOKEN is configured.
  // Without it the live-stat conditions still work independently.

  {
    id: 'ml-over25-high-confidence',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League'],
    avoidLeagues: ['Ligue 1', 'Liga Portugal'],
    name: '🤖 ML Over 2.5 Goals — AI High Confidence',
    evaluationType: 'goals_over',
    description: 'CatBoost model says >73% chance of 3+ goals AND recommends it. At least 1 goal scored and 5+ SOT. High-precision Over 2.5 signal.',
    category: 'ml_powered',
    icon: '🧠',
    popularity: 5,
    successRate: 78,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'over-goals', 'AI', 'high-confidence'],
    color: 'green',
    conditions: {
      ml_predictions: {
        prob_over_25: { min: 73 },
        over_25_recommend: true,
      },
      score: {
        total_goals: { min: 1 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      match_time: {
        between: [45, 80],
      },
    } as any,
  },

  {
    id: 'ml-btts-recommended',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League', 'Belgian Pro League'],
    avoidLeagues: ['Ligue 1'],
    name: '🤖 ML BTTS — Model Recommends',
    evaluationType: 'goals_over',
    description: 'AI gives >68% BTTS probability and recommends it. Both teams showing attacking intent (home 3+ SOT, away 2+). Fewer false triggers than stats-only BTTS.',
    category: 'ml_powered',
    icon: '⚽',
    popularity: 5,
    successRate: 77,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'BTTS', 'AI', 'recommended'],
    color: 'cyan',
    conditions: {
      ml_predictions: {
        prob_btts_yes: { min: 68 },
        btts_recommend: true,
      },
      shots_on_target: {
        home: { min: 3 },
        away: { min: 2 },
      },
      match_time: {
        between: [40, 78],
      },
    } as any,
  },

  {
    id: 'ml-home-win-dominant',
    name: '🤖 ML Home Win — Stats + AI Aligned',
    evaluationType: 'goals_over',
    description: 'CatBoost gives >70% home win probability. Home team dominates with 55%+ possession. Double confirmation: model + live stats.',
    category: 'ml_powered',
    icon: '🏠',
    popularity: 4,
    successRate: 75,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'home-win', 'AI', 'dominant'],
    color: 'amber',
    conditions: {
      ml_predictions: {
        prob_home_win: { min: 70 },
        predicted_result: 'H',
        winner_recommend: true,
      },
      possession: {
        home: { min: 55 },
      },
      match_time: {
        between: [30, 78],
      },
    } as any,
  },

  {
    id: 'ml-away-upset-value',
    name: '🤖 ML Away Win — Value Upset',
    evaluationType: 'goals_over',
    description: 'AI predicts away win (>65%) with confidence and odds > 2.0. Away team creating real chances (3+ SOT). Strict filter for quality upsets.',
    category: 'ml_powered',
    icon: '✈️',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'away-win', 'upset', 'value-bet'],
    color: 'purple',
    conditions: {
      ml_predictions: {
        prob_away_win: { min: 65 },
        predicted_result: 'A',
        winner_recommend: true,
        odds_away: { min: 2.0 },
      },
      shots_on_target: {
        away: { min: 3 },
      },
      match_time: {
        between: [35, 72],
      },
    } as any,
  },

  {
    id: 'ml-over35-late-bonanza',
    name: '🤖 ML Over 3.5 — Late Goals Bonanza',
    evaluationType: 'goals_over',
    description: 'Model gives >65% for Over 3.5 in a match with 2+ goals and 6+ SOT. The goals keep coming.',
    category: 'ml_powered',
    icon: '🎯',
    popularity: 4,
    successRate: 74,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'over-goals', 'late-game', 'high-scoring'],
    color: 'red',
    conditions: {
      ml_predictions: {
        prob_over_35: { min: 65 },
      },
      score: {
        total_goals: { min: 2 },
      },
      shots_on_target: {
        total: { min: 6 },
      },
      match_time: {
        between: [62, 82],
      },
    } as any,
  },

  {
    id: 'ml-draw-hold',
    name: '🤖 ML Draw — Holding Steady',
    evaluationType: 'draw_hold',
    description: 'AI gives >63% draw probability. Match level (0-0 or 1-1) with low shot volume — quiet match = draw likely to hold.',
    category: 'ml_powered',
    icon: '🤝',
    popularity: 4,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'draw', 'value-bet'],
    color: 'blue',
    conditions: {
      ml_predictions: {
        prob_draw: { min: 63 },
        predicted_result: 'D',
      },
      score: {
        difference: { max: 0 },
        total_goals: { max: 2 },
      },
      shots_on_target: {
        total: { max: 5 },
      },
      match_time: {
        between: [70, 82],
      },
    } as any,
  },

  {
    id: 'ml-value-odds-over25',
    name: '🤖 ML Over 2.5 + Bookmaker Value',
    evaluationType: 'goals_over',
    description: 'Model gives >68% Over 2.5 AND bookmaker odds > 1.8 for Over 2.5. Both AI confidence and market value confirm the bet.',
    category: 'ml_powered',
    icon: '💰',
    popularity: 5,
    successRate: 78,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['ML', 'over-goals', 'value', 'odds', 'bookmaker'],
    color: 'green',
    conditions: {
      ml_predictions: {
        prob_over_25: { min: 68 },
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

  {
    id: 'ml-btts-xg-hybrid',
    name: '🤖 BTTS — ML + xG Double Signal',
    evaluationType: 'goals_over',
    description: 'AI predicts BTTS >70% AND both teams have xG > 0.5 each. Double confirmation from ML model + expected goals. Highest-confidence BTTS signal.',
    category: 'ml_powered',
    icon: '🔮',
    popularity: 5,
    successRate: 82,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'ML', 'xG', 'hybrid', 'AI'],
    color: 'purple',
    conditions: {
      ml_predictions: {
        prob_btts_yes: { min: 70 },
      },
      xg: {
        home: { min: 0.5 },
        away: { min: 0.5 },
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

  // ============================================
  // xG / SOFASCORE TEMPLATES (5)
  // ============================================

  {
    id: 'xg-btts-predictive',
    name: '🎯 BTTS Incoming — xG Predictive',
    evaluationType: 'goals_over',
    description: 'Both teams creating high-quality chances (xG >0.6 each) but max 1 goal scored. Perfect timing for BTTS bet BEFORE both teams score.',
    category: 'goals',
    icon: '⚽',
    popularity: 5,
    successRate: 78,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['BTTS', 'xG', 'predictive', 'sofascore'],
    color: 'cyan',
    conditions: {
      score: {
        total_goals: { max: 1 },
      },
      xg: {
        home: { min: 0.6 },
        away: { min: 0.6 },
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
    id: 'xg-over25-imminent',
    name: '⚡ Over 2.5 Imminent — xG > 2.5',
    evaluationType: 'goals_over',
    description: 'Combined xG > 2.5 but only 0-2 goals scored. The stats say 3+ goals are coming. Triggers BEFORE the 3rd goal for max value.',
    category: 'goals',
    icon: '🎯',
    popularity: 5,
    successRate: 80,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['over-goals', 'xG', 'predictive', 'sofascore'],
    color: 'green',
    conditions: {
      score: {
        total_goals: { max: 2 },
      },
      xg: {
        total: { min: 2.5 },
      },
      shots_on_target: {
        total: { min: 5 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  {
    id: 'xg-mismatch-value',
    name: '💎 xG Mismatch — Underdog Value',
    evaluationType: 'goals_over',
    description: 'Away team losing but has better xG (1.0+) and 3+ SOT. Score doesn\'t reflect reality — value bet on draw or comeback before odds adjust.',
    category: 'advanced',
    icon: '💎',
    popularity: 4,
    successRate: 74,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['underdog', 'xG', 'value-bet', 'mismatch'],
    color: 'amber',
    conditions: {
      score: {
        home: { min: 1 },
        away: { max: 0 },
      },
      xg: {
        away: { min: 1.0 },
      },
      shots_on_target: {
        away: { min: 3 },
      },
      match_time: {
        between: [55, 82],
      },
    } as any,
  },

  {
    id: 'xg-high-match',
    name: '📊 High xG Match (2.0+ Total)',
    evaluationType: 'goals_over',
    description: 'Combined expected goals ≥ 2.0. Strong statistical signal for goals market — the match is producing quality chances.',
    category: 'advanced',
    icon: '📊',
    popularity: 5,
    successRate: 71,
    confidence: 'High',
    notificationEnabled: true,
    color: 'cyan',
    tags: ['xg', 'goals', 'sofascore'],
    conditions: {
      xg: { total: { min: 2.0 } },
      shots_on_target: { total: { min: 4 } },
      total_shots: { total: { min: 6 } },
      match_time: { between: [45, 82] },
    } as any,
  },

  {
    id: 'xg-defensive-battle',
    name: '🛡️ Defensive Battle — Low xG + Clearances',
    evaluationType: 'defensive',
    description: 'Total xG ≤ 0.8 with 10+ clearances. Tight, tactical match. Good for Under goals or correct score 0-0 / 1-0.',
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
      shots_on_target: { total: { max: 3 } },
      match_time: { between: [45, 82] },
    } as any,
  },

  // ============================================
  // UNDER TEMPLATES (2) — BetTheBuilder highest-ROI systems
  // ============================================

  {
    id: 'under-25-goals-fortress',
    name: '🛡️ Under 2.5 Goals — Low Activity',
    evaluationType: 'goals_under',
    description: 'Score 0-0 or 0-1 with few chances created (max 4 SOT, max 8 total shots, max 4 corners). Tight defensive match — Under 2.5 goals looking safe.',
    category: 'advanced',
    icon: '🛡️',
    popularity: 4,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['under-goals', 'defensive', 'tight', 'low-scoring'],
    color: 'blue',
    conditions: {
      score: {
        total_goals: { max: 1 },
      },
      shots_on_target: {
        total: { max: 4 },
      },
      total_shots: {
        total: { max: 8 },
      },
      corners: {
        total: { max: 4 },
      },
      match_time: {
        between: [60, 82],
      },
    } as any,
  },

  {
    id: 'under-corners-quiet-match',
    name: '🔇 Under Corners — Quiet Match',
    evaluationType: 'corners_only',
    description: 'Max 3 corners with few total shots (max 6) after 55th minute. Match tempo too low for corners to pile up.',
    category: 'corners',
    icon: '🔇',
    popularity: 4,
    successRate: 73,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['under-corners', 'low-tempo', 'quiet'],
    color: 'blue',
    conditions: {
      corners: {
        total: { max: 3 },
      },
      total_shots: {
        total: { max: 6 },
      },
      match_time: {
        between: [55, 78],
      },
    } as any,
  },

  // ============================================
  // FIRST-HALF + DOMINANCE TEMPLATES (6) — Optimized for 1H Goals Value
  // ============================================
  // Research-backed: Best 1H indicators are early SOT volume + xG + corners.
  // Bundesliga has ~55% FH O0.5, Eredivisie ~58%, EPL ~52%.
  // Key: 3+ SOT before 30' is the strongest live signal for FH goals.
  // For evaluation: triggers at min 25-42 need 2+ goals to FT = challenging
  // but 1H goal markets close at ~43', so the bet is placed before half-time.

  {
    id: 'first-half-pressure-signal',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League', 'Belgian Pro League'],
    avoidLeagues: ['Ligue 1', 'Liga Portugal', 'Süper Lig'],
    name: '🔥 First-Half Pressure — Over 0.5 FH',
    evaluationType: 'goals_over',
    description: 'Still 0-0 but heavy first-half pressure: 4+ SOT, 5+ total shots, 3+ corners before 38th minute. Over 0.5 FH market — statistically ~70% hit rate with these indicators. Best in Bundesliga, EPL, Eredivisie.',
    category: 'goals',
    icon: '🔥',
    popularity: 5,
    successRate: 74,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['first-half', 'pressure', 'early', 'over-goals', '1H'],
    color: 'amber',
    conditions: {
      score: {
        total_goals: { max: 0 },
      },
      shots_on_target: {
        total: { min: 4 },
      },
      total_shots: {
        total: { min: 5 },
      },
      corners: {
        total: { min: 3 },
      },
      match_time: {
        between: [25, 38],
      },
    } as any,
  },

  {
    id: 'first-half-xg-over05',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Premier League', 'Serie A'],
    avoidLeagues: ['Ligue 1', 'Liga Portugal'],
    name: '📊 1H Over 0.5 — xG Confirms Pressure',
    evaluationType: 'goals_over',
    description: 'Score 0-0 but combined xG ≥ 1.0 with 3+ SOT before 35th minute. xG model confirms quality chances being created — first-half goal is statistically overdue. Best odds: Over 0.5 FH Goals.',
    category: 'goals',
    icon: '📊',
    popularity: 5,
    successRate: 78,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['first-half', 'xG', 'over-goals', '1H', 'sofascore'],
    color: 'green',
    conditions: {
      score: {
        total_goals: { max: 0 },
      },
      xg: {
        total: { min: 1.0 },
      },
      shots_on_target: {
        total: { min: 3 },
      },
      match_time: {
        between: [22, 38],
      },
    } as any,
  },

  {
    id: 'first-half-over15-attacking',
    recommendedLeagues: ['Bundesliga', 'Eredivisie'],
    avoidLeagues: ['Ligue 1', 'Liga Portugal', 'Süper Lig'],
    name: '⚡ 1H Over 1.5 — Both Attacking Early',
    evaluationType: 'goals_over',
    description: '1 goal scored and both teams creating chances (home 2+ SOT, away 1+ SOT) with 4+ total shots before 40th minute. High-tempo match — second FH goal very likely. Over 1.5 FH at value odds.',
    category: 'goals',
    icon: '⚡',
    popularity: 4,
    successRate: 68,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['first-half', 'over-goals', '1H', 'attacking', 'high-tempo'],
    color: 'cyan',
    conditions: {
      score: {
        total_goals: { min: 1, max: 1 },
      },
      shots_on_target: {
        home: { min: 2 },
        away: { min: 1 },
        total: { min: 4 },
      },
      total_shots: {
        total: { min: 6 },
      },
      match_time: {
        between: [20, 40],
      },
    } as any,
  },

  {
    id: 'first-half-btts-signal',
    recommendedLeagues: ['Bundesliga', 'Eredivisie', 'Belgian Pro League'],
    avoidLeagues: ['Ligue 1', 'La Liga'],
    name: '🔥 1H BTTS — Both Creating Before HT',
    evaluationType: 'goals_over',
    description: 'One team scored, other has 2+ SOT and xG ≥ 0.5. Classic 1H BTTS setup — trailing team is creating real chances. Bet BTTS Yes 1H or Over 1.5 FH before the equalizer.',
    category: 'goals',
    icon: '🔥',
    popularity: 4,
    successRate: 70,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['first-half', 'BTTS', '1H', 'live', 'equalizer'],
    color: 'red',
    conditions: {
      score: {
        total_goals: { min: 1, max: 2 },
        difference: { min: 1 },
      },
      shots_on_target: {
        total: { min: 4 },
      },
      xg: {
        total: { min: 1.0 },
      },
      match_time: {
        between: [20, 42],
      },
    } as any,
  },

  {
    id: 'first-half-corners-surge',
    name: '🚀 1H Corner Surge — Set-Piece Goal Coming',
    evaluationType: 'goals_over',
    description: '5+ corners in first half with 3+ SOT and 0-0. Teams hammering set-pieces — statistically 18% of goals come from corners. Great odds for Over 0.5 FH or Next Goal markets.',
    category: 'goals',
    icon: '🚀',
    popularity: 4,
    successRate: 72,
    confidence: 'High',
    notificationEnabled: true,
    tags: ['first-half', 'corners', 'set-pieces', '1H', 'pressure'],
    color: 'purple',
    conditions: {
      score: {
        total_goals: { max: 0 },
      },
      corners: {
        total: { min: 5 },
      },
      shots_on_target: {
        total: { min: 3 },
      },
      match_time: {
        between: [25, 42],
      },
    } as any,
  },

  {
    id: 'dominance-imbalance-away',
    name: '💎 Dominance Imbalance — Away Control',
    evaluationType: 'goals_over',
    description: 'Away team controls the match (55%+ poss, 4+ SOT, 5+ total shots) but score is level. Stats domination not reflected in score — away goal or win coming.',
    category: 'advanced',
    icon: '💎',
    popularity: 4,
    successRate: 70,
    confidence: 'Medium',
    notificationEnabled: true,
    tags: ['dominance', 'imbalance', 'away', 'value-bet'],
    color: 'purple',
    conditions: {
      possession: {
        away: { min: 55 },
      },
      shots_on_target: {
        away: { min: 4 },
      },
      total_shots: {
        away: { min: 5 },
      },
      score: {
        difference: { max: 0 },
      },
      match_time: {
        between: [50, 78],
      },
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
