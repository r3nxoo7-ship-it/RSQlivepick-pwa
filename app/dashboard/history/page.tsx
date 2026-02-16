'use client';

// ============================================
// TRIGGERED MATCHES HISTORY PAGE
// ============================================
// Shows all triggered matches with detailed history
// Displays which filters matched which games and when

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Clock, 
  Filter as FilterIcon,
  Zap,
  Trophy,
  TrendingUp,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { TriggeredMatch } from '@/lib/supabase';

export default function HistoryTriggeredPage() {
  const router = useRouter();
  
  const [triggeredMatches, setTriggeredMatches] = useState<TriggeredMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('7d');
  const [refreshing, setRefreshing] = useState(false); // pentru butonul Refresh
  
  const itemsPerPage = 20;

  // Load triggered matches (folosită atât la mount, cât și la refresh)
  const loadTriggeredMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;

      let matches: TriggeredMatch[] = [];

      try {
        const params = new URLSearchParams({
          user_id: currentUser.id,
          range: timeRange,
          limit: String(itemsPerPage),
          offset: String(page * itemsPerPage),
        });
        const res = await fetch(`/api/triggered-matches/list?${params}`);
        const result = await res.json();
        matches = result.matches || [];
      } catch (fetchErr) {
        console.error('Error fetching triggered matches from API:', fetchErr);
        matches = [];
      }

      if (page === 0 || isRefresh) {
        setTriggeredMatches(matches);
      } else {
        setTriggeredMatches(prev => [...prev, ...matches]);
      }

      setHasMore(matches.length === itemsPerPage);
    } catch (err) {
      console.error('Error loading triggered matches:', err);
      setError('Failed to load triggered matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, timeRange]);

  // Load inițial la mount (o singură dată)
  useEffect(() => {
    loadTriggeredMatches();
  }, [loadTriggeredMatches]);

  // Handle time range change → reset page și reload
  const handleTimeRangeChange = (range: typeof timeRange) => {
    setTimeRange(range);
    setPage(0);
    loadTriggeredMatches(true); // reload imediat
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setPage(0);
    loadTriggeredMatches(true);
  };

  // Format time since triggered
  const getTimeSinceTriggered = (triggeredAt: string): string => {
    const now = new Date();
    const then = new Date(triggeredAt);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* HEADER */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-glass-light rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <div>
                <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent mb-2">
                  📊 Triggered Matches History
                </h1>
                <p className="text-text-secondary">Track all matches that triggered your filters</p>
              </div>
            </div>

            {/* Buton Refresh manual */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 glass-card rounded-lg hover:bg-glass-medium transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </motion.div>

          {/* TIME FILTER */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-4 flex gap-2 flex-wrap"
          >
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`
                  px-4 py-2 rounded-lg font-semibold transition-all text-sm
                  ${timeRange === range
                    ? 'bg-accent-cyan text-black'
                    : 'bg-glass-light text-text-secondary hover:bg-glass-medium'
                  }
                `}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                {range === 'all' ? 'All Time' : 'Last ' + range}
              </button>
            ))}
          </motion.div>

          {/* STATS */}
          {triggeredMatches.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-text-muted mb-1">Total Triggered</div>
                <div className="text-2xl font-bold text-accent-cyan">{triggeredMatches.length}</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-text-muted mb-1">Unique Matches</div>
                <div className="text-2xl font-bold text-accent-green">
                  {new Set(triggeredMatches.map(m => m.match_id)).size}
                </div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-text-muted mb-1">Filters Used</div>
                <div className="text-2xl font-bold text-accent-purple">
                  {new Set(triggeredMatches.map(m => m.filter_id)).size}
                </div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-text-muted mb-1">Avg Goals</div>
                <div className="text-2xl font-bold text-accent-amber">
                  {(triggeredMatches.reduce((sum, m) => sum + (m.score_home || 0) + (m.score_away || 0), 0) / triggeredMatches.length).toFixed(1)}
                </div>
              </div>
            </motion.div>
          )}

          {/* LISTA */}
          {loading && triggeredMatches.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="inline-block animate-spin mb-4">
                <Zap className="w-8 h-8 text-accent-cyan" />
              </div>
              <p className="text-text-secondary">Loading triggered matches...</p>
            </div>
          ) : triggeredMatches.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Trophy className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
              <p className="text-text-secondary">No triggered matches {timeRange !== 'all' ? `in the last ${timeRange}` : ''}</p>
              <p className="text-xs text-text-muted mt-2 max-w-sm mx-auto">
                Triggers are logged when live matches meet your filter conditions while you have the app open. Keep the app open during match times to see results here.
              </p>
              {timeRange !== 'all' && (
                <button
                  onClick={() => handleTimeRangeChange('all')}
                  className="text-accent-cyan text-xs mt-3 hover:underline"
                >
                  Try All Time
                </button>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              {triggeredMatches.map((match) => (
                <motion.div
                  key={match.id || `${match.match_id}-${match.filter_id}-${match.created_at}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 rounded-xl border border-glass-lighter hover:border-accent-cyan/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Match info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-accent-cyan shrink-0" />
                        <p className="font-semibold text-white truncate">
                          {match.home_team} vs {match.away_team}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                        {match.league_name && (
                          <span>{match.league_name}</span>
                        )}
                        {match.score_home != null && match.score_away != null && (
                          <span className="font-bold text-accent-green">
                            {match.score_home} - {match.score_away}
                          </span>
                        )}
                        {match.match_time != null && (
                          <span className="bg-accent-cyan/10 text-accent-cyan px-1.5 py-0.5 rounded font-semibold">
                            {match.match_time}&apos;
                          </span>
                        )}
                        <span className="capitalize text-text-muted">{match.match_status}</span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="text-right shrink-0">
                      <div className="text-xs text-accent-blue font-semibold">
                        {getTimeSinceTriggered(match.triggered_at)}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {new Date(match.triggered_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Filter info */}
                  <div className="mt-2 pt-2 border-t border-glass-lighter flex items-center gap-2">
                    <FilterIcon className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                    <span className="text-xs text-accent-purple font-semibold truncate">
                      {match.filter_name}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* LOAD MORE */}
          {hasMore && !loading && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setPage(prev => prev + 1)}
              className="w-full py-3 glass-card rounded-lg font-semibold text-accent-cyan hover:bg-glass-light transition-all"
            >
              Load More
            </motion.button>
          )}
        </div>
      </div>
    </AuthWrapper>
  );
}