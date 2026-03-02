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
  Trophy,
  Clock,
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

  // Triggered Matches tab state
  type AnalyticsTab = 'overview' | 'triggered';
  type TriggeredViewMode = 'matches' | 'filters';
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [triggeredMatches, setTriggeredMatches] = useState<any[]>([]);
  const [triggeredLoading, setTriggeredLoading] = useState(false);
  const [triggeredRange, setTriggeredRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [triggeredViewMode, setTriggeredViewMode] = useState<TriggeredViewMode>('matches');
  const [triggeredExpanded, setTriggeredExpanded] = useState<string | null>(null);

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

  // Load triggered matches when Triggered tab is active or range changes
  useEffect(() => {
    if (activeTab !== 'triggered' || !userId) return;
    setTriggeredLoading(true);
    fetch(`/api/triggered-matches/list?user_id=${userId}&range=${triggeredRange}&limit=500`)
      .then(r => r.ok ? r.json() : { matches: [] })
      .then(data => setTriggeredMatches(data.matches || []))
      .catch(() => setTriggeredMatches([]))
      .finally(() => setTriggeredLoading(false));
  }, [activeTab, userId, triggeredRange]);

  // Group triggered matches by match
  const triggeredByMatch = (() => {
    const map = new Map<string, { matchId: string; homeTeam: string; awayTeam: string; league: string; scoreHome: number | null; scoreAway: number | null; latestAt: string; filters: string[] }>();
    for (const m of triggeredMatches) {
      if (!map.has(m.match_id)) {
        map.set(m.match_id, { matchId: m.match_id, homeTeam: m.home_team, awayTeam: m.away_team, league: m.league_name || '', scoreHome: m.score_home, scoreAway: m.score_away, latestAt: m.triggered_at, filters: [] });
      }
      const g = map.get(m.match_id)!;
      if (!g.filters.includes(m.filter_name)) g.filters.push(m.filter_name);
      if (new Date(m.triggered_at) > new Date(g.latestAt)) { g.latestAt = m.triggered_at; if (m.score_home != null) g.scoreHome = m.score_home; if (m.score_away != null) g.scoreAway = m.score_away; }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  })();

  // Group triggered matches by filter
  const triggeredByFilter = (() => {
    const map = new Map<string, { filterId: string; filterName: string; matches: any[]; latestAt: string }>();
    for (const m of triggeredMatches) {
      if (!map.has(m.filter_id)) map.set(m.filter_id, { filterId: m.filter_id, filterName: m.filter_name, matches: [], latestAt: m.triggered_at });
      const g = map.get(m.filter_id)!;
      if (!g.matches.find((x: any) => x.match_id === m.match_id)) g.matches.push(m);
      if (new Date(m.triggered_at) > new Date(g.latestAt)) g.latestAt = m.triggered_at;
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  })();

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
              <p className="text-xs text-text-muted mt-0.5">Filter performance & triggered history</p>
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

          {/* ===== TAB BAR ===== */}
          <div className="flex gap-1 bg-glass-light/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('triggered')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                activeTab === 'triggered'
                  ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Triggered Matches
              {triggeredMatches.length > 0 && (
                <span className="bg-accent-purple/20 text-accent-purple text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {triggeredByMatch.length}
                </span>
              )}
            </button>
          </div>

          {/* ===== TRIGGERED MATCHES TAB ===== */}
          {activeTab === 'triggered' && (
            <div className="space-y-3">
              {/* Range + View toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                {(['7d', '30d', 'all'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => { setTriggeredRange(r); setTriggeredExpanded(null); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      triggeredRange === r ? 'bg-accent-purple text-white' : 'bg-glass-light text-text-muted hover:text-white'
                    }`}
                  >
                    {r === 'all' ? 'All time' : r === '7d' ? 'Last 7 days' : 'Last 30 days'}
                  </button>
                ))}
                <div className="flex gap-1 ml-auto bg-glass-light/50 rounded-lg p-0.5">
                  <button
                    onClick={() => { setTriggeredViewMode('matches'); setTriggeredExpanded(null); }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                      triggeredViewMode === 'matches' ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30' : 'text-text-muted hover:text-white'
                    }`}
                  >
                    <Trophy className="w-3 h-3" /> By Match
                  </button>
                  <button
                    onClick={() => { setTriggeredViewMode('filters'); setTriggeredExpanded(null); }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                      triggeredViewMode === 'filters' ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30' : 'text-text-muted hover:text-white'
                    }`}
                  >
                    <FilterIcon className="w-3 h-3" /> By Filter
                  </button>
                </div>
              </div>

              {/* Count row */}
              {!triggeredLoading && (
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span>
                    {triggeredViewMode === 'matches'
                      ? `${triggeredByMatch.length} match${triggeredByMatch.length !== 1 ? 'es' : ''} · ${triggeredMatches.length} total triggers`
                      : `${triggeredByFilter.length} filter${triggeredByFilter.length !== 1 ? 's' : ''} · ${triggeredByMatch.length} matches`}
                  </span>
                  <span className="ml-auto text-accent-purple text-[10px]">persists 7d+ · export above ↑</span>
                </div>
              )}

              {/* Loading */}
              {triggeredLoading && (
                <div className="p-8 text-center border border-white/10 rounded-xl bg-[rgba(15,23,42,0.85)]">
                  <Zap className="w-6 h-6 text-accent-purple mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-text-muted">Loading triggered matches...</p>
                </div>
              )}

              {/* BY MATCH */}
              {!triggeredLoading && triggeredViewMode === 'matches' && (
                triggeredByMatch.length === 0 ? (
                  <div className="p-8 text-center border border-white/10 rounded-xl bg-[rgba(15,23,42,0.85)]">
                    <Trophy className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-text-secondary">No triggered matches in this period</p>
                    <p className="text-[11px] text-text-muted mt-1">Try selecting a wider range above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {triggeredByMatch.map(g => (
                      <div key={g.matchId} className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
                        <button
                          onClick={() => setTriggeredExpanded(triggeredExpanded === g.matchId ? null : g.matchId)}
                          className="w-full text-left p-3 hover:bg-white/5 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-base font-bold text-accent-cyan">{g.scoreHome ?? 0}</span>
                              <span className="text-xs text-text-muted">-</span>
                              <span className="text-base font-bold text-accent-blue">{g.scoreAway ?? 0}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{g.homeTeam} vs {g.awayTeam}</div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                <span className="text-text-muted truncate">{g.league}</span>
                                <span className="text-accent-blue">{(() => { const d = Date.now() - new Date(g.latestAt).getTime(); const m = Math.floor(d/60000); if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`; const h = Math.floor(d/3600000); if (h < 24) return `${h}h ago`; return `${Math.floor(d/86400000)}d ago`; })()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="bg-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full">{g.filters.length}</span>
                              <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${triggeredExpanded === g.matchId ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </button>
                        {triggeredExpanded === g.matchId && (
                          <div className="border-t border-white/8 px-3 py-2 space-y-1">
                            {g.filters.map((fname: string, i: number) => {
                              const raw = triggeredMatches.find((m: any) => m.match_id === g.matchId && m.filter_name === fname);
                              return (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/3">
                                  <div className="flex items-center gap-2">
                                    <FilterIcon className="w-3 h-3 text-accent-purple shrink-0" />
                                    <span className="text-xs text-white">{fname}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                    {raw?.match_time != null && <span className="text-accent-cyan font-semibold">{raw.match_time}&apos;</span>}
                                    <span>{raw?.score_home ?? 0}-{raw?.score_away ?? 0}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* BY FILTER */}
              {!triggeredLoading && triggeredViewMode === 'filters' && (
                triggeredByFilter.length === 0 ? (
                  <div className="p-8 text-center border border-white/10 rounded-xl bg-[rgba(15,23,42,0.85)]">
                    <FilterIcon className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-text-secondary">No filter triggers in this period</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {triggeredByFilter.map(g => (
                      <div key={g.filterId} className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
                        <button
                          onClick={() => setTriggeredExpanded(triggeredExpanded === g.filterId ? null : g.filterId)}
                          className="w-full text-left p-3 hover:bg-white/5 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center shrink-0">
                              <FilterIcon className="w-4 h-4 text-accent-purple" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{g.filterName}</div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                <span className="text-accent-purple font-medium">{g.matches.length} match{g.matches.length !== 1 ? 'es' : ''}</span>
                                <span className="text-text-muted">·</span>
                                <span className="text-accent-blue">{(() => { const d = Date.now() - new Date(g.latestAt).getTime(); const h = Math.floor(d/3600000); if (h < 1) return 'Just now'; if (h < 24) return `${h}h ago`; return `${Math.floor(d/86400000)}d ago`; })()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="bg-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full">{g.matches.length}</span>
                              <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${triggeredExpanded === g.filterId ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </button>
                        {triggeredExpanded === g.filterId && (
                          <div className="border-t border-white/8 px-3 py-2 space-y-1">
                            {g.matches.map((m: any, i: number) => (
                              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-xs font-bold text-accent-cyan">{m.score_home ?? 0}</span>
                                    <span className="text-[10px] text-text-muted">-</span>
                                    <span className="text-xs font-bold text-accent-blue">{m.score_away ?? 0}</span>
                                  </div>
                                  <span className="text-xs text-white truncate">{m.home_team} vs {m.away_team}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-text-muted shrink-0">
                                  {m.match_time != null && <span className="text-accent-cyan font-semibold">{m.match_time}&apos;</span>}
                                  <span>{new Date(m.triggered_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === 'overview' && (
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
          )} {/* end overview tab */}

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
