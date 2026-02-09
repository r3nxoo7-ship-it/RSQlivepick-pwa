'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, AlertCircle, Activity } from 'lucide-react';
import { LiveMatch } from '@/lib/unified-api';
import { Filter } from '@/lib/supabase';
import { getMatchingFiltersForMatch, calculateMatchPredictability, FilterMatchDetails } from '@/lib/live-filter-matcher';
import AdvancedMatchDetail from './AdvancedMatchDetail';

interface LiveMatchesDashboardProps {
  matches?: LiveMatch[];
  userFilters?: Filter[];
  loading?: boolean;
}

interface MatchWithPredictions extends LiveMatch {
  matchingFilters?: FilterMatchDetails[];
  matchingCount?: number;
  predictability?: number; // 0-100
}

export default function LiveMatchesDashboard({
  matches = [],
  userFilters = [],
  loading = false,
}: LiveMatchesDashboardProps) {
  const [matchesWithPredictions, setMatchesWithPredictions] = useState<MatchWithPredictions[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPredictions | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (matches.length > 0) {
      const enhanced = matches.map(match => {
        // Get matching filters with details
        const matching = getMatchingFiltersForMatch(match, userFilters);

        // Calculate predictability
        const predictability = calculateMatchPredictability(match, matching);

        return {
          ...match,
          matchingFilters: matching,
          matchingCount: matching.filter(m => m.isMatching).length,
          predictability,
        };
      });

      setMatchesWithPredictions(enhanced);
    }
  }, [matches, userFilters]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <Activity className="w-8 h-8 text-accent-cyan" />
            Live & Upcoming Matches (Next 3 Hours)
          </h2>
          <p className="text-text-secondary mt-1">
            {matchesWithPredictions.length} matches • Click any match for detailed analytics
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 disabled:opacity-50 transition flex items-center gap-2"
        >
          {refreshing ? (
            <>
              <div className="w-4 h-4 rounded-full border-b-2 border-accent-cyan animate-spin" />
              Refreshing...
            </>
          ) : (
            '↻ Refresh'
          )}
        </button>
      </motion.div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matchesWithPredictions.filter(match => match?.fixture?.id).map((match, idx) => (
          <LiveMatchCard
            key={match.fixture.id}
            match={match}
            idx={idx}
            onSelect={setSelectedMatch}
            isSelected={selectedMatch?.fixture?.id === match.fixture?.id}
          />
        ))}
      </div>

      {/* Advanced Detail View Modal */}
      {selectedMatch && <AdvancedMatchDetail match={selectedMatch} onClose={() => setSelectedMatch(null)} />}
    </div>
  );
}

function LiveMatchCard({ match, idx, onSelect, isSelected }: { match: MatchWithPredictions; idx: number; onSelect: (m: MatchWithPredictions) => void; isSelected: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={() => onSelect(match)}
    >
      <div
        className={`glass-card p-4 rounded-xl border transition cursor-pointer group hover:shadow-lg ${
          isSelected ? 'border-accent-cyan bg-accent-cyan/10' : 'border-glass-light hover:border-accent-cyan'
        }`}
      >
        {/* Match Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">
              {match.league?.name || 'Soccer'}
            </p>
            <p className="text-sm font-semibold text-white mt-1">{match.fixture?.status?.elapsed || 0}&apos;</p>
          </div>
          <div className="text-right flex items-center gap-2">
            <div className="inline-block px-2 py-1 rounded-full bg-accent-green/20 text-accent-green text-xs font-bold animate-pulse">
              ● LIVE
            </div>
            <div className="text-xs text-text-muted group-hover:text-accent-cyan transition">
              Click for details →
            </div>
          </div>
        </div>

        {/* Teams & Score */}
        <div className="space-y-2 mb-4">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-white">{match.teams?.home?.name || 'Unknown'}</p>
            </div>
            <div className="text-3xl font-bold text-accent-cyan">{match.goals?.home || 0}</div>
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-white">{match.teams?.away?.name || 'Unknown'}</p>
            </div>
            <div className="text-3xl font-bold text-accent-blue">{match.goals?.away || 0}</div>
          </div>
        </div>

        {/* Quick Stats Preview */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="p-2 rounded bg-glass-light/50">
            <div className="text-text-muted text-xs mb-1">Possession</div>
            <div className="font-bold text-accent-cyan text-sm">—</div>
          </div>
          <div className="p-2 rounded bg-glass-light/50">
            <div className="text-text-muted text-xs mb-1">Shots</div>
            <div className="font-bold text-accent-cyan text-sm">—</div>
          </div>
          <div className="p-2 rounded bg-glass-light/50">
            <div className="text-text-muted text-xs mb-1">Corners</div>
            <div className="font-bold text-accent-cyan text-sm">—</div>
          </div>
        </div>

        {/* Predictability & Matching Filters */}
        {match.matchingCount! > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent-cyan" />
              <span className="text-sm font-semibold text-accent-cyan">
                {match.matchingCount} filter{match.matchingCount !== 1 ? 's' : ''} matching
              </span>
            </div>
            <div className="w-full h-1.5 bg-glass-light rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue"
                initial={{ width: 0 }}
                animate={{ width: `${match.predictability}%` }}
                transition={{ delay: 0.2, duration: 0.5 }}
              />
            </div>
            <div className="text-xs text-text-muted mt-2">{match.predictability}% confidence</div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
