'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { LiveMatch } from '@/lib/api-football';
import { Filter } from '@/lib/supabase';
import { getMatchingFiltersForMatch, calculateMatchPredictability, FilterMatchDetails } from '@/lib/live-filter-matcher';

interface LiveMatchesDashboardProps {
  matches?: LiveMatch[];
  userFilters?: Filter[];
  loading?: boolean;
}

interface MatchWithPredictions extends LiveMatch {
  matchingFilters?: FilterMatchDetails[];
  matchingCount?: number;
  predictability?: number; // 0-100
  statsSummary?: StatsSummary;
}

export interface StatsSummary {
  possession: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  shotsOffTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
  dangerousAttacks: { home: number; away: number };
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

        // Parse statistics from match data
        const stats = parseMatchStats(match);

        // Calculate predictability
        const predictability = calculateMatchPredictability(match, matching);

        return {
          ...match,
          matchingFilters: matching,
          matchingCount: matching.filter(m => m.isMatching).length,
          predictability,
          statsSummary: stats,
        };
      });

      setMatchesWithPredictions(enhanced);
    }
  }, [matches, userFilters]);

  const parseMatchStats = (match: LiveMatch): StatsSummary => {
    const stats = match.statistics || [];
    const homeStats = stats.find(s => s.team?.id === match.teams?.home?.id);
    const awayStats = stats.find(s => s.team?.id === match.teams?.away?.id);

    return {
      possession: {
        home: (homeStats?.statistics?.find(s => s.type === 'Possession')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Possession')?.value as number) || 0,
      },
      shotsOnTarget: {
        home: (homeStats?.statistics?.find(s => s.type === 'Shots on Goal')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Shots on Goal')?.value as number) || 0,
      },
      shotsOffTarget: {
        home: (homeStats?.statistics?.find(s => s.type === 'Shots off Goal')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Shots off Goal')?.value as number) || 0,
      },
      corners: {
        home: (homeStats?.statistics?.find(s => s.type === 'Corner Kicks')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Corner Kicks')?.value as number) || 0,
      },
      fouls: {
        home: (homeStats?.statistics?.find(s => s.type === 'Fouls Committed')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Fouls Committed')?.value as number) || 0,
      },
      yellowCards: {
        home: (homeStats?.statistics?.find(s => s.type === 'Yellow Cards')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Yellow Cards')?.value as number) || 0,
      },
      redCards: {
        home: (homeStats?.statistics?.find(s => s.type === 'Red Cards')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Red Cards')?.value as number) || 0,
      },
      dangerousAttacks: {
        home: (homeStats?.statistics?.find(s => s.type === 'Dangerous Attacks')?.value as number) || 0,
        away: (awayStats?.statistics?.find(s => s.type === 'Dangerous Attacks')?.value as number) || 0,
      },
    };
  };

  const calculatePredictability = (matching: FilterMatchDetails[], stats: StatsSummary): number => {
    return matching.length > 0
      ? Math.round(matching.reduce((sum, m) => sum + m.confidence, 0) / matching.length)
      : 0;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh logic would go here
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
          <h2 className="text-3xl font-bold text-white">Today&apos;s Matches</h2>
          <p className="text-text-secondary mt-1">{matchesWithPredictions.length} matches • Live updates</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 disabled:opacity-50 transition"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </motion.div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matchesWithPredictions.map((match, idx) => (
          <LiveMatchCard key={match.fixture.id} match={match} idx={idx} onSelect={setSelectedMatch} isSelected={selectedMatch?.fixture?.id === match.fixture?.id} />
        ))}
      </div>

      {/* Detail View */}
      {selectedMatch && <LiveMatchDetail match={selectedMatch} onClose={() => setSelectedMatch(null)} />}
    </div>
  );
}

function LiveMatchCard({ match, idx, onSelect, isSelected }: { match: MatchWithPredictions; idx: number; onSelect: (m: MatchWithPredictions) => void; isSelected: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} onClick={() => onSelect(match)}>
      <div
        className={`glass-card p-4 rounded-xl border transition cursor-pointer ${
          isSelected ? 'border-accent-cyan bg-accent-cyan/10' : 'border-glass-light hover:border-accent-cyan'
        }`}
      >
        {/* Match Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <p className="text-xs text-text-muted">{match.league?.name || 'Match'}</p>
            <p className="text-sm font-semibold text-white mt-1">{match.fixture?.status?.elapsed || 0}&apos;</p>
          </div>
          <div className="text-right">
            <div className="inline-block px-2 py-1 rounded-full bg-accent-green/20 text-accent-green text-xs font-bold">
              LIVE
            </div>
          </div>
        </div>

        {/* Teams & Score */}
        <div className="space-y-2 mb-4">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-white">{match.teams?.home?.name}</p>
            </div>
            <div className="text-2xl font-bold text-accent-cyan">{match.goals?.home || 0}</div>
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-white">{match.teams?.away?.name}</p>
            </div>
            <div className="text-2xl font-bold text-accent-cyan">{match.goals?.away || 0}</div>
          </div>
        </div>

        {/* Stats Preview */}
        {match.statsSummary && (
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
            <div className="p-2 rounded bg-glass-light">
              <div className="text-text-muted">Possession</div>
              <div className="font-bold text-accent-cyan">{match.statsSummary.possession.home}%</div>
            </div>
            <div className="p-2 rounded bg-glass-light">
              <div className="text-text-muted">Shots</div>
              <div className="font-bold text-accent-cyan">{match.statsSummary.shotsOnTarget.home + match.statsSummary.shotsOnTarget.away}</div>
            </div>
            <div className="p-2 rounded bg-glass-light">
              <div className="text-text-muted">Corners</div>
              <div className="font-bold text-accent-cyan">{match.statsSummary.corners.home + match.statsSummary.corners.away}</div>
            </div>
          </div>
        )}

        {/* Predictability & Matching Filters */}
        {match.matchingCount! > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent-cyan" />
              <span className="text-sm font-semibold text-accent-cyan">
                {match.matchingCount} filter{match.matchingCount !== 1 ? 's' : ''} matching ({match.predictability}% confidence)
              </span>
            </div>
            <div className="w-full h-1 bg-glass-light rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue" style={{ width: `${match.predictability}%` }} />
            </div>
          </motion.div>
        )}

        {/* Click to View Button */}
        <button className="w-full py-2 px-3 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 text-sm font-semibold transition">
          {isSelected ? 'Close Details' : 'View Details'}
        </button>
      </div>
    </motion.div>
  );
}

function LiveMatchDetail({ match, onClose }: { match: MatchWithPredictions; onClose: () => void }) {
  if (!match.statsSummary) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl border border-accent-cyan/30 bg-accent-cyan/5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Match Statistics</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-white transition">
          ✕
        </button>
      </div>

      {/* Match Info */}
      <div className="mb-6 p-4 rounded-lg bg-glass-light">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">{match.teams?.home?.name}</p>
            <p className="text-sm text-text-secondary">{match.league?.name}</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent-cyan">
              {match.goals?.home || 0} - {match.goals?.away || 0}
            </div>
            <p className="text-xs text-text-muted mt-1">{match.fixture?.status?.elapsed || 0}&apos;</p>
          </div>
          <div>
            <p className="font-semibold text-white text-right">{match.teams?.away?.name}</p>
            <p className="text-sm text-text-secondary text-right">{match.league?.flag}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatBar title="Possession" home={match.statsSummary.possession.home} away={match.statsSummary.possession.away} unit="%" />
        <StatBar title="Shots on Target" home={match.statsSummary.shotsOnTarget.home} away={match.statsSummary.shotsOnTarget.away} />
        <StatBar title="Shots off Target" home={match.statsSummary.shotsOffTarget.home} away={match.statsSummary.shotsOffTarget.away} />
        <StatBar title="Corners" home={match.statsSummary.corners.home} away={match.statsSummary.corners.away} />
        <StatBar title="Fouls" home={match.statsSummary.fouls.home} away={match.statsSummary.fouls.away} />
        <StatBar title="Yellow Cards" home={match.statsSummary.yellowCards.home} away={match.statsSummary.yellowCards.away} />
        <StatBar title="Red Cards" home={match.statsSummary.redCards.home} away={match.statsSummary.redCards.away} />
        <StatBar title="Dangerous Attacks" home={match.statsSummary.dangerousAttacks.home} away={match.statsSummary.dangerousAttacks.away} />
      </div>

      {/* Matching Filters */}
      {match.matchingFilters && match.matchingFilters.length > 0 && (
        <div className="mt-6 p-4 rounded-lg bg-accent-green/10 border border-accent-green/30">
          <p className="font-semibold text-accent-green mb-3">
            Your filters ({match.matchingFilters.filter(f => f.isMatching).length} matching):
          </p>
          <div className="space-y-3">
            {match.matchingFilters.map(detail => (
              <motion.div
                key={detail.filter.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-3 rounded-lg border ${
                  detail.isMatching
                    ? 'bg-accent-green/20 border-accent-green/50'
                    : 'bg-glass-light border-glass-lighter'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-white text-sm">{detail.filter.name}</p>
                    <p className="text-xs text-text-secondary mt-1">{detail.reasoning}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent-cyan">{detail.confidence}%</div>
                    {detail.isMatching && (
                      <div className="text-xs px-2 py-1 rounded-full bg-accent-green/30 text-accent-green mt-1">
                        ✓ Matches
                      </div>
                    )}
                  </div>
                </div>

                {/* Matched conditions */}
                {detail.matchedConditions.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-accent-green font-semibold mb-1">✓ Matched:</p>
                    <div className="flex flex-wrap gap-1">
                      {detail.matchedConditions.map(cond => (
                        <span key={cond} className="text-xs px-2 py-1 rounded-full bg-accent-green/20 text-accent-green">
                          {cond}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed conditions */}
                {detail.failedConditions.length > 0 && (
                  <div>
                    <p className="text-xs text-accent-amber font-semibold mb-1">⚠ Needed:</p>
                    <div className="flex flex-wrap gap-1">
                      {detail.failedConditions.map(cond => (
                        <span key={cond} className="text-xs px-2 py-1 rounded-full bg-accent-amber/20 text-accent-amber">
                          {cond}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence bar */}
                <div className="mt-2 h-1.5 bg-glass-light rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${
                      detail.isMatching
                        ? 'from-accent-green to-accent-cyan'
                        : 'from-accent-amber to-accent-blue'
                    }`}
                    style={{ width: `${detail.confidence}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatBar({ title, home, away, unit = '' }: { title: string; home: number; away: number; unit?: string }) {
  const total = home + away || 1;
  const homePercent = (home / total) * 100;

  return (
    <div className="p-3 rounded-lg bg-glass-light">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-secondary">{title}</span>
        <div className="flex gap-2 text-xs font-bold">
          <span className="text-accent-cyan">
            {home}
            {unit}
          </span>
          <span className="text-text-muted">-</span>
          <span className="text-accent-blue">
            {away}
            {unit}
          </span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-glass-lighter">
        <div className="bg-gradient-to-r from-accent-cyan to-cyan-500" style={{ width: `${homePercent}%` }} />
        <div className="bg-gradient-to-r from-accent-blue to-blue-500" style={{ width: `${100 - homePercent}%` }} />
      </div>
    </div>
  );
}
