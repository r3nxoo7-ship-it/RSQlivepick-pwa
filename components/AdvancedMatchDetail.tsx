'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { LiveMatch } from '@/lib/unified-api';

interface AdvancedMatchDetailProps {
  match: LiveMatch;
  onClose: () => void;
}

interface RecentMatchData {
  date: string;
  league: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  home_corners: number | null;
  away_corners: number | null;
  home_shots_on_target: number | null;
  away_shots_on_target: number | null;
  home_possession: number | null;
  away_possession: number | null;
  home_yellow_cards: number | null;
  away_yellow_cards: number | null;
  home_red_cards: number | null;
  away_red_cards: number | null;
}

interface TeamFormData {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
}

interface TeamRecentFormResult {
  teamId: string;
  matches: RecentMatchData[];
  form: TeamFormData;
}

/**
 * Helper: Extract stat value from match.statistics array
 */
function getStatValue(
  stats: any[] | undefined,
  teamName: string | undefined,
  statType: string
): number {
  if (!stats || !teamName) return 0;

  const teamStats = stats.find(s => s.team?.name === teamName);
  if (!teamStats) return 0;

  const stat = teamStats.statistics.find((s: any) =>
    s.type.toLowerCase() === statType.toLowerCase() ||
    s.type.toLowerCase().includes(statType.toLowerCase())
  );

  if (!stat) return 0;

  // Handle percentage strings (e.g., "58%") and numeric values
  if (typeof stat.value === 'string') {
    return parseInt(stat.value.replace('%', '')) || 0;
  }
  return stat.value || 0;
}

/**
 * Calculate goals in first half from halftime score
 */
function getFirstHalfGoals(match: LiveMatch, team: 'home' | 'away'): number {
  return match.score?.halftime?.[team] || 0;
}

/**
 * Calculate goals in second half
 */
function getSecondHalfGoals(match: LiveMatch, team: 'home' | 'away'): number {
  const fulltime = match.goals?.[team] || 0;
  const halftime = match.score?.halftime?.[team] || 0;
  return Math.max(0, fulltime - halftime);
}

export default function AdvancedMatchDetail({ match, onClose }: AdvancedMatchDetailProps) {
  const [homeForm, setHomeForm] = useState<TeamRecentFormResult | null>(null);
  const [awayForm, setAwayForm] = useState<TeamRecentFormResult | null>(null);
  const [formLoading, setFormLoading] = useState(true);

  useEffect(() => {
    async function fetchForm() {
      setFormLoading(true);
      try {
        const homeId = match.teams?.home?.id;
        const awayId = match.teams?.away?.id;

        const [homeRes, awayRes] = await Promise.all([
          homeId ? fetch(`/api/espn/team-form?teamId=${homeId}`).then(r => r.ok ? r.json() : null) : null,
          awayId ? fetch(`/api/espn/team-form?teamId=${awayId}`).then(r => r.ok ? r.json() : null) : null,
        ]);

        setHomeForm(homeRes);
        setAwayForm(awayRes);
      } catch (err) {
        console.error('Error fetching team form:', err);
      } finally {
        setFormLoading(false);
      }
    }
    fetchForm();
  }, [match.teams?.home?.id, match.teams?.away?.id]);

  // Extract statistics from match.statistics array if available
  const homeStats = {
    goals: match.goals?.home || 0,
    shotsOnTarget: getStatValue(match.statistics, match.teams?.home?.name, 'shots on goal'),
    shotsOffTarget: getStatValue(match.statistics, match.teams?.home?.name, 'shots off goal'),
    corners: getStatValue(match.statistics, match.teams?.home?.name, 'corners'),
    possession: getStatValue(match.statistics, match.teams?.home?.name, 'possession'),
    yellowCards: getStatValue(match.statistics, match.teams?.home?.name, 'yellow card'),
    redCards: getStatValue(match.statistics, match.teams?.home?.name, 'red card'),
    attacks: getStatValue(match.statistics, match.teams?.home?.name, 'attacks'),
    dangerousAttacks: getStatValue(match.statistics, match.teams?.home?.name, 'dangerous attacks'),
    fouls: getStatValue(match.statistics, match.teams?.home?.name, 'fouls'),
    firstHalf: getFirstHalfGoals(match, 'home'),
    secondHalf: getSecondHalfGoals(match, 'home'),
  };

  const awayStats = {
    goals: match.goals?.away || 0,
    shotsOnTarget: getStatValue(match.statistics, match.teams?.away?.name, 'shots on goal'),
    shotsOffTarget: getStatValue(match.statistics, match.teams?.away?.name, 'shots off goal'),
    corners: getStatValue(match.statistics, match.teams?.away?.name, 'corners'),
    possession: getStatValue(match.statistics, match.teams?.away?.name, 'possession'),
    yellowCards: getStatValue(match.statistics, match.teams?.away?.name, 'yellow card'),
    redCards: getStatValue(match.statistics, match.teams?.away?.name, 'red card'),
    attacks: getStatValue(match.statistics, match.teams?.away?.name, 'attacks'),
    dangerousAttacks: getStatValue(match.statistics, match.teams?.away?.name, 'dangerous attacks'),
    fouls: getStatValue(match.statistics, match.teams?.away?.name, 'fouls'),
    firstHalf: getFirstHalfGoals(match, 'away'),
    secondHalf: getSecondHalfGoals(match, 'away'),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        className="glass-card rounded-2xl border border-accent-cyan/30 bg-background w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-background to-background/80 backdrop-blur-md border-b border-accent-cyan/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {match.teams?.home?.name} vs {match.teams?.away?.name}
              </h2>
              <p className="text-sm text-text-secondary mt-1">{match.league?.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-glass-light transition text-text-secondary hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Match Score & Time */}
          <div className="flex items-center justify-between">
            <div className="text-4xl font-bold text-accent-cyan">
              {homeStats.goals} - {awayStats.goals}
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-text-secondary">
                {match.fixture?.status?.elapsed || 0}&apos;
              </div>
              <div className="text-xs text-text-muted">
                {match.fixture?.status?.long || 'In Progress'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Live Statistics */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-accent-cyan" />
              <h3 className="text-lg font-bold text-white">Live Statistics</h3>
            </div>

            <StatRow
              label="Possession"
              home={homeStats.possession}
              away={awayStats.possession}
              unit="%"
              compare={true}
            />

            <StatRow
              label="Shots on Target"
              home={homeStats.shotsOnTarget}
              away={awayStats.shotsOnTarget}
              compare={true}
            />

            <StatRow
              label="Shots Off Target"
              home={homeStats.shotsOffTarget}
              away={awayStats.shotsOffTarget}
              compare={true}
            />

            <StatRow
              label="Total Shots"
              home={homeStats.shotsOnTarget + homeStats.shotsOffTarget}
              away={awayStats.shotsOnTarget + awayStats.shotsOffTarget}
              compare={true}
            />

            <StatRow
              label="Attacks"
              home={homeStats.attacks}
              away={awayStats.attacks}
              compare={true}
            />

            <StatRow
              label="Dangerous Attacks"
              home={homeStats.dangerousAttacks}
              away={awayStats.dangerousAttacks}
              compare={true}
            />

            <StatRow
              label="Corners"
              home={homeStats.corners}
              away={awayStats.corners}
              compare={true}
            />

            <StatRow
              label="Yellow Cards"
              home={homeStats.yellowCards}
              away={awayStats.yellowCards}
              compare={true}
            />

            <StatRow
              label="Red Cards"
              home={homeStats.redCards}
              away={awayStats.redCards}
              compare={false}
            />
          </div>

          {/* Odds Section */}
          {(match as any).odds && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-accent-blue" />
                <h3 className="text-lg font-bold text-white">Betting Odds</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <OddBox
                  label={`${match.teams?.home?.name || 'Home'} Win`}
                  odd={(match as any).odds.homeWin?.toFixed(2) || 'N/A'}
                />
                <OddBox label="Draw" odd={(match as any).odds.draw?.toFixed(2) || 'N/A'} />
                <OddBox
                  label={`${match.teams?.away?.name || 'Away'} Win`}
                  odd={(match as any).odds.awayWin?.toFixed(2) || 'N/A'}
                />
              </div>
            </div>
          )}

          {/* Time Windows Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-accent-amber" />
              <h3 className="text-lg font-bold text-white">Goals in Time Windows</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TimeWindowStat label="First Half Goals" home={homeStats.firstHalf} away={awayStats.firstHalf} />
              <TimeWindowStat label="Second Half Goals" home={homeStats.secondHalf} away={awayStats.secondHalf} />
              <TimeWindowStat label="Last 5 Minutes" home={0} away={0} disabled={true} />
              <TimeWindowStat label="Last 10 Minutes" home={0} away={0} disabled={true} />
              <TimeWindowStat label="Last 15 Minutes" home={0} away={0} disabled={true} />
              <TimeWindowStat label="Last 20 Minutes" home={0} away={0} disabled={true} />
            </div>
          </div>

          {/* Momentum Chart */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Match Momentum (Timeline)
            </h3>
            <div className="bg-glass-light/50 rounded-lg p-4 h-32 flex items-end justify-between">
              <div className="text-center text-text-secondary text-sm w-full">
                Momentum data coming from live match feed
              </div>
            </div>
          </div>

          {/* Recent Form (Last 5 Matches) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Recent Form (Last 5 Matches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TeamFormBox
                team={match.teams?.home?.name || 'Home'}
                teamId={String(match.teams?.home?.id || '')}
                recentData={homeForm}
                loading={formLoading}
              />
              <TeamFormBox
                team={match.teams?.away?.name || 'Away'}
                teamId={String(match.teams?.away?.id || '')}
                recentData={awayForm}
                loading={formLoading}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatRow({
  label,
  home,
  away,
  unit = '',
  compare = false,
}: {
  label: string;
  home: number;
  away: number;
  unit?: string;
  compare?: boolean;
}) {
  const total = home + away;
  const homePercent = total === 0 ? 50 : Math.round((home / total) * 100);
  const awayPercent = 100 - homePercent;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        {compare && <span className="text-xs text-text-muted">100% comparison</span>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-accent-cyan">{home}</div>
          <div className="text-xs text-text-muted">Home {unit}</div>
        </div>

        <div className="flex items-center">
          <div className="flex-1 h-2 bg-gradient-to-r from-accent-cyan to-transparent rounded-l" style={{ width: `${homePercent}%` }} />
          <div className="flex-1 h-2 bg-gradient-to-l from-accent-blue to-transparent rounded-r" style={{ width: `${awayPercent}%` }} />
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-accent-blue">{away}</div>
          <div className="text-xs text-text-muted">Away {unit}</div>
        </div>
      </div>

      {compare && (
        <div className="flex justify-between text-xs text-text-muted px-2">
          <span>{homePercent}%</span>
          <span>{awayPercent}%</span>
        </div>
      )}
    </motion.div>
  );
}

function OddBox({ label, odd }: { label: string; odd: string }) {
  return (
    <div className="bg-glass-light rounded-lg p-4 text-center">
      <div className="text-xs text-text-muted mb-2">{label}</div>
      <div className="text-2xl font-bold text-accent-cyan">{odd}</div>
    </div>
  );
}

function TimeWindowStat({ label, home, away, disabled = false }: { label: string; home: number; away: number; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="bg-glass-light/50 rounded-lg p-3 opacity-50">
        <div className="text-xs text-text-muted mb-2">{label}</div>
        <div className="flex items-center justify-center h-8">
          <div className="text-xs text-text-muted">Coming soon</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-glass-light/50 rounded-lg p-3">
      <div className="text-xs text-text-muted mb-2">{label}</div>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-accent-cyan">{home}</div>
        <div className="text-xs text-text-secondary">-</div>
        <div className="text-lg font-bold text-accent-blue">{away}</div>
      </div>
    </div>
  );
}

/**
 * Determine match result relative to the team
 */
function getMatchResult(match: RecentMatchData, teamId: string): 'W' | 'D' | 'L' {
  const isHome = match.home_team_id === teamId;
  const teamScore = isHome ? match.home_score : match.away_score;
  const opponentScore = isHome ? match.away_score : match.home_score;
  if (teamScore > opponentScore) return 'W';
  if (teamScore === opponentScore) return 'D';
  return 'L';
}

/**
 * Get opponent name for a match
 */
function getOpponent(match: RecentMatchData, teamId: string): string {
  const isHome = match.home_team_id === teamId;
  const opponent = isHome ? match.away_team_name : match.home_team_name;
  // Abbreviate long names
  if (opponent.length > 14) {
    return opponent.substring(0, 12) + '..';
  }
  return opponent;
}

/**
 * Get team's stats from a match
 */
function getTeamMatchStats(match: RecentMatchData, teamId: string) {
  const isHome = match.home_team_id === teamId;
  return {
    goalsFor: isHome ? match.home_score : match.away_score,
    goalsAgainst: isHome ? match.away_score : match.home_score,
    corners: isHome ? (match.home_corners ?? null) : (match.away_corners ?? null),
    shotsOnTarget: isHome ? (match.home_shots_on_target ?? null) : (match.away_shots_on_target ?? null),
    possession: isHome ? (match.home_possession ?? null) : (match.away_possession ?? null),
    yellowCards: isHome ? (match.home_yellow_cards ?? null) : (match.away_yellow_cards ?? null),
    redCards: isHome ? (match.home_red_cards ?? null) : (match.away_red_cards ?? null),
    venue: isHome ? 'H' : 'A',
  };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

function TeamFormBox({
  team,
  teamId,
  recentData,
  loading,
}: {
  team: string;
  teamId: string;
  recentData: TeamRecentFormResult | null;
  loading: boolean;
}) {
  // Loading state
  if (loading) {
    return (
      <div className="bg-glass-light/50 rounded-lg p-4 animate-pulse">
        <div className="font-semibold text-white mb-3">{team}</div>
        <div className="space-y-2">
          <div className="h-8 bg-glass-light rounded" />
          <div className="h-6 bg-glass-light rounded w-3/4" />
          <div className="h-6 bg-glass-light rounded w-1/2" />
        </div>
      </div>
    );
  }

  // No data
  if (!recentData || !recentData.matches || recentData.matches.length === 0) {
    return (
      <div className="bg-glass-light/50 rounded-lg p-4">
        <div className="font-semibold text-white mb-3">{team}</div>
        <div className="text-xs text-text-muted">No recent match data available</div>
      </div>
    );
  }

  const { matches, form } = recentData;
  const avgGoalsFor = form.played > 0 ? (form.goalsFor / form.played).toFixed(1) : '0';
  const avgGoalsAgainst = form.played > 0 ? (form.goalsAgainst / form.played).toFixed(1) : '0';

  return (
    <div className="bg-glass-light/50 rounded-lg p-4">
      {/* Team name + form summary badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-white">{team}</div>
        <div className="flex items-center gap-1.5">
          {matches.slice(0, 5).map((m, i) => {
            const result = getMatchResult(m, teamId);
            return (
              <div
                key={i}
                className={`w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] ${
                  result === 'W'
                    ? 'bg-accent-green/30 text-accent-green'
                    : result === 'D'
                      ? 'bg-accent-yellow/30 text-accent-yellow'
                      : 'bg-accent-red/30 text-accent-red'
                }`}
                title={`${m.home_team_name} ${m.home_score}:${m.away_score} ${m.away_team_name}`}
              >
                {result}
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-match detail rows */}
      <div className="space-y-1.5 mb-3">
        {matches.slice(0, 5).map((m, i) => {
          const result = getMatchResult(m, teamId);
          const stats = getTeamMatchStats(m, teamId);
          const opponent = getOpponent(m, teamId);

          return (
            <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-white/5 last:border-0">
              {/* Date */}
              <span className="text-text-muted w-[52px] shrink-0">{formatDate(m.date)}</span>

              {/* Venue badge */}
              <span className={`w-4 text-center font-bold shrink-0 ${
                stats.venue === 'H' ? 'text-accent-green' : 'text-accent-cyan'
              }`}>
                {stats.venue}
              </span>

              {/* Opponent */}
              <span className="text-text-secondary truncate flex-1 min-w-0" title={m.home_team_id === teamId ? m.away_team_name : m.home_team_name}>
                {opponent}
              </span>

              {/* Score */}
              <span className={`font-bold shrink-0 ${
                result === 'W' ? 'text-accent-green' : result === 'D' ? 'text-accent-yellow' : 'text-accent-red'
              }`}>
                {stats.goalsFor}:{stats.goalsAgainst}
              </span>

              {/* Mini stats */}
              <div className="flex items-center gap-1.5 text-text-muted shrink-0">
                {stats.corners !== null && (
                  <span title="Corners">C:{stats.corners}</span>
                )}
                {stats.shotsOnTarget !== null && (
                  <span title="Shots on Target">S:{stats.shotsOnTarget}</span>
                )}
                {stats.yellowCards !== null && stats.yellowCards > 0 && (
                  <span title="Yellow Cards" className="text-accent-yellow">Y:{stats.yellowCards}</span>
                )}
                {stats.possession !== null && (
                  <span title="Possession">{stats.possession}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aggregate stats footer */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] pt-2 border-t border-white/10">
        <span className="text-text-secondary">
          <span className="text-accent-green font-bold">W{form.wins}</span>{' '}
          <span className="text-accent-yellow font-bold">D{form.draws}</span>{' '}
          <span className="text-accent-red font-bold">L{form.losses}</span>
        </span>
        <span className="text-text-muted">
          GF:{form.goalsFor} GA:{form.goalsAgainst} GD:{form.goalDifference >= 0 ? '+' : ''}{form.goalDifference}
        </span>
        <span className="text-text-muted">
          Avg: {avgGoalsFor} / {avgGoalsAgainst}
        </span>
        <span className={`font-bold ${
          form.winRate >= 60 ? 'text-accent-green' : form.winRate >= 40 ? 'text-accent-yellow' : 'text-accent-red'
        }`}>
          {form.winRate}% WR
        </span>
      </div>
    </div>
  );
}
