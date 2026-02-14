'use client';

import { motion } from 'framer-motion';
import { Target, TrendingUp } from 'lucide-react';
import type { LiveMatch } from '@/lib/types';
import { FilterMatchResult } from '@/lib/filter-engine';
import { MatchOdds, formatOdds } from '@/lib/odds-provider';
import { memo } from 'react';

interface MatchCardProps {
  match: LiveMatch;
  onClick?: () => void;
  showStatistics?: boolean;
  filterResults?: FilterMatchResult[];
  odds?: MatchOdds;
}

function MatchCard({
  match,
  onClick,
  showStatistics = false,
  filterResults = [],
  odds,
}: MatchCardProps) {
  const isLive =
    match.fixture.status.short === 'LIVE' ||
    match.fixture.status.short === '1H' ||
    match.fixture.status.short === '2H' ||
    match.fixture.status.short === 'ET' ||
    match.fixture.status.short === 'P';

  const minute = match.fixture.status.elapsed || 0;

  return (
    <motion.div
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
          <span className="font-semibold text-text-primary">
            {match.teams?.home?.name}
          </span>
          <span className="text-lg font-bold text-accent-cyan">
            {match.goals?.home ?? '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">
            {match.teams?.away?.name}
          </span>
          <span className="text-lg font-bold text-accent-cyan">
            {match.goals?.away ?? '-'}
          </span>
        </div>
      </div>

      {/* Match Info */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
        <span>{match.fixture?.status?.long}</span>
        {minute && (
          <span>• {minute}&apos;</span>
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

      {/* Live Odds Display */}
      {odds && odds.bookmakers && (
        <div className="border-t border-glass-light pt-3 mt-3">
          <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-accent-amber">
            <TrendingUp className="w-3 h-3" />
            Live Odds (1X2)
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center px-2 py-1 rounded bg-glass-light border border-glass-lighter hover:border-accent-green transition cursor-pointer">
              <div className="font-bold text-accent-green">
                {formatOdds(odds.bookmakers.home_win)}
              </div>
              <div className="text-text-muted text-xs">Home</div>
            </div>
            <div className="text-center px-2 py-1 rounded bg-glass-light border border-glass-lighter hover:border-accent-purple transition cursor-pointer">
              <div className="font-bold text-accent-purple">
                {formatOdds(odds.bookmakers.draw)}
              </div>
              <div className="text-text-muted text-xs">Draw</div>
            </div>
            <div className="text-center px-2 py-1 rounded bg-glass-light border border-glass-lighter hover:border-accent-blue transition cursor-pointer">
              <div className="font-bold text-accent-blue">
                {formatOdds(odds.bookmakers.away_win)}
              </div>
              <div className="text-text-muted text-xs">Away</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(MatchCard);
