'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { MatchStatistics } from '@/lib/api-football';
import { MatchOdds, formatOdds, getImpliedProbability } from '@/lib/odds-provider';

interface MatchStatsDisplayProps {
  matchStats?: MatchStatistics[];
  matchOdds?: MatchOdds;
  homeTeam: string;
  awayTeam: string;
}

export default function MatchStatsDisplay({
  matchStats,
  matchOdds,
  homeTeam,
  awayTeam,
}: MatchStatsDisplayProps) {
  const homeStats = matchStats?.find((s) => s.team.name === homeTeam);
  const awayStats = matchStats?.find((s) => s.team.name === awayTeam);

  // Helper to get stat value
  const getStatValue = (stats: MatchStatistics | undefined, statType: string): string => {
    if (!stats) return '-';
    const stat = stats.statistics.find((s) => s.type === statType);
    return stat ? String(stat.value) : '-';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* ODDS SECTION */}
      {matchOdds && matchOdds.bookmakers && (
        <div className="glass-card p-4 border-l-4 border-accent-amber">
          <h3 className="font-bold text-accent-amber mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Live Odds (1X2)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {/* Home Win */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-br from-accent-green/10 to-green-900/5 rounded-lg p-3 border border-accent-green/30 text-center cursor-pointer hover:border-accent-green/60 transition"
            >
              <div className="text-xs text-text-muted mb-1">{homeTeam} Win</div>
              <div className="text-xl font-bold text-accent-green">
                {formatOdds(matchOdds.bookmakers.home_win)}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {getImpliedProbability(matchOdds.bookmakers.home_win)}%
              </div>
            </motion.div>

            {/* Draw */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-br from-accent-purple/10 to-purple-900/5 rounded-lg p-3 border border-accent-purple/30 text-center cursor-pointer hover:border-accent-purple/60 transition"
            >
              <div className="text-xs text-text-muted mb-1">Draw</div>
              <div className="text-xl font-bold text-accent-purple">
                {formatOdds(matchOdds.bookmakers.draw)}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {getImpliedProbability(matchOdds.bookmakers.draw)}%
              </div>
            </motion.div>

            {/* Away Win */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-br from-accent-blue/10 to-blue-900/5 rounded-lg p-3 border border-accent-blue/30 text-center cursor-pointer hover:border-accent-blue/60 transition"
            >
              <div className="text-xs text-text-muted mb-1">{awayTeam} Win</div>
              <div className="text-xl font-bold text-accent-blue">
                {formatOdds(matchOdds.bookmakers.away_win)}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {getImpliedProbability(matchOdds.bookmakers.away_win)}%
              </div>
            </motion.div>
          </div>

          {/* Over/Under */}
          {(matchOdds.bookmakers.over_2_5 || matchOdds.bookmakers.under_2_5) && (
            <div className="mt-3 pt-3 border-t border-glass-lighter">
              <div className="text-xs text-text-muted mb-2 font-semibold">Over/Under 2.5 Goals</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-glass-light rounded p-2 text-center">
                  <div className="text-sm font-bold text-accent-cyan">
                    {formatOdds(matchOdds.bookmakers.over_2_5)}
                  </div>
                  <div className="text-xs text-text-muted">Over 2.5</div>
                </div>
                <div className="bg-glass-light rounded p-2 text-center">
                  <div className="text-sm font-bold text-accent-cyan">
                    {formatOdds(matchOdds.bookmakers.under_2_5)}
                  </div>
                  <div className="text-xs text-text-muted">Under 2.5</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATISTICS SECTION */}
      {(homeStats || awayStats) && (
        <div className="glass-card p-4 border-l-4 border-accent-cyan">
          <h3 className="font-bold text-accent-cyan mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Match Statistics
          </h3>

          <div className="space-y-3">
            {/* Possession */}
            <StatBar
              label="Possession"
              homeValue={getStatValue(homeStats, 'Possession')}
              awayValue={getStatValue(awayStats, 'Possession')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              unit="%"
            />

            {/* Shots on Target */}
            <StatBar
              label="Shots on Target"
              homeValue={getStatValue(homeStats, 'Shots on Goal')}
              awayValue={getStatValue(awayStats, 'Shots on Goal')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />

            {/* Shots */}
            <StatBar
              label="Total Shots"
              homeValue={getStatValue(homeStats, 'Total Shots')}
              awayValue={getStatValue(awayStats, 'Total Shots')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />

            {/* Corners */}
            <StatBar
              label="Corners"
              homeValue={getStatValue(homeStats, 'Corner Kicks')}
              awayValue={getStatValue(awayStats, 'Corner Kicks')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />

            {/* Fouls */}
            <StatBar
              label="Fouls"
              homeValue={getStatValue(homeStats, 'Fouls')}
              awayValue={getStatValue(awayStats, 'Fouls')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />

            {/* Yellow Cards */}
            <StatBar
              label="Yellow Cards"
              homeValue={getStatValue(homeStats, 'Yellow Cards')}
              awayValue={getStatValue(awayStats, 'Yellow Cards')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              color="amber"
            />

            {/* Red Cards */}
            <StatBar
              label="Red Cards"
              homeValue={getStatValue(homeStats, 'Red Cards')}
              awayValue={getStatValue(awayStats, 'Red Cards')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              color="red"
            />

            {/* Passes */}
            <StatBar
              label="Passes"
              homeValue={getStatValue(homeStats, 'Passes')}
              awayValue={getStatValue(awayStats, 'Passes')}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!matchStats && !matchOdds && (
        <div className="glass-card p-4 text-center text-text-muted">
          <p className="text-sm">Statistics and odds loading...</p>
        </div>
      )}
    </motion.div>
  );
}

interface StatBarProps {
  label: string;
  homeValue: string | number;
  awayValue: string | number;
  homeTeam: string;
  awayTeam: string;
  unit?: string;
  color?: 'cyan' | 'green' | 'amber' | 'red';
}

function StatBar({
  label,
  homeValue,
  awayValue,
  homeTeam,
  awayTeam,
  unit = '',
  color = 'cyan',
}: StatBarProps) {
  const homeNum = typeof homeValue === 'string' ? parseInt(homeValue) : homeValue;
  const awayNum = typeof awayValue === 'string' ? parseInt(awayValue) : awayValue;
  const total = homeNum + awayNum;
  const homePercent = total > 0 ? Math.round((homeNum / total) * 100) : 50;
  const awayPercent = 100 - homePercent;

  const homeColorClass = {
    cyan: 'from-accent-cyan to-accent-blue',
    green: 'from-accent-green to-emerald-600',
    amber: 'from-accent-amber to-orange-600',
    red: 'from-accent-red to-rose-600',
  }[color];

  // Away team uses a vibrant magenta/pink color that contrasts well with turquoise
  const awayColorClass = 'from-accent-magenta to-pink-600';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-text-secondary">{homeTeam}</span>
        <span className="font-bold text-text-primary">{label}</span>
        <span className="font-semibold text-text-secondary">{awayTeam}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold text-text-primary flex-shrink-0 w-8 text-right">
          {homeValue}
          {unit}
        </div>
        <div className="flex-1 h-2 bg-glass-light rounded-full overflow-hidden flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${homePercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${homeColorClass}`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${awayPercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${awayColorClass}`}
          />
        </div>
        <div className="text-xs font-bold text-text-primary flex-shrink-0 w-8">
          {awayValue}
          {unit}
        </div>
      </div>
    </div>
  );
}