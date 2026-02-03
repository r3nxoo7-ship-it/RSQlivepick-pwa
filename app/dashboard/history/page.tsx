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
  Calendar
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
  
  const itemsPerPage = 20;

  // Load triggered matches
  const loadTriggeredMatches = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;

      let matches: TriggeredMatch[] = [];

      if (timeRange === 'all') {
        // Load historical data with pagination
        matches = await dbHelpers.getTriggeredMatchesHistory(
          currentUser.id,
          itemsPerPage,
          page * itemsPerPage
        );
      } else {
        // Load recent data based on time range
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

      if (page === 0) {
        setTriggeredMatches(matches);
      } else {
        setTriggeredMatches(prev => [...prev, ...matches]);
      }

      setHasMore(matches.length === itemsPerPage);
      setError(null);
    } catch (err) {
      console.error('Error loading triggered matches:', err);
      setError('Failed to load triggered matches');
    } finally {
      setLoading(false);
    }
  }, [page, timeRange]);

  useEffect(() => {
    loadTriggeredMatches();
  }, [loadTriggeredMatches]);

  // Handle time range change
  const handleTimeRangeChange = (range: typeof timeRange) => {
    setTimeRange(range);
    setPage(0);
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
          
          {/* ========== HEADER ========== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-8"
          >
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
          </motion.div>

          {/* ========== TIME FILTER ========== */}
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

          {/* ========== STATS ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="glass-card p-4 rounded-lg border border-glass-lighter">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-accent-cyan" />
                <span className="text-xs font-semibold text-text-secondary">Total Triggered</span>
              </div>
              <div className="text-2xl font-bold text-accent-cyan">{triggeredMatches.length}</div>
            </div>

            <div className="glass-card p-4 rounded-lg border border-glass-lighter">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-accent-green" />
                <span className="text-xs font-semibold text-text-secondary">Unique Matches</span>
              </div>
              <div className="text-2xl font-bold text-accent-green">
                {new Set(triggeredMatches.map(m => m.match_id)).size}
              </div>
            </div>

            <div className="glass-card p-4 rounded-lg border border-glass-lighter">
              <div className="flex items-center gap-2 mb-2">
                <FilterIcon className="w-4 h-4 text-accent-purple" />
                <span className="text-xs font-semibold text-text-secondary">Unique Filters</span>
              </div>
              <div className="text-2xl font-bold text-accent-purple">
                {new Set(triggeredMatches.map(m => m.filter_id)).size}
              </div>
            </div>

            <div className="glass-card p-4 rounded-lg border border-glass-lighter">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-accent-amber" />
                <span className="text-xs font-semibold text-text-secondary">Today</span>
              </div>
              <div className="text-2xl font-bold text-accent-amber">
                {triggeredMatches.filter(m => {
                  const now = new Date();
                  const triggered = new Date(m.triggered_at);
                  return now.getDate() === triggered.getDate();
                }).length}
              </div>
            </div>
          </motion.div>

          {/* ========== TRIGGERED MATCHES LIST ========== */}
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
              {triggeredMatches.map((match) => (
                <motion.div
                  key={`${match.match_id}-${match.filter_id}-${match.created_at}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-4 border border-glass-lighter hover:border-accent-cyan/50 transition-all"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                    
                    {/* Match Info */}
                    <div className="col-span-1 md:col-span-2">
                      <h3 className="font-semibold text-base mb-2">
                        <span className="text-accent-cyan">{match.home_team}</span>
                        <span className="text-text-secondary mx-2">vs</span>
                        <span className="text-accent-cyan">{match.away_team}</span>
                      </h3>
                      <p className="text-xs text-text-muted mb-2">{match.league_name}</p>
                      
                      {/* Score */}
                      {match.score_home !== null && match.score_away !== null && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-accent-green">
                            {match.score_home} - {match.score_away}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded font-semibold ${
                            match.match_status === 'finished' ? 'bg-accent-amber/20 text-accent-amber' :
                            match.match_status === 'ongoing' ? 'bg-accent-green/20 text-accent-green' :
                            'bg-glass-light text-text-secondary'
                          }`}>
                            {match.match_status === 'ongoing' && match.match_time 
                              ? `${match.match_time}'`
                              : match.match_status === 'finished' 
                              ? 'Finished'
                              : 'Scheduled'
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Filter Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FilterIcon className="w-4 h-4 text-accent-purple flex-shrink-0" />
                        <span className="font-semibold text-sm text-accent-purple">{match.filter_name}</span>
                      </div>
                      <p className="text-xs text-text-muted">Filter triggered this match</p>
                    </div>

                    {/* Time */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-2">
                        <Clock className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                        <div className="text-right">
                          <p className="font-semibold text-sm text-accent-cyan">
                            {getTimeSinceTriggered(match.triggered_at)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {new Date(match.triggered_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ========== LOAD MORE ========== */}
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
