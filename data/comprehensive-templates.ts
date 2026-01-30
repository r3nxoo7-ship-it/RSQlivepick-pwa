// ============================================
// R$Q - COMPREHENSIVE FILTER TEMPLATES
// ============================================
// 50+ Advanced templates with extended conditions

import { ExtendedFilterConditions } from '@/lib/extended-filters';

export interface FilterTemplate {
  name: string;
  description: string;
  category: string;
  conditions: ExtendedFilterConditions;
  tags: string[];
}

// ============================================
// TEMPLATE CATEGORIES
// ============================================

export const CATEGORIES = {
  CORNERS: 'Corners',
  SHOTS: 'Shots',
  CARDS: 'Cards',
  SCORE: 'Score',
  POSSESSION: 'Possession',
  ADVANCED: 'Advanced',
  LIVE_BETTING: 'Live Betting',
  DEFENSIVE: 'Defensive',
  HIGH_SCORING: 'High Scoring',
  TEAM_SPECIFIC: 'Team Specific',
};

// ============================================
// TEMPLATES
// ============================================

export const filterTemplates: FilterTemplate[] = [
  // ========== CORNERS (10 templates) ==========
  
  {
    name: 'Over 9.5 Corners',
    description: 'Minimum 10 corners total in the match',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: { total: { min: 10 } },
      match_time: { after: 30 },
    },
    tags: ['popular', 'corners', 'total'],
  },
  
  {
    name: 'Over 11.5 Corners',
    description: 'Minimum 12 corners total',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: { total: { min: 12 } },
      match_time: { after: 35 },
    },
    tags: ['corners', 'high'],
  },
  
  {
    name: 'Home Dominant Corners',
    description: 'Home team with at least 7 corners, away max 3',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: {
        home: { min: 7 },
        away: { max: 3 },
      },
      match_time: { after: 40 },
    },
    tags: ['corners', 'home', 'dominant'],
  },
  
  {
    name: 'Away Dominant Corners',
    description: 'Away team with at least 7 corners, home max 3',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: {
        away: { min: 7 },
        home: { max: 3 },
      },
      match_time: { after: 40 },
    },
    tags: ['corners', 'away', 'dominant'],
  },
  
  {
    name: 'Balanced Corners',
    description: 'Both teams 4-6 corners each',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: {
        home: { min: 4, max: 6 },
        away: { min: 4, max: 6 },
      },
      match_time: { after: 50 },
    },
    tags: ['corners', 'balanced'],
  },
  
  {
    name: 'Second Half Corners',
    description: 'At least 6 corners after minute 60',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: { total: { min: 6 } },
      match_time: { after: 60 },
    },
    tags: ['corners', 'second-half', 'late'],
  },
  
  {
    name: 'Late Match Corners',
    description: 'Over 12 corners before minute 85',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: { total: { min: 12 } },
      match_time: { before: 85 },
    },
    tags: ['corners', 'final', 'urgent'],
  },
  
  {
    name: 'Early Corners',
    description: 'Minimum 5 corners before minute 25',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: { total: { min: 5 } },
      match_time: { before: 25 },
    },
    tags: ['corners', 'early', 'fast'],
  },
  
  {
    name: 'Corner Interval',
    description: '6+ corners between minutes 20-45',
    category: CATEGORIES.CORNERS,
    conditions: {
      corners: { total: { min: 6 } },
      match_time: { between: [20, 45] },
    },
    tags: ['corners', 'interval', 'first-half'],
  },
  
  
  // ========== SHOTS (10 templates) ==========
  
  {
    name: 'Over 20 Shots',
    description: 'Minimum 21 shots total',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { total: { min: 21 } },
      match_time: { after: 40 },
    },
    tags: ['shots', 'offensive', 'total'],
  },
  
  {
    name: 'Shots on Target 10+',
    description: 'Minimum 10 shots on target total',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots_on_target: { total: { min: 10 } },
      match_time: { after: 50 },
    },
    tags: ['shots', 'on-target', 'precision'],
  },
  
  {
    name: 'Home Attack Minded',
    description: 'Home: 12+ shots, 5+ on target',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { home: { min: 12 } },
      shots_on_target: { home: { min: 5 } },
      match_time: { after: 45 },
    },
    tags: ['shots', 'home', 'attack'],
  },
  
  {
    name: 'Away Counter Attack',
    description: 'Away: 8+ shots, 4+ on target',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { away: { min: 8 } },
      shots_on_target: { away: { min: 4 } },
      match_time: { after: 40 },
    },
    tags: ['shots', 'away', 'counter'],
  },
  
  {
    name: 'High Accuracy',
    description: 'At least 50% shots on target (e.g. 8/16)',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { total: { min: 16 } },
      shots_on_target: { total: { min: 8 } },
      match_time: { after: 55 },
    },
    tags: ['shots', 'accuracy', 'quality'],
  },
  
  {
    name: 'Shots First Half',
    description: '10+ shots before halftime',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { total: { min: 10 } },
      match_time: { before: 45 },
    },
    tags: ['shots', 'first-half', 'early'],
  },
  
  {
    name: 'Late Pressure',
    description: '15+ shots after minute 70',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { total: { min: 15 } },
      match_time: { after: 70 },
    },
    tags: ['shots', 'late', 'pressure'],
  },
  
  {
    name: 'Balanced Shooting',
    description: 'Both teams 8-12 shots each',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: {
        home: { min: 8, max: 12 },
        away: { min: 8, max: 12 },
      },
      match_time: { after: 60 },
    },
    tags: ['shots', 'balanced', 'equal'],
  },
  
  {
    name: 'Shooting Frenzy',
    description: 'Over 30 shots total!',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { total: { min: 30 } },
      match_time: { after: 60 },
    },
    tags: ['shots', 'extreme', 'frenzy'],
  },
  
  {
    name: 'Low Shots Defensive',
    description: 'Under 12 shots after minute 50 (defensive match)',
    category: CATEGORIES.SHOTS,
    conditions: {
      shots: { total: { max: 11 } },
      match_time: { after: 50 },
    },
    tags: ['shots', 'under', 'defensive'],
  },
  
  // ========== CARDS (10 templates) ==========
  
  {
    name: 'Over 4.5 Cards',
    description: 'Minimum 5 yellow cards total',
    category: CATEGORIES.CARDS,
    conditions: {
      yellow_cards: { total: { min: 5 } },
      match_time: { after: 50 },
    },
    tags: ['cards', 'yellow', 'rough'],
  },
  
  {
    name: 'Red Card Likely',
    description: '6+ yellow cards, looking for a red',
    category: CATEGORIES.CARDS,
    conditions: {
      yellow_cards: { total: { min: 6 } },
      red_cards: { total: { max: 0 } },
      match_time: { after: 55, before: 85 },
    },
    tags: ['cards', 'red', 'escalation'],
  },
  
  {
    name: 'Heated Match',
    description: '7+ yellow or 2+ red cards (heated game)',
    category: CATEGORIES.CARDS,
    conditions: {
      combined: {
        any: [
          { yellow_cards: { total: { min: 7 } } },
          { red_cards: { total: { min: 2 } } },
        ],
      },
      match_time: { after: 60 },
    },
    tags: ['cards', 'extreme', 'heated'],
  },
  
  {
    name: 'Home Aggressive Cards',
    description: 'Home 4+ cards, away max 2',
    category: CATEGORIES.CARDS,
    conditions: {
      yellow_cards: {
        home: { min: 4 },
        away: { max: 2 },
      },
      match_time: { after: 50 },
    },
    tags: ['cards', 'home', 'aggressive'],
  },
  
  {
    name: 'Away Rough Play',
    description: 'Away team 4+ cards',
    category: CATEGORIES.CARDS,
    conditions: {
      yellow_cards: { away: { min: 4 } },
      match_time: { after: 45 },
    },
    tags: ['cards', 'away', 'rough'],
  },
  
  {
    name: 'Early Cards',
    description: '3+ cards before minute 30',
    category: CATEGORIES.CARDS,
    conditions: {
      yellow_cards: { total: { min: 3 } },
      match_time: { before: 30 },
    },
    tags: ['cards', 'early', 'aggressive-start'],
  },
  
  
  {
    name: 'Balanced Cards',
    description: 'Both teams 2-3 cards each',
    category: CATEGORIES.CARDS,
    conditions: {
      yellow_cards: {
        home: { min: 2, max: 3 },
        away: { min: 2, max: 3 },
      },
      match_time: { after: 55 },
    },
    tags: ['cards', 'balanced', 'even'],
  },
  
  // ========== SCORE (10 templates) ==========
  
  {
    name: '0-0 Defensive',
    description: 'Score 0-0, defensive match after minute 60',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { exact: { home: 0, away: 0 } },
      match_time: { after: 60 },
      shots_on_target: { total: { max: 4 } },
    },
    tags: ['score', '0-0', 'defensive'],
  },
  
  {
    name: '0-0 High Chances',
    description: '0-0 but many chances; a goal likely',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { exact: { home: 0, away: 0 } },
      shots_on_target: { total: { min: 8 } },
      match_time: { after: 50, before: 75 },
    },
    tags: ['score', '0-0', 'btts-likely'],
  },
  
  
  {
    name: 'Over 2.5 Goals',
    description: 'Minimum 3 goals in the match',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { total_goals: { min: 3 } },
      match_time: { after: 50 },
    },
    tags: ['score', 'over-2.5', 'goals'],
  },
  
  {
    name: 'Over 3.5 Goals',
    description: 'Minimum 4 goals, high-scoring match',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { total_goals: { min: 4 } },
      match_time: { after: 60 },
    },
    tags: ['score', 'over-3.5', 'high-scoring'],
  },
  
  
  {
    name: 'Home Winning Big',
    description: 'Home team leading by 2+ goals',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { difference: { min: 2 } },
      combined: {
        all: [
          { score: { home: { min: 2 } } },
        ],
      },
      match_time: { after: 60 },
    },
    tags: ['score', 'big-lead', 'home'],
  },
  
  {
    name: 'Comeback Potential',
    description: 'Losing by 1 goal with high pressure; comeback possible',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { difference: { exact: 1 } },
      shots: { total: { min: 15 } },
      corners: { total: { min: 8 } },
      match_time: { after: 65, before: 85 },
    },
    tags: ['score', 'comeback', 'pressure', 'live-betting'],
  },
  
  {
    name: 'BTTS Yes',
    description: 'Both teams have scored',
    category: CATEGORIES.SCORE,
    conditions: {
      score: {
        home: { min: 1 },
        away: { min: 1 },
      },
      match_time: { after: 50 },
    },
    tags: ['score', 'btts', 'both-score'],
  },
  
  {
    name: 'Under 1.5 First Half',
    description: 'Max 1 goal in the first half',
    category: CATEGORIES.SCORE,
    conditions: {
      score: { total_goals: { max: 1 } },
      match_time: { before: 45 },
    },
    tags: ['score', 'under', 'first-half', 'defensive'],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): FilterTemplate[] {
  return filterTemplates.filter(t => t.category === category);
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): FilterTemplate[] {
  return filterTemplates.filter(t => t.tags.includes(tag));
}

/**
 * Search templates
 */
export function searchTemplates(query: string): FilterTemplate[] {
  const lowerQuery = query.toLowerCase();
  return filterTemplates.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.includes(lowerQuery))
  );
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  return Object.values(CATEGORIES);
}

/**
 * Get all tags
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  filterTemplates.forEach(t => t.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort();
}

// ============================================
// EXPORT
// ============================================

export default {
  filterTemplates,
  CATEGORIES,
  getTemplatesByCategory,
  getTemplatesByTag,
  searchTemplates,
  getAllCategories,
  getAllTags,
};
