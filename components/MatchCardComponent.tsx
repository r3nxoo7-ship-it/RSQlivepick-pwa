'use client';

import { motion } from 'framer-motion';
import { Target, TrendingUp } from 'lucide-react';
import type { LiveMatch } from '@/lib/types';
import { FilterMatchResult } from '@/lib/filter-engine';

interface MatchCardProps {
  match: LiveMatch;
  onClick?: () => void;
  showStatistics?: boolean;
  filterResults?: FilterMatchResult[];
}

export default function MatchCard({
  match,
  onClick,
  showStatistics = true,
  filterResults = [],
}: MatchCardProps) {
  const status = match.fixture?.status?.short || 'TBD';
  const isLive = status === 'LIVE' || status === '1H' || status === '2H';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`glass-card p-4 cursor-pointer transition-all hover:border-accent-cyan ${
        isLive ? 'border-accent-red' : ''
      }`}
    >
      {/* Header: League + Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted">
          {match.league?.name || 'Unknown'}
        </span>
        {isLive && (
          <span className="px-2 py-0.5 rounded-full bg-accent-red text-xs font-bold text-white animate-pulse">
            🔴 LIVE
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">{match.teams?.home?.name}</span>
          <span className="text-lg font-bold text-accent-cyan">
            {match.goals?.home ?? '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">{match.teams?.away?.name}</span>
          <span className="text-lg font-bold text-accent-cyan">
            {match.goals?.away ?? '-'}
          </span>
        </div>
      </div>

      {/* Match Info */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
        <span>{match.fixture?.status?.long}</span>
        {match.fixture?.status?.elapsed && (
          <span>• {match.fixture.status.elapsed}&apos;</span>
        )}
      </div>

      {/* Filter Results */}
      {showStatistics && filterResults && filterResults.length > 0 && (
        <div className="border-t border-glass-light pt-2">
          <div className="flex items-center gap-1 text-xs text-accent-cyan">
            <Target className="w-3 h-3" />
            <span>{filterResults.length} filter match(es)</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
