'use client';

// ============================================
// R$Q - ANALYTICS & HISTORY PAGE
// ============================================
// View filter performance, stats and history

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Zap,
  Download,
  Calendar,
  Filter as FilterIcon,
  Bell,
  Send,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';
import {
  calculateAllFiltersStats,
  calculateFilterStats,
  categorizeFilters,
  generatePerformanceTrend,
  getBestFilter,
  getMostActiveFilter,
  getPerformanceRating,
  formatSuccessRate,
  exportToCSV,
  type FilterStats,
} from '@/lib/analytics';

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function AnalyticsPage() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [timeRange, setTimeRange] = useState<7 | 30>(7);
  
  // Stats
  const [overallStats, setOverallStats] = useState<any>(null);
  const [categoryStats, setCategoryStats] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [topFilters, setTopFilters] = useState<FilterStats[]>([]);
  
  // ============================================
  // LOAD DATA
  // ============================================
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const user = authHelpers.getCurrentUser();
        if (!user) {
          router.push('/login');
          return;
        }
        const userFilters = await dbHelpers.getUserFilters(user.id);
        setFilters(userFilters);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (filters.length === 0) return;

    // calculateStats inline to avoid missing-deps lint
    const overall = calculateAllFiltersStats(filters);
    setOverallStats(overall);

    const categories = categorizeFilters(filters);
    setCategoryStats(categories);

    const trend = generatePerformanceTrend(filters, timeRange);
    setTrendData(trend);

    setTopFilters(overall.topPerformers);
  }, [filters, timeRange]);
  
  const loadAnalytics = async () => {
    setLoading(true);
    
    try {
      const user = authHelpers.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const userFilters = await dbHelpers.getUserFilters(user.id);
      setFilters(userFilters);
      
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const calculateStats = () => {
    // Overall stats
    const overall = calculateAllFiltersStats(filters);
    setOverallStats(overall);
    
    // Category stats
    const categories = categorizeFilters(filters);
    setCategoryStats(categories);
    
    // Trend data
    const trend = generatePerformanceTrend(filters, timeRange);
    setTrendData(trend);
    
    // Top filters
    setTopFilters(overall.topPerformers);
  };
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleExport = () => {
    const csv = exportToCSV(filters);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsq-filters-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  
  const bestFilter = getBestFilter(filters);
  const mostActive = getMostActiveFilter(filters);
  
  // ============================================
  // RENDER
  // ============================================
  
  if (loading) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-text-secondary">Loading analytics...</p>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  
  if (filters.length === 0) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <BarChart3 className="w-20 h-20 text-text-muted mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">
              No Statistics Available
            </h2>
            <p className="text-text-muted mb-6">
              Create your first filter to see analytics and statistics
            </p>
            <button
              onClick={() => router.push('/dashboard/filters/new')}
              className="btn-primary"
            >
              Create First Filter
            </button>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text mb-2">
                Analytics & History
              </h1>
              <p className="text-text-secondary">
                Filter stats and performance analysis
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              
              <select  
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value) as 7 | 30)}
                className="input-field w-full sm:w-40"
                title="Select time range"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>
          </div>
          
          {/* ========== OVERVIEW STATS ========== */}
          {overallStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-accent-cyan/10">
                    <FilterIcon className="w-6 h-6 text-accent-cyan" />
                  </div>
                </div>
                <h3 className="text-3xl font-display font-bold mb-1">
                  {overallStats.total}
                </h3>
                <p className="text-sm text-text-muted">Total Filters</p>
                <p className="text-xs text-accent-cyan mt-2">
                  {overallStats.active} active
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-accent-amber/10">
                    <Zap className="w-6 h-6 text-accent-amber" />
                  </div>
                </div>
                <h3 className="text-3xl font-display font-bold mb-1">
                  {overallStats.totalTriggers}
                </h3>
                <p className="text-sm text-text-muted">Total Triggers</p>
                {overallStats.totalTriggers === 0 && (
                  <p className="text-[10px] text-text-muted mt-2">
                    Triggers are logged when live matches meet your filter conditions while the app is open
                  </p>
                )}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-accent-green/10">
                    <Target className="w-6 h-6 text-accent-green" />
                  </div>
                </div>
                <h3 className="text-3xl font-display font-bold mb-1">
                  {formatSuccessRate(overallStats.avgSuccessRate)}
                </h3>
                <p className="text-sm text-text-muted">Average Success Rate</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-accent-purple/10">
                    <Bell className="w-6 h-6 text-accent-purple" />
                  </div>
                </div>
                <h3 className="text-3xl font-display font-bold mb-1">
                  {overallStats.withNotifications + overallStats.withTelegram}
                </h3>
                <p className="text-sm text-text-muted">With Notifications</p>
                <p className="text-xs text-text-muted mt-2">
                  {overallStats.withNotifications} browser, {overallStats.withTelegram} Telegram
                </p>
              </motion.div>
            </div>
          )}
          
          {/* ========== PERFORMANCE TREND ========== */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-cyan" />
              Performance Trend
            </h2>
            
            {trendData.length > 0 && (
              <div className="h-64 flex items-end gap-2">
                {trendData.map((day, index) => (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <div className="text-xs text-text-muted text-center">
                      {day.successRate}%
                    </div>
                    <div className="w-full bg-glass-light rounded-t-lg relative group">
                      <div
                        className="bg-gradient-to-t from-accent-cyan to-accent-green rounded-t-lg transition-all duration-300 group-hover:opacity-80"
                        style={{ height: `${(day.successRate / 100) * 200}px` } as React.CSSProperties}
                      />
                    </div>
                    <div className="text-xs text-text-muted text-center">
                      {day.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* ========== BEST PERFORMERS & CATEGORIES ========== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Filters */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-accent-amber" />
                Top 5 Filters
              </h2>
              
              {topFilters.length > 0 ? (
                <div className="space-y-3">
                  {topFilters.map((filterStat, index) => {
                    const rating = getPerformanceRating(filterStat.successRate);
                    
                    return (
                      <motion.div
                        key={filterStat.filterId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 rounded-lg bg-glass-light hover:bg-glass-medium transition-all cursor-pointer"
                        onClick={() => router.push(`/dashboard/filters/${filterStat.filterId}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-accent-amber">
                              #{index + 1}
                            </span>
                            <div>
                              <h3 className="font-semibold text-sm">
                                {filterStat.filterName}
                              </h3>
                              <p className="text-xs text-text-muted">
                                {filterStat.totalTriggers} triggers
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className={`text-lg font-bold ${rating.color}`}>
                              {formatSuccessRate(filterStat.successRate)}
                            </p>
                            <p className="text-xs text-text-muted">{rating.label}</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                          {filterStat.isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-xs">
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
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-text-muted py-8">
                  No filters with triggers yet
                </p>
              )}
            </div>
            
            {/* Category Stats */}
            {categoryStats && (
              <div className="glass-card p-6">
                <h2 className="text-xl font-display font-semibold mb-4">
                  Filters by Category
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">⚽ Corners</span>
                      <span className="font-semibold">{categoryStats.corners}</span>
                    </div>
                    <div className="h-2 bg-glass-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-cyan"
                        style={{ 
                          width: `${(categoryStats.corners / filters.length) * 100}%` 
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">🎯 Shots</span>
                      <span className="font-semibold">{categoryStats.shots}</span>
                    </div>
                    <div className="h-2 bg-glass-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-green"
                        style={{ 
                          width: `${(categoryStats.shots / filters.length) * 100}%` 
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">🟨 Cards</span>
                      <span className="font-semibold">{categoryStats.cards}</span>
                    </div>
                    <div className="h-2 bg-glass-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-amber"
                        style={{ 
                          width: `${(categoryStats.cards / filters.length) * 100}%` 
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">🔥 Mixed</span>
                      <span className="font-semibold">{categoryStats.mixed}</span>
                    </div>
                    <div className="h-2 bg-glass-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-purple"
                        style={{ 
                          width: `${(categoryStats.mixed / filters.length) * 100}%` 
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* ========== INSIGHTS ========== */}
          {(bestFilter || mostActive) && (
            <div className="glass-card p-6">
              <h2 className="text-xl font-display font-semibold mb-4">
                💡 Performance Insights
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bestFilter && (
                  <div className="p-4 rounded-lg bg-gradient-to-br from-accent-green/10 to-accent-cyan/10 border border-accent-green/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold mb-1">Best Performing Filter</h3>
                        <p className="text-sm text-text-muted mb-2">
                          <span className="font-semibold text-accent-green">{bestFilter.name}</span>
                          {' '}has the best success rate to triggers ratio
                        </p>
                        <button
                          onClick={() => router.push(`/dashboard/filters/${bestFilter.id}`)}
                          className="text-xs text-accent-cyan hover:underline flex items-center gap-1"
                        >
                          View Filter
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {mostActive && (
                  <div className="p-4 rounded-lg bg-gradient-to-br from-accent-amber/10 to-accent-purple/10 border border-accent-amber/20">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-accent-amber flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold mb-1">Most Active Filter</h3>
                        <p className="text-sm text-text-muted mb-2">
                          <span className="font-semibold text-accent-amber">{mostActive.name}</span>
                          {' '}has been triggered the most times
                        </p>
                        <button
                          onClick={() => router.push(`/dashboard/filters/${mostActive.id}`)}
                          className="text-xs text-accent-cyan hover:underline flex items-center gap-1"
                        >
                          View Filter
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </AuthWrapper>
  );
}
