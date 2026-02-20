// ============================================
// IMPROVED FILTER TEMPLATES - ALL USING EXTENDED CONDITIONS
// ============================================
// This file contains improved versions of all templates using ExtendedFilterConditions

import type { ExtendedFilterConditions } from '@/lib/extended-filters';

export interface ImprovedFilterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'corners' | 'goals' | 'cards' | 'shots' | 'advanced' | 'popular' | 'experimental';
  conditions: ExtendedFilterConditions;
  icon: string;
  popularity: number;
  successRate?: number;
  notificationEnabled: boolean;
  tags: string[];
  experimental?: boolean;
  confidence?: 'Low' | 'Medium' | 'High';
  backgroundImage?: string;
  color?: 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'red';
}

// Mapping function to convert to old format for compatibility
export function convertToLegacyFormat(template: ImprovedFilterTemplate): any {
  return {
    ...template,
    conditions: template.conditions as any,
  };
}

export const IMPROVED_LIVEPICK_TEMPLATES: ImprovedFilterTemplate[] = [
  {
    id: 'livepick-favorite-losing-home-v2',
    name: '🏠 Favorite Losing at Home (BTTS Opportunity)',
    description: 'Home team is losing but dominating with shots on target and possession. Classic BTTS setup - home team will push for comeback, both teams likely to score.',
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
        home: { max: 0 }, // Home not scored yet
        away: { min: 1 }, // Away winning
        difference: { min: 1, max: 2 }, // Losing by 1-2 goals
      },
      shots_on_target: {
        home: { min: 4 }, // Home has quality chances
        total: { min: 6 }, // High total shots
      },
      dangerous_attacks: {
        home: { min: 8 }, // Home creating pressure
      },
      possession: {
        home: { min: 50 }, // Home has possession
      },
      match_time: {
        between: [55, 80],
      },
    },
  },

  {
    id: 'livepick-high-momentum-home-v2',
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
        home: { min: 55 }, // Home dominant
        dominant: 'home',
      },
      dangerous_attacks: {
        home: { min: 10 }, // Home creating chances
      },
      shots_on_target: {
        home: { min: 5 }, // Home quality shots
      },
      corners: {
        home: { min: 4 }, // Home corner pressure
      },
      match_time: {
        between: [60, 85],
      },
    },
  },

  {
    id: 'livepick-over-25-goals-scenario-v2',
    name: '⚽ Over 2.5 Goals Scenario (Live)',
    description: 'Match shows all indicators for 3+ total goals: already 1-2 scored with high shots, dangerous attacks, and balanced attacking. Perfect timing for over 2.5 goals bet.',
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
        total_goals: { min: 1, max: 2 }, // Already 1-2 goals
      },
      shots_on_target: {
        home: { min: 3 }, // Both teams shooting
        away: { min: 3 },
        total: { min: 8 },
      },
      dangerous_attacks: {
        total: { min: 15 }, // Very attacking
      },
      corners: {
        total: { min: 6 },
      },
      match_time: {
        between: [60, 80],
      },
    },
  },

  {
    id: 'livepick-corner-rush-v2',
    name: '🚀 Corner Rush (High Action)',
    description: 'Explosive corner activity with sustained attacking pressure from both teams. Perfect for corner betting - rush continues into final minutes.',
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
        total: { min: 8 }, // Already high corners
      },
      shots_on_target: {
        total: { min: 6 },
      },
      dangerous_attacks: {
        total: { min: 12 }, // Continuous pressure
      },
      match_time: {
        between: [70, 88],
      },
      trends: {
        corners_increasing: true, // Corners trending up
      },
    },
  },

  {
    id: 'livepick-late-comeback-potential-v2',
    name: '🔄 Late Comeback Potential',
    description: 'Close match with losing team having superior stats - possession, shots, attacks all favoring comeback. Perfect for BTTS or draw.',
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
      score: {
        difference: { min: 1, max: 1 }, // Losing by exactly 1 goal
        total_goals: { min: 1, max: 2 },
      },
      shots_on_target: {
        total: { min: 8 }, // Many chances
      },
      dangerous_attacks: {
        total: { min: 14 },
      },
      possession: {
        dominant: 'balanced', // Balanced or losing team has possession
      },
      match_time: {
        between: [70, 88],
      },
    },
  },

  {
    id: 'livepick-aggressive-counter-v2',
    name: '⚔️ Aggressive Counter Attack',
    description: 'Away team with low possession but high shot quality and dangerous attacks - classic counter-attacking setup. Good for underdog win or BTTS.',
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
        away: { max: 45 }, // Away low possession
        home: { min: 55 }, // Home dominant
      },
      shots_on_target: {
        away: { min: 4 }, // But away has quality shots
      },
      dangerous_attacks: {
        away: { min: 6 }, // Away counter-attacking
      },
      score: {
        difference: { max: 1 }, // Close game
      },
      match_time: {
        between: [45, 75],
      },
    },
  },

  {
    id: 'livepick-both-teams-pressing-v2',
    name: '🔥 Both Teams Pressing (High Intensity)',
    description: 'Both teams creating chances with high shots on target and attacks from BOTH sides. Perfect BTTS or over goals scenario with balanced attack.',
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
        home: { min: 3 }, // Home shooting
        away: { min: 3 }, // Away shooting
        total: { min: 10 },
      },
      dangerous_attacks: {
        home: { min: 6 }, // Home attacking
        away: { min: 6 }, // Away attacking
        total: { min: 16 },
      },
      corners: {
        total: { min: 8 },
      },
      possession: {
        dominant: 'balanced', // Balanced match
      },
      match_time: {
        between: [55, 80],
      },
    },
  },

  {
    id: 'livepick-late-pressure-draw-v2',
    name: '🎭 Late Pressure Match',
    description: 'Low-scoring match (0-0 or 1-0) with both teams creating many chances late - high probability one team breaks through or both score. Perfect for late goals.',
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
        total_goals: { max: 1 }, // Still 0-0 or 1-0/0-1
      },
      shots_on_target: {
        home: { min: 3 }, // Both creating chances
        away: { min: 3 },
        total: { min: 8 },
      },
      dangerous_attacks: {
        total: { min: 14 },
      },
      corners: {
        total: { min: 8 },
      },
      match_time: {
        between: [75, 89],
      },
    },
  },

  {
    id: 'livepick-red-card-chaos-v2',
    name: '🟥 Red Card Chaos (Set Piece Surge)',
    description: 'Red card issued with sustained attacking pressure. Team with numerical advantage will create corner surge and set-piece opportunities.',
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
        total: { min: 1 }, // Red card shown
      },
      corners: {
        total: { min: 5 },
      },
      dangerous_attacks: {
        total: { min: 8 },
      },
      match_time: {
        after: 60,
      },
      trends: {
        corners_increasing: true, // Corners trending up
      },
    },
  },

  {
    id: 'livepick-final-10-minutes-madness-v2',
    name: '⏰ Final 10 Minutes Madness',
    description: 'Match in final 10 minutes with very high activity - corners, shots, cards all elevated. Perfect for late corner, card, or goal markets.',
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
        total: { min: 9 }, // High corners
      },
      shots_on_target: {
        total: { min: 7 },
      },
      yellow_cards: {
        total: { min: 3 }, // Physical match
      },
      dangerous_attacks: {
        total: { min: 14 }, // High pressure
      },
      match_time: {
        between: [80, 90],
      },
      trends: {
        corners_increasing: true,
        shots_increasing: true,
      },
    },
  },
];

// Convert all improved templates to legacy format for export
export const LEGACY_FORMAT_TEMPLATES = IMPROVED_LIVEPICK_TEMPLATES.map(convertToLegacyFormat);

const filterTemplatesImproved = {
  improved: IMPROVED_LIVEPICK_TEMPLATES,
  legacy: LEGACY_FORMAT_TEMPLATES,
};

export default filterTemplatesImproved;
