'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Award,
  Target,
  Zap,
  Download,
  Filter as FilterIcon,
  Bell,
  Send,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ChevronDown,
  X,
  Calendar,
  Layers,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { FilterFeedbackCard } from '@/components/FilterFeedbackCard';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';
import {
  calculateAllFiltersStats,
  categorizeFilters,
  getPerformanceRating,
  formatSuccessRate,
  exportFullReport,
  type FilterStats,
} from '@/lib/analytics';

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [overallStats, setOverallStats] = useState<any>(null);
  const [categoryStats, setCategoryStats] = useState<any>(null);
  const [topFilters, setTopFilters] = useState<FilterStats[]>([]);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportRange, setExportRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [exportLeague, setExportLeague] = useState<string>('all');
  const [exportFilterId, setExportFilterId] = useState<string>('all');
  const [exporting, setExporting] = useState(false);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);

  // Load filters and finalize old triggered matches
  const loadFilters = useCallback(async () => {
    try {
      const user = authHelpers.getCurrentUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // Finalize old ongoing matches in background (marks >2h old as finished)
      fetch('/api/triggered-matches/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      }).catch(() => {}); // Fire and forget

      // Clean up duplicate triggered_matches entries (from pre-fix multi-tab bug)
      fetch('/api/triggered-matches/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      }).then(r => r.json()).then(result => {
        if (result.deleted > 0) {
          console.log(`🧹 Cleaned up ${result.deleted} duplicate triggered matches`);
        }
      }).catch(() => {}); // Fire and forget

      const userFilters = await dbHelpers.getUserFilters(user.id);
      setFilters(userFilters);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  // Recalculate stats when filters change
  useEffect(() => {
    if (filters.length === 0) return;
    const overall = calculateAllFiltersStats(filters);
    setOverallStats(overall);
    setCategoryStats(categorizeFilters(filters));
    setTopFilters(overall.topPerformers);
  }, [filters]);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Build API params based on selected range
      const rangeParam = exportRange === 'today' ? '24h' : exportRange;
      let url = `/api/triggered-matches/list?user_id=${userId}&range=${rangeParam}&limit=5000`;
      if (exportFilterId !== 'all') {
        url += `&filter_id=${exportFilterId}`;
      }

      const res = await fetch(url);
      const data = res.ok ? await res.json() : { matches: [] };
      let triggeredMatches = data.matches || [];

      // Client-side league filter
      if (exportLeague !== 'all') {
        triggeredMatches = triggeredMatches.filter(
          (m: any) => m.league_name === exportLeague
        );
      }

      // Filter the filters list too if a specific filter was chosen
      const filtersForExport = exportFilterId !== 'all'
        ? filters.filter(f => f.id === exportFilterId)
        : filters;

      const csv = exportFullReport(filtersForExport, triggeredMatches);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;

      // Build descriptive filename
      const rangeName = { today: 'today', '7d': 'last-7d', '30d': 'last-30d', all: 'full' }[exportRange];
      const leagueName = exportLeague !== 'all' ? `-${exportLeague.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const filterName = exportFilterId !== 'all' ? `-${(filters.find(f => f.id === exportFilterId)?.name || 'filter').replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      a.download = `livepick-${rangeName}${leagueName}${filterName}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      setShowExportPanel(false);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // Fetch unique leagues from triggered matches when export panel opens
  useEffect(() => {
    if (!showExportPanel || !userId) return;
    fetch(`/api/triggered-matches/list?user_id=${userId}&range=all&limit=5000`)
      .then(r => r.json())
      .then(data => {
        const matches = data.matches || [];
        const leagues = Array.from(
          new Set(matches.map((m: any) => m.league_name).filter(Boolean))
        ).sort() as string[];
        setAvailableLeagues(leagues);
      })
      .catch(() => {});
  }, [showExportPanel, userId]);

  // When feedback updates a filter's success_rate, reload filters to get fresh data
  const handleSuccessRateUpdated = useCallback(async () => {
    const user = authHelpers.getCurrentUser();
    if (!user) return;
    const userFilters = await dbHelpers.getUserFilters(user.id);
    setFilters(userFilters);
  }, []);

  // Loading state
  if (loading) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-3 border-accent-cyan border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Loading analytics...</p>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  // Empty state
  if (filters.length === 0) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <BarChart3 className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-display font-bold mb-2">No Analytics Yet</h2>
            <p className="text-text-muted text-sm mb-4">
              Create filters to start tracking performance
            </p>
            <button
              onClick={() => router.push('/dashboard/filters/new')}
              className="btn-primary text-sm"
            >
              Create First Filter
            </button>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  // Compute some derived values
  const totalFeedback = filters.reduce((sum, f) => {
    const rate = f.success_rate ?? 0;
    const triggers = f.trigger_count ?? 0;
    return sum + (rate > 0 && triggers > 0 ? 1 : 0);
  }, 0);

  return (
    <AuthWrapper>
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* ===== HEADER ===== */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold gradient-text">Analytics</h1>
              <p className="text-xs text-text-muted mt-0.5">Filter performance & feedback</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadFilters}
                className="p-2 rounded-lg bg-glass-light hover:bg-glass-medium text-text-muted hover:text-white transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportPanel(!showExportPanel)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-glass-light hover:bg-glass-medium text-text-muted hover:text-white transition-colors text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                  <ChevronDown className={`w-3 h-3 transition-transform ${showExportPanel ? 'rotate-180' : ''}`} />
                </button>

                {/* Export filter panel */}
                {showExportPanel && (
                  <div className="absolute right-0 top-full mt-2 w-72 glass-card p-4 rounded-xl shadow-2xl border border-glass-lighter z-50 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">Export Options</span>
                      <button onClick={() => setShowExportPanel(false)} className="text-text-muted hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Date Range */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-text-muted mb-1.5">
                        <Calendar className="w-3 h-3" />
                        Date Range
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { value: 'today' as const, label: 'Today' },
                          { value: '7d' as const, label: 'Last 7 days' },
                          { value: '30d' as const, label: 'Last 30 days' },
                          { value: 'all' as const, label: 'All time' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setExportRange(opt.value)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              exportRange === opt.value
                                ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                                : 'bg-glass-light text-text-muted hover:text-white hover:bg-glass-medium'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter selection */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-text-muted mb-1.5">
                        <FilterIcon className="w-3 h-3" />
                        Filter
                      </label>
                      <select
                        value={exportFilterId}
                        onChange={e => setExportFilterId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-glass-light border border-glass-lighter text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-accent-cyan/50"
                      >
                        <option value="all">All filters</option>
                        {filters.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* League selection */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-text-muted mb-1.5">
                        <Layers className="w-3 h-3" />
                        League
                      </label>
                      <select
                        value={exportLeague}
                        onChange={e => setExportLeague(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-glass-light border border-glass-lighter text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-accent-cyan/50"
                      >
                        <option value="all">All leagues</option>
                        {availableLeagues.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>

                    {/* Export button */}
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {exporting ? (
                        <div className="w-4 h-4 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {exporting ? 'Exporting...' : 'Download CSV'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== COMPACT STATS ROW ===== */}
          {overallStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<FilterIcon className="w-4 h-4 text-accent-cyan" />}
                value={overallStats.total}
                label="Filters"
                sub={`${overallStats.active} active`}
                subColor="text-accent-cyan"
              />
              <StatCard
                icon={<Zap className="w-4 h-4 text-accent-amber" />}
                value={overallStats.totalTriggers}
                label="Total Triggers"
              />
              <StatCard
                icon={<Target className="w-4 h-4 text-accent-green" />}
                value={formatSuccessRate(overallStats.avgSuccessRate)}
                label="Avg Success"
                sub={totalFeedback > 0 ? `${totalFeedback} rated` : 'No ratings yet'}
                subColor={totalFeedback > 0 ? 'text-accent-green' : 'text-text-muted'}
              />
              <StatCard
                icon={<Bell className="w-4 h-4 text-accent-purple" />}
                value={overallStats.withNotifications + overallStats.withTelegram}
                label="Notifications"
                sub={`${overallStats.withNotifications} push, ${overallStats.withTelegram} TG`}
                subColor="text-text-muted"
              />
            </div>
          )}

          {/* ===== MAIN CONTENT: 2-column on desktop ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* LEFT: Top Filters (3 cols) */}
            <div className="lg:col-span-3 glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-glass-lighter flex items-center gap-2">
                <Award className="w-4 h-4 text-accent-amber" />
                <h2 className="text-sm font-bold">Top Filters by Triggers</h2>
              </div>
              <div className="divide-y divide-glass-lighter/50">
                {topFilters.length > 0 ? (
                  topFilters.map((filterStat, index) => {
                    const rating = getPerformanceRating(filterStat.successRate);
                    return (
                      <button
                        type="button"
                        key={filterStat.filterId}
                        onClick={() => router.push(`/dashboard/filters/${filterStat.filterId}`)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-glass-light/50 transition-colors text-left"
                      >
                        <span className="text-lg font-bold text-accent-amber/70 w-6 text-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {filterStat.filterName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-text-muted">
                              {filterStat.totalTriggers} triggers
                            </span>
                            {filterStat.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green">
                                Active
                              </span>
                            )}
                            {filterStat.notificationsEnabled && (
                              <Bell className="w-3 h-3 text-accent-cyan" />
                            )}
                            {filterStat.telegramEnabled && (
                              <Send className="w-3 h-3 text-accent-purple" />
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${rating.color}`}>
                            {formatSuccessRate(filterStat.successRate)}
                          </p>
                          <p className="text-[10px] text-text-muted">{rating.label}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      </button>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-text-muted text-sm">
                    No filters with triggers yet
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Category breakdown (2 cols) */}
            {categoryStats && (
              <div className="lg:col-span-2 glass-card overflow-hidden">
                <div className="px-4 py-3 border-b border-glass-lighter">
                  <h2 className="text-sm font-bold">Filter Categories</h2>
                </div>
                <div className="p-4 space-y-4">
                  <CategoryBar label="Corners" count={categoryStats.corners} total={filters.length} color="bg-accent-cyan" />
                  <CategoryBar label="Shots" count={categoryStats.shots} total={filters.length} color="bg-accent-green" />
                  <CategoryBar label="Cards" count={categoryStats.cards} total={filters.length} color="bg-accent-amber" />
                  <CategoryBar label="Mixed" count={categoryStats.mixed} total={filters.length} color="bg-accent-purple" />

                  {/* Quick summary */}
                  <div className="pt-3 border-t border-glass-lighter">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold text-white">{filters.filter(f => f.is_active).length}</p>
                        <p className="text-[10px] text-text-muted">Active</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{filters.filter(f => !f.is_active).length}</p>
                        <p className="text-[10px] text-text-muted">Paused</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===== FEEDBACK SECTION ===== */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="w-4 h-4 text-accent-green" />
              <h2 className="text-sm font-bold text-white">Rate Filter Triggers</h2>
              <span className="text-[10px] text-text-muted ml-1">
                Your ratings update the success rate in real-time
              </span>
            </div>
            <FilterFeedbackCard
              filters={filters}
              userId={userId}
              onSuccessRateUpdated={handleSuccessRateUpdated}
            />
          </div>

        </div>
      </div>
    </AuthWrapper>
  );
}

// ===== Sub-components =====

function StatCard({
  icon,
  value,
  label,
  sub,
  subColor,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="glass-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-glass-light">{icon}</div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      {sub && (
        <p className={`text-[10px] mt-1 ${subColor || 'text-text-muted'}`}>{sub}</p>
      )}
    </div>
  );
}

function CategoryBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const pctInt = Math.max(0, Math.min(100, Math.round(Math.max(pct, 2))));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs font-bold text-white">{count}</span>
      </div>
      <div className="h-1.5 bg-glass-light rounded-full overflow-hidden">
        <div
          className={`h-full shrink-0 rounded-full ${color} transition-all w-[${pctInt}%]`}
        />
      </div>
    </div>
  );
}
