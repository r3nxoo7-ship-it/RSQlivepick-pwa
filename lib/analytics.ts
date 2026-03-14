// ============================================
// R$Q - ANALYTICS LIBRARY
// ============================================
// Helper functions for filter analytics and statistics

import { Filter, TriggeredMatch } from './supabase';

// ============================================
// EVALUATION TYPE — How filters should be judged
// ============================================
export type EvaluationType = 'goals_over' | 'goals_under' | 'draw_hold' | 'defensive' | 'corners_only';

/**
 * Templates excluded from goal-movement evaluation.
 * These are judged differently (low scoring = success for them).
 */
const EXCLUDED_TEMPLATE_IDS = new Set([
  'xg-defensive-battle',
  'under-25-goals-fortress',
  'under-corners-quiet-match',
  'ml-draw-hold',
]);

/**
 * Determine evaluation type from template ID or filter name.
 */
export function getEvaluationType(templateId?: string, filterName?: string): EvaluationType {
  const id = templateId || '';
  const name = (filterName || '').toLowerCase();

  // Defensive / under templates
  if (EXCLUDED_TEMPLATE_IDS.has(id)) {
    if (id === 'xg-defensive-battle') return 'defensive';
    if (id === 'ml-draw-hold') return 'draw_hold';
    if (id === 'under-25-goals-fortress') return 'goals_under';
    if (id === 'under-corners-quiet-match') return 'corners_only';
  }

  // Name-based fallback detection
  if (name.includes('under 2.5') || name.includes('under goals') || name.includes('fortress')) return 'goals_under';
  if (name.includes('draw') && (name.includes('hold') || name.includes('ml'))) return 'draw_hold';
  if (name.includes('defensive battle') || name.includes('low xg')) return 'defensive';
  if (name.includes('under corner') || name.includes('quiet match')) return 'corners_only';
  if (id.startsWith('corners-') && !name.includes('over') && !name.includes('goal')) return 'corners_only';

  // Everything else is goals_over
  return 'goals_over';
}

/**
 * Compute auto_success for a single triggered match record using the user's
 * evaluation criteria:
 *   - Trigger at min 1-55: success if total goals added from trigger to FT >= 2
 *   - Trigger at min 56+:  success if total goals added from trigger to FT >= 1
 *
 * Returns null if:
 *   - Final scores are unknown
 *   - Template is excluded (defensive/under/draw)
 *   - Match time is unknown
 */
export function computeAutoSuccess(
  matchTime: number | null,
  scoreHome: number | null,
  scoreAway: number | null,
  finalScoreHome: number | null,
  finalScoreAway: number | null,
  evaluationType: EvaluationType
): boolean | null {
  // Can't evaluate without scores
  if (finalScoreHome == null || finalScoreAway == null) return null;
  if (scoreHome == null || scoreAway == null) return null;
  if (matchTime == null) return null;

  // Only evaluate goals_over templates with the standard criteria
  if (evaluationType !== 'goals_over') {
    // For goals_under: success = no more than 0 goals added (match stays low)
    if (evaluationType === 'goals_under') {
      const goalsAdded = (finalScoreHome + finalScoreAway) - (scoreHome + scoreAway);
      return goalsAdded === 0; // No more goals = under held
    }
    // For draw_hold: success = final result is a draw
    if (evaluationType === 'draw_hold') {
      return finalScoreHome === finalScoreAway;
    }
    // defensive / corners_only: skip auto-eval
    return null;
  }

  const goalsAdded = (finalScoreHome + finalScoreAway) - (scoreHome + scoreAway);

  if (matchTime <= 55) {
    return goalsAdded >= 2;
  } else {
    return goalsAdded >= 1;
  }
}

/**
 * Compute the effective success for a triggered match.
 * Priority: user_feedback > auto_success
 */
export function getEffectiveSuccess(
  userFeedback: boolean | null | undefined,
  autoSuccess: boolean | null | undefined
): boolean | null {
  if (userFeedback !== null && userFeedback !== undefined) return userFeedback;
  if (autoSuccess !== null && autoSuccess !== undefined) return autoSuccess;
  return null;
}

// ============================================
// TYPES
// ============================================
export interface PerformanceData {
  date: string;
  triggers: number;
  successful: number;
  successRate: number;
}

export interface CategoryStats {
  corners: number;
  shots: number;
  cards: number;
  mixed: number;
}

export interface FilterStats {
  filterId: string | number;
  filterName: string;
  totalTriggers: number;
  successRate: number;
  avgTriggersPerDay: number;
  lastTriggered?: string | null;
  isActive: boolean;
  notificationsEnabled: boolean;
  telegramEnabled: boolean;
}

// ============================================
// FILTER ANALYTICS
// ============================================

/**
 * Calculate comprehensive stats for a single filter
 */
export function calculateFilterStats(filter: Filter): FilterStats {
  const totalTriggers = filter.trigger_count || 0;
  const successRate = filter.success_rate || 0;
  
  // Calculate avg triggers per day
  const createdAt = new Date(filter.created_at);
  const now = new Date();
  const daysSinceCreation = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  const avgTriggersPerDay = totalTriggers / daysSinceCreation;
  
  return {
    filterId: filter.id,
    filterName: filter.name,
    totalTriggers,
    successRate,
    avgTriggersPerDay: Math.round(avgTriggersPerDay * 10) / 10,
    lastTriggered: filter.last_triggered,
    isActive: filter.is_active,
    notificationsEnabled: filter.notification_enabled,
    telegramEnabled: filter.telegram_enabled || false,
  };
}

/**
 * Calculate stats for all filters
 */
export function calculateAllFiltersStats(filters: Filter[]): {
  total: number;
  active: number;
  withNotifications: number;
  withTelegram: number;
  totalTriggers: number;
  avgSuccessRate: number;
  topPerformers: FilterStats[];
} {
  const stats = filters.map(calculateFilterStats);
  
  return {
    total: filters.length,
    active: filters.filter(f => f.is_active).length,
    withNotifications: filters.filter(f => f.notification_enabled).length,
    withTelegram: filters.filter(f => f.telegram_enabled).length,
    totalTriggers: stats.reduce((sum, s) => sum + s.totalTriggers, 0),
    avgSuccessRate: stats.length > 0 
      ? stats.reduce((sum, s) => sum + s.successRate, 0) / stats.length 
      : 0,
    topPerformers: stats
      .sort((a, b) => b.totalTriggers - a.totalTriggers)
      .slice(0, 5),
  };
}

/**
 * Categorize filters by type
 */
export function categorizeFilters(filters: Filter[]): CategoryStats {
  const categories: CategoryStats = {
    corners: 0,
    shots: 0,
    cards: 0,
    mixed: 0,
  };
  
  filters.forEach(filter => {
    const conditions = filter.conditions;
    const hasCorners = !!(conditions.corners?.min || conditions.corners?.max);
    const hasShots = !!(conditions.shots_on_target?.min || conditions.total_shots?.min);
    const hasCards = !!(conditions.yellow_cards?.min || conditions.red_cards?.min);
    
    const activeConditions = [hasCorners, hasShots, hasCards].filter(Boolean).length;
    
    if (activeConditions === 0) {
      return; // Skip empty filters
    } else if (activeConditions === 1) {
      if (hasCorners) categories.corners++;
      else if (hasShots) categories.shots++;
      else if (hasCards) categories.cards++;
    } else {
      categories.mixed++;
    }
  });
  
  return categories;
}

/**
 * Generate performance trend data (mock for now)
 * In production, this would query actual match history
 */
export function generatePerformanceTrend(filters: Filter[], days: number = 7): PerformanceData[] {
  const data: PerformanceData[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Mock data - în production ar veni din database
    const triggers = Math.floor(Math.random() * 20) + 5;
    const successful = Math.floor(triggers * (0.6 + Math.random() * 0.3));
    
    data.push({
      date: date.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }),
      triggers,
      successful,
      successRate: Math.round((successful / triggers) * 100),
    });
  }
  
  return data;
}

/**
 * Get best performing filter
 */
export function getBestFilter(filters: Filter[]): Filter | null {
  if (filters.length === 0) return null;
  
  return filters.reduce((best, current) => {
    const bestScore = (best.trigger_count || 0) * (best.success_rate || 0);
    const currentScore = (current.trigger_count || 0) * (current.success_rate || 0);
    return currentScore > bestScore ? current : best;
  });
}

/**
 * Get most active filter
 */
export function getMostActiveFilter(filters: Filter[]): Filter | null {
  if (filters.length === 0) return null;
  
  return filters.reduce((mostActive, current) => {
    return (current.trigger_count || 0) > (mostActive.trigger_count || 0) 
      ? current 
      : mostActive;
  });
}

/**
 * Calculate success rate trend
 */
export function calculateSuccessRateTrend(
  current: number, 
  previous: number
): { value: number; trend: 'up' | 'down' | 'stable' } {
  const diff = current - previous;
  
  if (Math.abs(diff) < 1) {
    return { value: 0, trend: 'stable' };
  }
  
  return {
    value: Math.abs(diff),
    trend: diff > 0 ? 'up' : 'down',
  };
}

/**
 * Format success rate for display
 */
export function formatSuccessRate(rate: number): string {
  return `${Math.round(rate * 10) / 10}%`;
}

/**
 * Format trigger count
 */
export function formatTriggers(count: number): string {
  if (count === 0) return 'Niciun trigger';
  if (count === 1) return '1 trigger';
  return `${count} triggers`;
}


/**
 * Get performance rating
 */
export function getPerformanceRating(successRate: number): {
  rating: 'excellent' | 'good' | 'average' | 'poor';
  color: string;
  label: string;
} {
  if (successRate >= 75) {
    return { rating: 'excellent', color: 'text-accent-green', label: 'Excellent' };
  } else if (successRate >= 60) {
    return { rating: 'good', color: 'text-accent-cyan', label: 'Good' };
  } else if (successRate >= 45) {
    return { rating: 'average', color: 'text-accent-amber', label: 'Average' };
  } else {
    return { rating: 'poor', color: 'text-accent-red', label: 'Poor' };
  }
}

/**
 * Escape a CSV field — wraps in quotes if it contains commas, quotes or newlines
 */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Summarize filter conditions into a readable string
 */
function summarizeConditions(conditions: Record<string, any>): string {
  if (!conditions || typeof conditions !== 'object') return '';
  const parts: string[] = [];
  for (const [key, val] of Object.entries(conditions)) {
    if (!val || typeof val !== 'object') continue;
    const { min, max, team } = val as { min?: number; max?: number; team?: string };
    const label = key.replace(/_/g, ' ');
    const teamSuffix = team ? ` (${team})` : '';
    if (min !== undefined && max !== undefined) {
      parts.push(`${label}: ${min}-${max}${teamSuffix}`);
    } else if (min !== undefined) {
      parts.push(`${label}: ≥${min}${teamSuffix}`);
    } else if (max !== undefined) {
      parts.push(`${label}: ≤${max}${teamSuffix}`);
    }
  }
  return parts.join('; ');
}

/**
 * Export analytics data to CSV (simple, filters only — legacy)
 */
export function exportToCSV(filters: Filter[]): string {
  const headers = [
    'Name',
    'Triggers',
    'Success Rate',
    'Active',
    'Notifications',
    'Telegram',
    'Created At',
    'Last Trigger',
  ].join(',');
  
  const rows = filters.map(f => [
    csvEscape(f.name),
    f.trigger_count || 0,
    formatSuccessRate(f.success_rate || 0),
    f.is_active ? 'Yes' : 'No',
    f.notification_enabled ? 'Yes' : 'No',
    f.telegram_enabled ? 'Yes' : 'No',
    new Date(f.created_at).toLocaleDateString('en-US'),
    f.last_triggered ? new Date(f.last_triggered).toLocaleDateString('en-US') : 'Never',
  ].join(','));
  
  return [headers, ...rows].join('\n');
}

/**
 * Export full report with analytics + triggered matches history.
 * Multi-section CSV with UTF-8 BOM for Excel compatibility.
 */
export function exportFullReport(
  filters: Filter[], 
  triggeredMatches: TriggeredMatch[], 
  patternInsights?: any[]
): string {
  const BOM = '\uFEFF';
  const sections: string[] = [];

  // ── SECTION 1: FILTER ANALYTICS ──
  const filterHeaders = [
    'Filter Name', 'Description', 'Status', 'Triggers', 'Success Rate %',
    'Avg Triggers/Day', 'Notifications', 'Telegram', 'Public',
    'Conditions', 'Created', 'Last Triggered',
  ].map(csvEscape).join(',');

  const filterRows = filters.map(f => {
    const stats = calculateFilterStats(f);
    return [
      csvEscape(f.name),
      csvEscape(f.description || ''),
      f.is_active ? 'Active' : 'Inactive',
      f.trigger_count || 0,
      Math.round((f.success_rate || 0) * 10) / 10,
      stats.avgTriggersPerDay,
      f.notification_enabled ? 'Yes' : 'No',
      f.telegram_enabled ? 'Yes' : 'No',
      f.is_public ? 'Yes' : 'No',
      csvEscape(summarizeConditions(f.conditions)),
      new Date(f.created_at).toLocaleDateString('en-US'),
      f.last_triggered ? new Date(f.last_triggered).toLocaleString('en-US') : 'Never',
    ].join(',');
  });

  sections.push('=== FILTER ANALYTICS ===');
  sections.push(filterHeaders);
  sections.push(...filterRows);

  // ── SECTION 2: TRIGGERED MATCHES HISTORY ──
  sections.push('');
  sections.push('=== TRIGGERED MATCHES HISTORY ===');

  const matchHeaders = [
    'Date', 'Time', 'Filter Name', 'Home Team', 'Away Team',
    'League', 'Score at Trigger', 'HT Score', 'Match Minute', 'Match Status',
    'User Feedback', 'Final Score',
  ].map(csvEscape).join(',');

  // Sort triggered matches by date descending
  const sorted = [...triggeredMatches].sort(
    (a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
  );

  const matchRows = sorted.map(m => {
    const dt = new Date(m.triggered_at);
    const score = (m.score_home !== null && m.score_away !== null)
      ? `${m.score_home}-${m.score_away}` : '';
    const htScore = ((m as any).ht_score_home !== null && (m as any).ht_score_home !== undefined
      && (m as any).ht_score_away !== null && (m as any).ht_score_away !== undefined)
      ? `${(m as any).ht_score_home}-${(m as any).ht_score_away}` : '';
    // Use final_score if available, otherwise fall back to trigger-time score for finished matches
    const hasFinal = (m as any).final_score_home !== null && (m as any).final_score_home !== undefined
      && (m as any).final_score_away !== null && (m as any).final_score_away !== undefined;
    const isFinished = m.match_status === 'finished' || m.match_status === 'FT'
      || m.match_status === 'AET' || m.match_status === 'PEN';
    const finalScore = hasFinal
      ? `${(m as any).final_score_home}-${(m as any).final_score_away}`
      : (isFinished && score ? score : '');
    return [
      dt.toLocaleDateString('en-US'),
      dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      csvEscape(m.filter_name || ''),
      csvEscape(m.home_team),
      csvEscape(m.away_team),
      csvEscape(m.league_name || ''),
      score,
      htScore,
      m.match_time !== null ? `${m.match_time}'` : '',
      m.match_status || '',
      (m as any).user_feedback || '',
      finalScore,
    ].join(',');
  });

  sections.push(matchHeaders);
  sections.push(...matchRows);

  // ── SECTION 3: SUMMARY ──
  sections.push('');
  sections.push('=== SUMMARY ===');

  const overall = calculateAllFiltersStats(filters);
  const uniqueMatches = new Set(triggeredMatches.map(m => m.match_id)).size;
  const uniqueLeagues = new Set(triggeredMatches.map(m => m.league_name).filter(Boolean)).size;
  const feedbackCount = triggeredMatches.filter(m => (m as any).user_feedback).length;
  const positiveFeedback = triggeredMatches.filter(m => (m as any).user_feedback === 'positive').length;

  const summaryData: [string, string | number][] = [
    ['Total Filters', overall.total],
    ['Active Filters', overall.active],
    ['Filters with Notifications', overall.withNotifications],
    ['Filters with Telegram', overall.withTelegram],
    ['Total Triggers (all filters)', overall.totalTriggers],
    ['Average Success Rate', formatSuccessRate(overall.avgSuccessRate)],
    ['Total Triggered Matches Logged', triggeredMatches.length],
    ['Unique Matches', uniqueMatches],
    ['Unique Leagues', uniqueLeagues],
    ['Matches with Feedback', feedbackCount],
    ['Positive Feedback', positiveFeedback],
    ['Report Generated', new Date().toLocaleString('en-US')],
  ];

  summaryData.forEach(([label, val]) => {
    sections.push(`${csvEscape(label)},${csvEscape(val)}`);
  });

  // ── SECTION 4: PATTERN INSIGHTS ──
  if (patternInsights && patternInsights.length > 0) {
    sections.push('');
    sections.push('=== PATTERN INSIGHTS BY FILTER ===');

    patternInsights.forEach(insight => {
      sections.push('');
      sections.push(`Filter: ${csvEscape(insight.filterName || '')}`);
      sections.push(`Total Matches: ${insight.total || 0}`);
      sections.push(`Overall Success Rate: ${insight.overallSuccessRate != null ? insight.overallSuccessRate + '%' : 'N/A'}`);
      sections.push(`Average Goals Added After Trigger: ${insight.avgGoalsAdded ?? 'N/A'}`);
      
      if (insight.bestLeague) {
        sections.push(`Best League: ${csvEscape(insight.bestLeague.name)} (${insight.bestLeague.successRate}% success, ${insight.bestLeague.count} matches)`);
      }
      if (insight.worstLeague) {
        sections.push(`Worst League: ${csvEscape(insight.worstLeague.name)} (${insight.worstLeague.successRate}% success, ${insight.worstLeague.count} matches)`);
      }

      // League breakdown table
      if (insight.leagues && insight.leagues.length > 0) {
        sections.push('');
        sections.push('League Breakdown:');
        sections.push(['League', 'Matches', 'Rated', 'Success Rate'].map(csvEscape).join(','));
        insight.leagues.forEach((l: any) => {
          sections.push([
            csvEscape(l.name),
            l.count,
            l.rated,
            l.successRate != null ? l.successRate + '%' : 'N/A'
          ].join(','));
        });
      }

      // Minute breakdown table
      if (insight.minuteBreakdown && insight.minuteBreakdown.length > 0) {
        sections.push('');
        sections.push('Minute Breakdown:');
        sections.push(['Time Range', 'Matches', 'Rated', 'Success Rate'].map(csvEscape).join(','));
        insight.minuteBreakdown.forEach((mb: any) => {
          sections.push([
            mb.range,
            mb.count,
            mb.rated,
            mb.successRate != null ? mb.successRate + '%' : 'N/A'
          ].join(','));
        });
      }

      // Score state breakdown table
      if (insight.scoreBreakdown && insight.scoreBreakdown.length > 0) {
        sections.push('');
        sections.push('Score State at Trigger:');
        sections.push(['Score State', 'Matches', 'Avg Goals After'].map(csvEscape).join(','));
        insight.scoreBreakdown.forEach((sb: any) => {
          sections.push([
            sb.state,
            sb.count,
            sb.avgGoalsAfter ?? 'N/A'
          ].join(','));
        });
      }
    });
  }

  // sep=, tells Excel to use comma as delimiter (fixes single-column issue on non-US locales)
  return BOM + 'sep=,\n' + sections.join('\n');
}

// ============================================
// EXPORT
// ============================================

const analyticsLib = {
  calculateFilterStats,
  calculateAllFiltersStats,
  categorizeFilters,
  generatePerformanceTrend,
  getBestFilter,
  getMostActiveFilter,
  calculateSuccessRateTrend,
  formatSuccessRate,
  formatTriggers,
  getPerformanceRating,
  exportToCSV,
  exportFullReport,
};

export default analyticsLib;
