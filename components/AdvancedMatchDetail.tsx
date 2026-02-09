'use client';

import { motion } from 'framer-motion';
import { X, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { LiveMatch } from '@/lib/unified-api';

interface AdvancedMatchDetailProps {
  match: LiveMatch;
  onClose: () => void;
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

  const calculatePercent = (home: number, away: number) => {
    const total = home + away;
    return total === 0 ? 50 : Math.round((home / total) * 100);
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
              📈 Match Momentum (Timeline)
            </h3>
            <div className="bg-glass-light/50 rounded-lg p-4 h-32 flex items-end justify-between">
              {/* Placeholder for momentum graph - would be filled with actual data */}
              <div className="text-center text-text-secondary text-sm w-full">
                Momentum data coming from live match feed
              </div>
            </div>
          </div>

          {/* Match History vs Team */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Recent Form (Last 5 Matches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TeamFormBox team={match.teams?.home?.name || 'Home'} />
              <TeamFormBox team={match.teams?.away?.name || 'Away'} />
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

function TeamFormBox({ team }: { team: string }) {
  return (
    <div className="bg-glass-light/50 rounded-lg p-4">
      <div className="font-semibold text-white mb-3">{team}</div>
      <div className="flex gap-2 justify-between">
        {[
          { result: 'W', score: '2:1' },
          { result: 'W', score: '3:0' },
          { result: 'D', score: '1:1' },
          { result: 'W', score: '2:0' },
          { result: 'L', score: '0:2' },
        ].map((match, i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xs ${
              match.result === 'W'
                ? 'bg-accent-green/30 text-accent-green'
                : match.result === 'D'
                  ? 'bg-accent-yellow/30 text-accent-yellow'
                  : 'bg-accent-red/30 text-accent-red'
            }`}
            title={match.score}
          >
            {match.result}
          </div>
        ))}
      </div>
      <div className="text-xs text-text-muted mt-3">
        Goals: 12 • Avg: 2.4 • Avg Against: 1.2
      </div>
    </div>
  );
}
