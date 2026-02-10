'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, AlertCircle, Activity, BarChart3, Calendar, Star } from 'lucide-react';
import { LiveMatch } from '@/lib/unified-api';
import { Filter } from '@/lib/supabase';
import { getMatchingFiltersForMatch, calculateMatchPredictability, FilterMatchDetails } from '@/lib/live-filter-matcher';
import AdvancedMatchDetail from './AdvancedMatchDetail';

interface LiveMatchesDashboardProps {
  matches?: LiveMatch[];
  liveMatches?: LiveMatch[];
  upcomingMatches?: LiveMatch[];
  scheduledMatches?: LiveMatch[];
  teamForm?: Record<string, any>;
  userFilters?: Filter[];
  loading?: boolean;
}

interface MatchWithPredictions extends LiveMatch {
  matchingFilters?: FilterMatchDetails[];
  matchingCount?: number;
  predictability?: number;
}

export default function LiveMatchesDashboardV2({
  matches = [],
  liveMatches = [],
  upcomingMatches = [],
  scheduledMatches = [],
  teamForm = {},
  userFilters = [],
  loading = false,
}: LiveMatchesDashboardProps) {
  const [liveWithPredictions, setLiveWithPredictions] = useState<MatchWithPredictions[]>([]);
  const [upcomingWithPredictions, setUpcomingWithPredictions] = useState<MatchWithPredictions[]>([]);
  const [predictedMatches, setPredictedMatches] = useState<MatchWithPredictions[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPredictions | null>(null);

  // Support both old (combined matches) and new (separated) API formats
  useEffect(() => {
    const currentLive = liveMatches.length > 0 ? liveMatches : [];
    const currentUpcoming = upcomingMatches.length > 0 ? upcomingMatches : [];

    // If using old format, separate by status
    if (currentLive.length === 0 && currentUpcoming.length === 0 && matches.length > 0) {
      const live = matches.filter(m => m.fixture?.status?.short === 'LIVE');
      const upcoming = matches.filter(m => m.fixture?.status?.short !== 'LIVE');

      enhanceMatches(live, setLiveWithPredictions);
      enhanceMatches(upcoming, setUpcomingWithPredictions);
    } else {
      enhanceMatches(currentLive, setLiveWithPredictions);
      enhanceMatches(currentUpcoming, setUpcomingWithPredictions);
    }

    // Build predicted matches from scheduled (7-day) matches
    if (scheduledMatches.length > 0 && userFilters.length > 0) {
      const enhanced = scheduledMatches.map(match => {
        const matching = getMatchingFiltersForMatch(match, userFilters);
        const predictability = calculateMatchPredictability(match, matching);
        return {
          ...match,
          matchingFilters: matching,
          matchingCount: matching.filter(m => m.isMatching).length,
          predictability,
        };
      });

      // Sort by predictability descending, take top 20
      const sorted = enhanced
        .filter(m => m.predictability! > 0)
        .sort((a, b) => (b.predictability || 0) - (a.predictability || 0))
        .slice(0, 20);

      setPredictedMatches(sorted);
    } else {
      setPredictedMatches([]);
    }
  }, [liveMatches, upcomingMatches, scheduledMatches, matches, userFilters]);

  const enhanceMatches = (
    matchList: LiveMatch[],
    setter: (m: MatchWithPredictions[]) => void
  ) => {
    if (matchList.length > 0) {
      const enhanced = matchList.map(match => {
        const matching = getMatchingFiltersForMatch(match, userFilters);
        const predictability = calculateMatchPredictability(match, matching);
        return {
          ...match,
          matchingFilters: matching,
          matchingCount: matching.filter(m => m.isMatching).length,
          predictability,
        };
      });
      setter(enhanced);
    } else {
      setter([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* PREDICTED MATCHES SECTION (TOP) */}
      {predictedMatches.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent-yellow" />
            <h3 className="text-xl font-bold text-white">PREDICTED ({predictedMatches.length})</h3>
            <span className="text-xs text-text-muted ml-2">Next 7 days • sorted by probability</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {predictedMatches.map((match, idx) => (
              <MatchCard
                key={match.fixture?.id || `pred-${idx}`}
                match={match}
                idx={idx}
                onSelect={setSelectedMatch}
                isSelected={selectedMatch?.fixture?.id === match.fixture?.id}
                teamForm={teamForm}
                isLive={false}
                showDate={true}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* No predictions hint */}
      {predictedMatches.length === 0 && userFilters.length === 0 && scheduledMatches.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="p-4 rounded-xl border border-accent-yellow/30 bg-accent-yellow/5">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-accent-yellow" />
              <span className="text-sm font-semibold text-accent-yellow">Predictions available</span>
            </div>
            <p className="text-xs text-text-muted">
              Create filters to see predicted matches for the next 7 days, sorted by probability.
            </p>
          </div>
        </motion.div>
      )}

      {/* LIVE MATCHES SECTION */}
      {liveWithPredictions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent-red animate-pulse" />
            <h3 className="text-xl font-bold text-white">NOW PLAYING ({liveWithPredictions.length})</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {liveWithPredictions.map((match, idx) => (
              <MatchCard
                key={match.fixture?.id || idx}
                match={match}
                idx={idx}
                onSelect={setSelectedMatch}
                isSelected={selectedMatch?.fixture?.id === match.fixture?.id}
                teamForm={teamForm}
                isLive={true}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* TODAY'S MATCHES SECTION */}
      {upcomingWithPredictions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-blue" />
            <h3 className="text-xl font-bold text-white">TODAY ({upcomingWithPredictions.length})</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcomingWithPredictions.map((match, idx) => (
              <MatchCard
                key={match.fixture?.id || idx}
                match={match}
                idx={idx}
                onSelect={setSelectedMatch}
                isSelected={selectedMatch?.fixture?.id === match.fixture?.id}
                teamForm={teamForm}
                isLive={false}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* No Matches */}
      {liveWithPredictions.length === 0 && upcomingWithPredictions.length === 0 && predictedMatches.length === 0 && (
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted text-lg">No matches available</p>
          <p className="text-text-muted text-sm mt-2">Matches will appear once the sync runs. Check back shortly.</p>
        </div>
      )}

      {/* Advanced Detail View Modal */}
      {selectedMatch && (
        <AdvancedMatchDetail match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}

interface MatchCardProps {
  match: MatchWithPredictions;
  idx: number;
  onSelect: (m: MatchWithPredictions) => void;
  isSelected: boolean;
  teamForm: Record<string, any>;
  isLive: boolean;
  showDate?: boolean;
}

function MatchCard({
  match,
  idx,
  onSelect,
  isSelected,
  teamForm,
  isLive,
  showDate = false,
}: MatchCardProps) {
  const homeTeamId = match.teams?.home?.id?.toString();
  const awayTeamId = match.teams?.away?.id?.toString();

  const homeForm = teamForm?.[homeTeamId] || null;
  const awayForm = teamForm?.[awayTeamId] || null;

  const getStatValue = (stats: any[] | undefined, statType: string): string => {
    if (!stats || stats.length === 0) return '—';
    const homeStats = stats[0];
    if (homeStats?.statistics) {
      const found = homeStats.statistics.find((s: any) =>
        s.type?.toLowerCase().includes(statType.toLowerCase())
      );
      if (found?.value !== null && found?.value !== undefined) {
        return String(found.value);
      }
    }
    return '—';
  };

  const matchTime = match.fixture?.date ? new Date(match.fixture.date) : null;
  const now = new Date();

  const getTimeLabel = (): string => {
    if (!matchTime) return '';
    const diffMs = matchTime.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins <= 0) return 'started';

    if (diffMins < 60) return `in ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours}h ${diffMins % 60}m`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;
    return `in ${diffDays} days`;
  };

  const getDateLabel = (): string => {
    if (!matchTime) return '';
    return matchTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={() => onSelect(match)}
    >
      <div
        className={`glass-card p-5 rounded-xl border transition cursor-pointer group hover:shadow-lg ${
          isSelected ? 'border-accent-cyan bg-accent-cyan/10' : 'border-glass-light hover:border-accent-cyan'
        }`}
      >
        {/* Match Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">
              {match.league?.name || 'Soccer'}
            </p>
            <p className="text-sm font-semibold text-white mt-1">
              {isLive ? (
                <>
                  <span className="text-accent-green">● LIVE</span>
                  {match.fixture?.status?.elapsed && ` • ${match.fixture.status.elapsed}'`}
                </>
              ) : showDate ? (
                <span className="text-accent-blue">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {getDateLabel()} • {getTimeLabel()}
                </span>
              ) : (
                <span className="text-accent-blue">{getTimeLabel()}</span>
              )}
            </p>
          </div>
          <div className="text-right text-xs text-text-muted group-hover:text-accent-cyan transition">
            Details →
          </div>
        </div>

        {/* Teams & Score */}
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{match.teams?.home?.name || 'Unknown'}</p>
              {homeForm && <TeamFormBadge form={homeForm} />}
            </div>
            <div className="text-3xl font-bold text-accent-cyan min-w-[3rem] text-right">
              {match.goals?.home ?? 0}
            </div>
          </div>

          <div className="h-px bg-glass-light/50" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{match.teams?.away?.name || 'Unknown'}</p>
              {awayForm && <TeamFormBadge form={awayForm} />}
            </div>
            <div className="text-3xl font-bold text-accent-blue min-w-[3rem] text-right">
              {match.goals?.away ?? 0}
            </div>
          </div>
        </div>

        {/* Quick Stats Preview */}
        {match.statistics && match.statistics.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
            <StatBox
              label="Possession"
              value={(() => {
                const val = getStatValue(match.statistics, 'possession');
                return val === '—' ? val : `${val}%`;
              })()}
            />
            <StatBox
              label="Shots"
              value={getStatValue(match.statistics, 'shots')}
            />
            <StatBox
              label="Corners"
              value={getStatValue(match.statistics, 'corner')}
            />
          </div>
        )}

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

interface TeamFormBadgeProps {
  form: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
  };
}

function TeamFormBadge({ form }: TeamFormBadgeProps) {
  if (!form || form.played === 0) return null;

  const formColor = form.winRate >= 60 ? 'text-accent-green' : form.winRate >= 40 ? 'text-accent-yellow' : 'text-accent-red';

  return (
    <div className={`text-xs font-semibold mt-1 ${formColor}`}>
      <BarChart3 className="w-3 h-3 inline mr-1" />
      {form.wins}W {form.draws}D {form.losses}L • {form.goalsFor}:{form.goalsAgainst}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-glass-light/50">
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <div className="font-bold text-accent-cyan">{value}</div>
    </div>
  );
}
