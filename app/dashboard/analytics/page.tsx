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
  Sparkles,
  Globe,
  Activity,
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
  const [insightsOpen, setInsightsOpen] = useState<Set<string>>(new Set());
  const [insightsData, setInsightsData] = useState<Map<string, any>>(new Map());
  const [insightsLoading, setInsightsLoading] = useState<Set<string>>(new Set());
  const [savingInlineFeedback, setSavingInlineFeedback] = useState<Set<string>>(new Set());
  const [fetchedFinalScores, setFetchedFinalScores] = useState<Map<string, { home: number; away: number }>>(new Map());

  const loadInsights = useCallback(async (filterId: string) => {
    if (insightsData.has(filterId) || insightsLoading.has(filterId)) return;
    setInsightsLoading(prev => new Set(prev).add(filterId));
    try {
      const res = await fetch(`/api/analytics/pattern-insights?filter_id=${filterId}&user_id=${userId}`);
      const data = res.ok ? await res.json() : null;
      if (data) setInsightsData(prev => new Map(prev).set(filterId, data));
    } catch { /* ignore */ } finally {
      setInsightsLoading(prev => { const s = new Set(prev); s.delete(filterId); return s; });
    }
  }, [insightsData, insightsLoading, userId]);

  const toggleInsights = (filterId: string) => {
    setInsightsOpen(prev => {
      const s = new Set(prev);
      if (s.has(filterId)) { s.delete(filterId); }
      else { s.add(filterId); loadInsights(filterId); }
      return s;
    });
  };

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

  // Fetch missing final scores for old matches (>2h) where final_score_* is null
  useEffect(() => {
    if (triggeredMatches.length === 0) return;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const matchesNeedingScores = new Set<string>();
    
    for (const m of triggeredMatches) {
      if (
        m.final_score_home == null &&
        new Date(m.triggered_at).getTime() < twoHoursAgo &&
        !fetchedFinalScores.has(m.match_id)
      ) {
        matchesNeedingScores.add(m.match_id);
      }
    }

    if (matchesNeedingScores.size === 0) return;

    // Fetch final scores for all matches needing them
    Promise.all(
      Array.from(matchesNeedingScores).map(async (matchId) => {
        try {
          const res = await fetch(`/api/match-result?match_id=${matchId}`);
          if (!res.ok) return null;
          const data = await res.json();
          if (data.scoreHome != null && data.scoreAway != null) {
            return { matchId, home: data.scoreHome, away: data.scoreAway };
          }
        } catch {}
        return null;
      })
    ).then((results) => {
      const newScores = new Map(fetchedFinalScores);
      for (const r of results) {
        if (r) newScores.set(r.matchId, { home: r.home, away: r.away });
      }
      setFetchedFinalScores(newScores);
    });
  }, [triggeredMatches, fetchedFinalScores]);

  // Group triggered matches by match
  const latestTriggeredByMatchAndFilter = (() => {
    const map = new Map<string, any>();
    for (const m of triggeredMatches) {
      const key = `${m.match_id}||${m.filter_name}`;
      const existing = map.get(key);
      if (!existing || new Date(m.triggered_at) > new Date(existing.triggered_at)) {
        map.set(key, m);
      }
    }
    // Apply fetched final scores from match-result API
    for (const [key, m] of map.entries()) {
      if (m.final_score_home == null && fetchedFinalScores.has(m.match_id)) {
        const fetched = fetchedFinalScores.get(m.match_id)!;
        m.final_score_home = fetched.home;
        m.final_score_away = fetched.away;
      }
    }
    return map;
  })();

  const triggeredByMatch = (() => {
    const map = new Map<string, { matchId: string; homeTeam: string; awayTeam: string; league: string; scoreHome: number | null; scoreAway: number | null; htScoreHome: number | null; htScoreAway: number | null; finalScoreHome: number | null; finalScoreAway: number | null; latestAt: string; latestMinute: number | null; filters: string[] }>();
    for (const m of triggeredMatches) {
      if (!map.has(m.match_id)) {
        map.set(m.match_id, { matchId: m.match_id, homeTeam: m.home_team, awayTeam: m.away_team, league: m.league_name || '', scoreHome: m.score_home, scoreAway: m.score_away, htScoreHome: (m as any).ht_score_home ?? null, htScoreAway: (m as any).ht_score_away ?? null, finalScoreHome: m.final_score_home ?? null, finalScoreAway: m.final_score_away ?? null, latestAt: m.triggered_at, latestMinute: m.match_time ?? null, filters: [] });
      }
      const g = map.get(m.match_id)!;
      if (!g.filters.includes(m.filter_name)) g.filters.push(m.filter_name);
      if (new Date(m.triggered_at) > new Date(g.latestAt)) {
        g.latestAt = m.triggered_at;
        g.latestMinute = m.match_time ?? null;
        if (m.score_home != null) g.scoreHome = m.score_home;
        if (m.score_away != null) g.scoreAway = m.score_away;
        if ((m as any).ht_score_home != null) g.htScoreHome = (m as any).ht_score_home;
        if ((m as any).ht_score_away != null) g.htScoreAway = (m as any).ht_score_away;
      }
      // Always prefer final score when available
      if (m.final_score_home != null) g.finalScoreHome = m.final_score_home;
      if (m.final_score_away != null) g.finalScoreAway = m.final_score_away;
    }
    // Apply fetched final scores from match-result API
    for (const g of map.values()) {
      if (g.finalScoreHome == null && fetchedFinalScores.has(g.matchId)) {
        const fetched = fetchedFinalScores.get(g.matchId)!;
        g.finalScoreHome = fetched.home;
        g.finalScoreAway = fetched.away;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  })();

  // When feedback updates a filter's success_rate, reload filters to get fresh data
  const handleSuccessRateUpdated = useCallback(async () => {
    const user = authHelpers.getCurrentUser();
    if (!user) return;
    const userFilters = await dbHelpers.getUserFilters(user.id);
    setFilters(userFilters);
  }, []);

  const handleInlineFeedback = useCallback(async (filterId: string, triggeredMatchId: string, isPositive: boolean) => {
    if (!userId) return;

    let prevFeedback: boolean | null | undefined = undefined;
    let prevFeedbackAt: string | null | undefined = undefined;

    // Optimistic UI update
    setTriggeredMatches(prev => prev.map((m: any) => {
      if (m.id !== triggeredMatchId) return m;
      prevFeedback = m.user_feedback;
      prevFeedbackAt = m.feedback_at;
      return { ...m, user_feedback: isPositive, feedback_at: new Date().toISOString() };
    }));

    setSavingInlineFeedback(prev => {
      const next = new Set(prev);
      next.add(triggeredMatchId);
      return next;
    });

    try {
      const res = await fetch('/api/triggered-matches/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggered_match_id: triggeredMatchId,
          user_id: userId,
          feedback: isPositive,
        }),
      });

      if (res.ok) {
        await handleSuccessRateUpdated();
      } else {
        // Revert
        setTriggeredMatches(prev => prev.map((m: any) =>
          m.id === triggeredMatchId
            ? { ...m, user_feedback: prevFeedback ?? null, feedback_at: prevFeedbackAt ?? null }
            : m
        ));
      }
    } catch {
      // Revert
      setTriggeredMatches(prev => prev.map((m: any) =>
        m.id === triggeredMatchId
          ? { ...m, user_feedback: prevFeedback ?? null, feedback_at: prevFeedbackAt ?? null }
          : m
      ));
    } finally {
      setSavingInlineFeedback(prev => {
        const next = new Set(prev);
        next.delete(triggeredMatchId);
        return next;
      });
    }
  }, [userId, handleSuccessRateUpdated]);

  // Group triggered matches by filter
  const triggeredByFilter = (() => {
    const map = new Map<string, { filterId: string; filterName: string; matches: any[]; latestAt: string }>();
    for (const m of triggeredMatches) {
      if (!map.has(m.filter_id)) map.set(m.filter_id, { filterId: m.filter_id, filterName: m.filter_name, matches: [], latestAt: m.triggered_at });
      const g = map.get(m.filter_id)!;
      const existingIdx = g.matches.findIndex((x: any) => x.match_id === m.match_id);
      if (existingIdx === -1) {
        g.matches.push(m);
      } else {
        const existing = g.matches[existingIdx];
        if (new Date(m.triggered_at) > new Date(existing.triggered_at)) {
          g.matches[existingIdx] = m;
        }
      }
      if (new Date(m.triggered_at) > new Date(g.latestAt)) g.latestAt = m.triggered_at;
    }
    // Apply fetched final scores from match-result API to each match object
    for (const g of map.values()) {
      for (const m of g.matches) {
        if (m.final_score_home == null && fetchedFinalScores.has(m.match_id)) {
          const fetched = fetchedFinalScores.get(m.match_id)!;
          m.final_score_home = fetched.home;
          m.final_score_away = fetched.away;
        }
      }
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

      // ✨ Apply fetched final scores from state to export data
      triggeredMatches = triggeredMatches.map((m: any) => {
        if (m.final_score_home == null && fetchedFinalScores.has(m.match_id)) {
          const fetched = fetchedFinalScores.get(m.match_id)!;
          return { ...m, final_score_home: fetched.home, final_score_away: fetched.away };
        }
        return m;
      });

      // Fetch pattern insights for included filters
      const filtersForExport = exportFilterId !== 'all'
        ? filters.filter(f => f.id === exportFilterId)
        : filters;

      const patternInsights: any[] = [];
      for (const filter of filtersForExport) {
        try {
          const insightsRes = await fetch(`/api/analytics/pattern-insights?filter_id=${filter.id}&user_id=${userId}`);
          if (insightsRes.ok) {
            const insights = await insightsRes.json();
            patternInsights.push({ filterId: filter.id, filterName: filter.name, ...insights });
          }
        } catch (err) {
          console.warn(`Failed to fetch insights for filter ${filter.id}:`, err);
        }
      }

      const csv = exportFullReport(filtersForExport, triggeredMatches, patternInsights);
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
                      <button onClick={() => setShowExportPanel(false)} title="Close export panel" className="text-text-muted hover:text-white">
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
                        aria-label="Select filter"
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
                        aria-label="Select league"
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
                            <div className="flex flex-col items-center shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-base font-bold text-accent-cyan">{g.finalScoreHome ?? g.scoreHome ?? 0}</span>
                                <span className="text-xs text-text-muted">-</span>
                                <span className="text-base font-bold text-accent-blue">{g.finalScoreAway ?? g.scoreAway ?? 0}</span>
                              </div>
                              {g.finalScoreHome != null
                                ? <span className="text-[9px] text-accent-green font-bold">FT</span>
                                : <span className="text-[9px] text-accent-amber font-bold">{g.scoreHome ?? 0}-{g.scoreAway ?? 0} ⏱</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{g.homeTeam} vs {g.awayTeam}</div>
                              <div className="mt-0.5 text-[11px] text-text-muted truncate">
                                <span className="text-text-muted">At trigger:</span>{' '}
                                <span className="text-white font-semibold">{g.scoreHome ?? 0}-{g.scoreAway ?? 0}</span>{' '}
                                <span className="text-accent-cyan font-semibold">({g.latestMinute != null ? `${g.latestMinute}'` : '—'})</span>
                                {g.htScoreHome != null && (
                                  <>
                                    <span className="text-text-muted"> · </span>
                                    <span className="text-text-muted">HT:</span>{' '}
                                    <span className="text-accent-blue font-semibold">{g.htScoreHome}-{g.htScoreAway}</span>
                                  </>
                                )}
                                {g.finalScoreHome != null && (
                                  <>
                                    <span className="text-text-muted"> · </span>
                                    <span className="text-text-muted">FT:</span>{' '}
                                    <span className="text-accent-green font-bold">{g.finalScoreHome}-{g.finalScoreAway}</span>
                                  </>
                                )}
                              </div>

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
                              const raw = latestTriggeredByMatchAndFilter.get(`${g.matchId}||${fname}`);
                              const isSaving = raw?.id ? savingInlineFeedback.has(raw.id) : false;
                              return (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/3">
                                  <div className="flex items-center gap-2">
                                    <FilterIcon className="w-3 h-3 text-accent-purple shrink-0" />
                                    <span className="text-xs text-white">{fname}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                    <span className="text-text-muted">At trigger:</span>
                                    <span className="text-white font-semibold">{raw?.score_home ?? 0}-{raw?.score_away ?? 0}</span>
                                    <span className="text-accent-cyan font-semibold">({raw?.match_time != null ? `${raw.match_time}'` : '—'})</span>
                                    {raw?.ht_score_home != null && (
                                      <>
                                        <span className="text-text-muted">·</span>
                                        <span className="text-text-muted">HT:</span>
                                        <span className="text-accent-blue font-semibold">{raw.ht_score_home}-{raw.ht_score_away ?? 0}</span>
                                      </>
                                    )}
                                    {raw?.final_score_home != null && (
                                      <>
                                        <span className="text-text-muted">·</span>
                                        <span className="text-text-muted">FT:</span>
                                        <span className="text-accent-green font-bold">{raw.final_score_home}-{raw.final_score_away}</span>
                                      </>
                                    )}

                                    {raw?.id && (
                                      <div className="flex gap-1 pl-1">
                                        <button
                                          type="button"
                                          disabled={isSaving}
                                          onClick={(e) => { e.stopPropagation(); handleInlineFeedback(raw.filter_id, raw.id, true); }}
                                          className={`p-1.5 rounded-lg transition-all ${
                                            isSaving ? 'opacity-50 cursor-wait' :
                                            raw.user_feedback === true
                                              ? 'bg-accent-green/25 text-accent-green ring-1 ring-accent-green/40'
                                              : 'bg-glass-light text-text-muted hover:bg-glass-medium hover:text-accent-green'
                                          }`}
                                          title="Good trigger"
                                          aria-label="Rate good trigger"
                                        >
                                          <ThumbsUp size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isSaving}
                                          onClick={(e) => { e.stopPropagation(); handleInlineFeedback(raw.filter_id, raw.id, false); }}
                                          className={`p-1.5 rounded-lg transition-all ${
                                            isSaving ? 'opacity-50 cursor-wait' :
                                            raw.user_feedback === false
                                              ? 'bg-accent-red/25 text-accent-red ring-1 ring-accent-red/40'
                                              : 'bg-glass-light text-text-muted hover:bg-glass-medium hover:text-accent-red'
                                          }`}
                                          title="Bad trigger"
                                          aria-label="Rate bad trigger"
                                        >
                                          <ThumbsDown size={12} />
                                        </button>
                                      </div>
                                    )}
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
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold text-accent-cyan">{m.final_score_home ?? m.score_home ?? 0}</span>
                                      <span className="text-[10px] text-text-muted">-</span>
                                      <span className="text-xs font-bold text-accent-blue">{m.final_score_away ?? m.score_away ?? 0}</span>
                                    </div>
                                    {m.final_score_home != null
                                      ? <span className="text-[8px] text-accent-green font-bold leading-none">FT</span>
                                      : m.match_time != null && <span className="text-[8px] text-accent-amber leading-none">{m.match_time}&apos;</span>
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs text-white truncate">{m.home_team} vs {m.away_team}</div>
                                    <div className="text-[11px] text-text-muted truncate">
                                      <span className="text-text-muted">At trigger:</span>{' '}
                                      <span className="text-white font-semibold">{m.score_home ?? 0}-{m.score_away ?? 0}</span>{' '}
                                      <span className="text-accent-cyan font-semibold">({m.match_time != null ? `${m.match_time}'` : '—'})</span>
                                      {(m as any).ht_score_home != null && (
                                        <>
                                          <span className="text-text-muted"> · </span>
                                          <span className="text-text-muted">HT:</span>{' '}
                                          <span className="text-accent-blue font-semibold">{(m as any).ht_score_home}-{(m as any).ht_score_away ?? 0}</span>
                                        </>
                                      )}
                                      {m.final_score_home != null && (
                                        <>
                                          <span className="text-text-muted"> · </span>
                                          <span className="text-text-muted">FT:</span>{' '}
                                          <span className="text-accent-green font-bold">{m.final_score_home}-{m.final_score_away}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-text-muted">
                                    {new Date(m.triggered_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                  </span>

                                  {m.id && (() => {
                                    const isSaving = savingInlineFeedback.has(m.id);
                                    return (
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          disabled={isSaving}
                                          onClick={(e) => { e.stopPropagation(); handleInlineFeedback(m.filter_id, m.id, true); }}
                                          className={`p-1.5 rounded-lg transition-all ${
                                            isSaving ? 'opacity-50 cursor-wait' :
                                            m.user_feedback === true
                                              ? 'bg-accent-green/25 text-accent-green ring-1 ring-accent-green/40'
                                              : 'bg-glass-light text-text-muted hover:bg-glass-medium hover:text-accent-green'
                                          }`}
                                          title="Good trigger"
                                          aria-label="Rate good trigger"
                                        >
                                          <ThumbsUp size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isSaving}
                                          onClick={(e) => { e.stopPropagation(); handleInlineFeedback(m.filter_id, m.id, false); }}
                                          className={`p-1.5 rounded-lg transition-all ${
                                            isSaving ? 'opacity-50 cursor-wait' :
                                            m.user_feedback === false
                                              ? 'bg-accent-red/25 text-accent-red ring-1 ring-accent-red/40'
                                              : 'bg-glass-light text-text-muted hover:bg-glass-medium hover:text-accent-red'
                                          }`}
                                          title="Bad trigger"
                                          aria-label="Rate bad trigger"
                                        >
                                          <ThumbsDown size={12} />
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            ))}

                            {/* ── PATTERN INSIGHTS TOGGLE ── */}
                            <div className="pt-1.5">
                              <button
                                onClick={() => toggleInsights(g.filterId)}
                                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                                  insightsOpen.has(g.filterId)
                                    ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
                                    : 'bg-white/5 text-text-muted hover:text-accent-amber hover:bg-accent-amber/10'
                                }`}
                              >
                                <Sparkles className="w-3 h-3" />
                                {insightsOpen.has(g.filterId) ? 'Hide Pattern Insights' : 'Show Pattern Insights'}
                              </button>

                              {/* ── INSIGHTS PANEL ── */}
                              {insightsOpen.has(g.filterId) && (() => {
                                const ins = insightsData.get(g.filterId);
                                const loading = insightsLoading.has(g.filterId);
                                if (loading) return (
                                  <div className="mt-2 p-4 text-center text-[11px] text-text-muted">
                                    <Sparkles className="w-4 h-4 mx-auto mb-1 animate-pulse text-accent-amber" />
                                    Analysing patterns...
                                  </div>
                                );
                                if (!ins || ins.total < 2) return (
                                  <div className="mt-2 p-3 text-center text-[11px] text-text-muted">
                                    Not enough data yet — needs at least 2 triggers.
                                  </div>
                                );
                                const maxCount = Math.max(...(ins.leagues as any[]).map((l: any) => l.count), 1);
                                const maxMin   = Math.max(...(ins.minuteBreakdown as any[]).map((b: any) => b.count), 1);
                                return (
                                  <div className="mt-2 space-y-3 rounded-xl bg-white/3 p-3 border border-accent-amber/15">

                                    {/* summary row */}
                                    <div className="flex items-center gap-3 flex-wrap text-[10px]">
                                      <span className="text-text-muted">{ins.total} triggers</span>
                                      {ins.overallSuccessRate !== null && (
                                        <span className={`font-bold ${
                                          ins.overallSuccessRate >= 65 ? 'text-accent-green' :
                                          ins.overallSuccessRate >= 45 ? 'text-accent-amber' : 'text-red-400'
                                        }`}>{ins.overallSuccessRate}% success (rated)</span>
                                      )}
                                      {ins.avgGoalsAdded !== null && (
                                        <span className="text-accent-cyan">avg +{ins.avgGoalsAdded} goals after trigger</span>
                                      )}
                                    </div>

                                    {/* League breakdown */}
                                    {(ins.leagues as any[]).length > 0 && (
                                      <div>
                                        <div className="flex items-center gap-1 text-[10px] text-text-muted mb-1.5">
                                          <Globe className="w-3 h-3" /> League breakdown
                                        </div>
                                        <div className="space-y-1">
                                          {(ins.leagues as any[]).map((l: any) => {
                                              const pct = Math.round((l.count / maxCount) * 100);
                                              return (
                                            <div key={l.name} className="flex items-center gap-2">
                                              <span className="text-[10px] text-white truncate w-28 shrink-0">{l.name}</span>
                                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full bg-accent-purple w-[${pct}%]`} />
                                              </div>
                                              <span className="text-[10px] text-text-muted w-5 text-right shrink-0">{l.count}</span>
                                              {l.successRate !== null && (
                                                <span className={`text-[10px] font-bold w-9 text-right shrink-0 ${
                                                  l.successRate >= 65 ? 'text-accent-green' :
                                                  l.successRate >= 45 ? 'text-accent-amber' : 'text-red-400'
                                                }`}>{l.successRate}%</span>
                                              )}
                                            </div>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Minute breakdown */}
                                    {(ins.minuteBreakdown as any[]).length > 1 && (
                                      <div>
                                        <div className="flex items-center gap-1 text-[10px] text-text-muted mb-1.5">
                                          <Activity className="w-3 h-3" /> Trigger minute
                                        </div>
                                        <div className="flex items-end gap-1.5 h-9">
                                          {(ins.minuteBreakdown as any[]).map((b: any) => {
                                            const barH = Math.round((b.count / maxMin) * 36);
                                            return (
                                            <div key={b.range} className="flex-1 flex flex-col items-center gap-0.5">
                                              <div className="w-full flex items-end justify-center h-9">
                                                <div
                                                  className={`w-full rounded-t h-[${barH}px] ${
                                                    b.successRate !== null && b.successRate >= 65 ? 'bg-accent-green/60' :
                                                    b.successRate !== null && b.successRate < 45  ? 'bg-red-400/50' : 'bg-accent-cyan/50'
                                                  }`}
                                                />
                                              </div>
                                              <span className="text-[9px] text-text-muted">{b.range}&apos;</span>
                                              {b.successRate !== null && (
                                                <span className={`text-[9px] font-bold ${
                                                  b.successRate >= 65 ? 'text-accent-green' :
                                                  b.successRate < 45  ? 'text-red-400' : 'text-accent-amber'
                                                }`}>{b.successRate}%</span>
                                              )}
                                            </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Score state */}
                                    {(ins.scoreBreakdown as any[]).length > 0 && ins.avgGoalsAdded !== null && (
                                      <div>
                                        <div className="flex items-center gap-1 text-[10px] text-text-muted mb-1.5">
                                          <Trophy className="w-3 h-3" /> Goals added after trigger
                                        </div>
                                        <div className="grid grid-cols-4 gap-1">
                                          {(ins.scoreBreakdown as any[]).map((s: any) => (
                                            <div key={s.state} className="text-center bg-white/5 rounded-lg py-1.5 px-1">
                                              <div className="text-[9px] text-text-muted">{s.state}</div>
                                              {s.avgGoalsAfter !== null
                                                ? <div className={`text-sm font-bold ${
                                                    s.avgGoalsAfter >= 1.5 ? 'text-accent-green' :
                                                    s.avgGoalsAfter >= 0.8 ? 'text-accent-amber' : 'text-red-400'
                                                  }`}>+{s.avgGoalsAfter}</div>
                                                : <div className="text-xs text-text-muted">—</div>
                                              }
                                              <div className="text-[9px] text-text-muted">{s.count}×</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {ins.withFeedback < 3 && (
                                      <p className="text-[10px] text-text-muted italic">
                                        Rate triggers with 👍/👎 in History to unlock success rate patterns.
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
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
          <>
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
          </>
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
