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
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
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

      if (timeRange === 'all') {
        matches = await dbHelpers.getTriggeredMatchesHistory(
          currentUser.id,
          itemsPerPage,
          page * itemsPerPage
        );
      } else {
        const minutesMap = {
          '24h': 24 * 60,
          '7d': 7 * 24 * 60,
          '30d': 30 * 24 * 60,
        };
        
        matches = await dbHelpers.getTriggeredMatches(
          currentUser.id,
          minutesMap[timeRange] || 20,
          50
        );
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {/* ... stats rămân neschimbate */}
          </motion.div>

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
              <p className="text-text-secondary">No triggered matches found</p>
              <p className="text-xs text-text-muted mt-2">Matches that trigger your filters will appear here</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              {/* ... lista de meciuri rămâne neschimbată */}
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