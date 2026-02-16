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

/**
 * Extract stat value from match.statistics array
 */
function getStat(match: LiveMatch, teamName: string | undefined, statType: string): number {
  if (!match.statistics || !teamName) return 0;
  const teamStats = match.statistics.find(s => s.team?.name === teamName);
  if (!teamStats) return 0;
  const stat = teamStats.statistics.find((s: any) =>
    s.type.toLowerCase().includes(statType.toLowerCase())
  );
  if (!stat) return 0;
  if (typeof stat.value === 'string') return parseInt(stat.value.replace('%', '')) || 0;
  return stat.value || 0;
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
    match.fixture.status.short === 'HT' ||
    match.fixture.status.short === 'ET' ||
    match.fixture.status.short === 'P';

  const isFinished = match.fixture.status.short === 'FT' || match.fixture.status.short === 'AET' || match.fixture.status.short === 'PEN';
  const minute = match.fixture.status.elapsed || 0;

  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';
  const homeGoals = match.goals?.home ?? 0;
  const awayGoals = match.goals?.away ?? 0;

  // Extract key stats for inline display
  const hasStats = match.statistics && match.statistics.length > 0;
  const possession = { home: getStat(match, homeName, 'possession'), away: getStat(match, awayName, 'possession') };
  const shotsOn = { home: getStat(match, homeName, 'shots on goal'), away: getStat(match, awayName, 'shots on goal') };
  const shotsOff = { home: getStat(match, homeName, 'shots off goal'), away: getStat(match, awayName, 'shots off goal') };
  const corners = { home: getStat(match, homeName, 'corner'), away: getStat(match, awayName, 'corner') };
  const attacks = { home: getStat(match, homeName, 'attacks'), away: getStat(match, awayName, 'attacks') };
  const dangerousAttacks = { home: getStat(match, homeName, 'dangerous'), away: getStat(match, awayName, 'dangerous') };
  const yellowCards = { home: getStat(match, homeName, 'yellow'), away: getStat(match, awayName, 'yellow') };
  const redCards = { home: getStat(match, homeName, 'red'), away: getStat(match, awayName, 'red') };

  return (
    <motion.div
      onClick={onClick}
      className={`rounded-xl p-4 cursor-pointer transition-all border bg-[rgba(15,23,42,0.95)] ${
        isLive ? 'border-accent-red/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]' : 'border-white/10 hover:border-accent-cyan/40'
      }`}
    >
      {/* Header: League + Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
          {match.league?.name || 'Unknown'}
        </span>
        {isLive ? (
          <span className="px-2 py-0.5 rounded-full bg-accent-red/20 text-[10px] font-bold text-accent-red flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
            {minute}&apos;
          </span>
        ) : isFinished ? (
          <span className="text-[10px] font-bold text-text-muted">FT</span>
        ) : (
          <span className="text-[10px] text-text-muted">{match.fixture?.status?.long || 'Scheduled'}</span>
        )}
      </div>

      {/* Score Section - centered like LivePick */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-right">
          <span className="font-semibold text-sm text-white truncate block">{homeName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-2xl font-bold tabular-nums ${isLive ? 'text-accent-cyan' : 'text-white'}`}>
            {homeGoals}
          </span>
          <span className="text-lg text-text-muted">-</span>
          <span className={`text-2xl font-bold tabular-nums ${isLive ? 'text-accent-cyan' : 'text-white'}`}>
            {awayGoals}
          </span>
        </div>
        <div className="flex-1">
          <span className="font-semibold text-sm text-white truncate block">{awayName}</span>
        </div>
      </div>

      {/* Inline Stats - only show when match has statistics data */}
      {hasStats && (isLive || isFinished) && (
        <div className="border-t border-white/8 pt-3 space-y-2">
          {/* Circular stats row: Attacks, Dangerous Attacks, Possession */}
          {(possession.home > 0 || attacks.home > 0 || dangerousAttacks.home > 0) && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {attacks.home + attacks.away > 0 && (
                <CircleStat label="Attacks" home={attacks.home} away={attacks.away} />
              )}
              {dangerousAttacks.home + dangerousAttacks.away > 0 && (
                <CircleStat label="Dangerous" home={dangerousAttacks.home} away={dangerousAttacks.away} />
              )}
              {possession.home + possession.away > 0 && (
                <CircleStat label="Possession" home={possession.home} away={possession.away} unit="%" />
              )}
            </div>
          )}

          {/* Horizontal bars: On Target, Off Target */}
          {(shotsOn.home + shotsOn.away > 0 || shotsOff.home + shotsOff.away > 0) && (
            <div className="space-y-1.5">
              {shotsOn.home + shotsOn.away > 0 && (
                <CompactBar label="On Target" home={shotsOn.home} away={shotsOn.away} />
              )}
              {shotsOff.home + shotsOff.away > 0 && (
                <CompactBar label="Off Target" home={shotsOff.home} away={shotsOff.away} />
              )}
            </div>
          )}

          {/* Bottom row: Corners + Cards */}
          {(corners.home + corners.away > 0 || yellowCards.home + yellowCards.away > 0 || redCards.home + redCards.away > 0) && (
            <div className="flex items-center justify-between pt-1 text-[10px]">
              {corners.home + corners.away > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-text-muted">CRN</span>
                  <span className="font-bold text-accent-cyan">{corners.home}</span>
                  <span className="text-text-muted">-</span>
                  <span className="font-bold text-accent-blue">{corners.away}</span>
                </div>
              )}
              {yellowCards.home + yellowCards.away > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-3 rounded-[1px] bg-yellow-400 inline-block" />
                  <span className="font-bold text-white">{yellowCards.home}</span>
                  <span className="text-text-muted">-</span>
                  <span className="font-bold text-white">{yellowCards.away}</span>
                </div>
              )}
              {redCards.home + redCards.away > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-3 rounded-[1px] bg-red-500 inline-block" />
                  <span className="font-bold text-white">{redCards.home}</span>
                  <span className="text-text-muted">-</span>
                  <span className="font-bold text-white">{redCards.away}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter Results */}
      {showStatistics && filterResults && filterResults.length > 0 && (
        <div className="border-t border-white/8 pt-2 mt-2">
          <div className="flex items-center gap-1 text-xs text-accent-cyan">
            <Target className="w-3 h-3" />
            <span>{filterResults.length} filter match(es)</span>
          </div>
        </div>
      )}

      {/* Live Odds Display */}
      {odds && odds.bookmakers && (
        <div className="border-t border-white/8 pt-3 mt-2">
          <div className="flex items-center gap-1 mb-2 text-[10px] font-semibold text-accent-amber">
            <TrendingUp className="w-3 h-3" />
            1X2
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <div className="text-center px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <div className="font-bold text-accent-green">{formatOdds(odds.bookmakers.home_win)}</div>
              <div className="text-[9px] text-text-muted">1</div>
            </div>
            <div className="text-center px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <div className="font-bold text-accent-yellow">{formatOdds(odds.bookmakers.draw)}</div>
              <div className="text-[9px] text-text-muted">X</div>
            </div>
            <div className="text-center px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <div className="font-bold text-accent-blue">{formatOdds(odds.bookmakers.away_win)}</div>
              <div className="text-[9px] text-text-muted">2</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Circular stat comparison widget (like LivePick) */
function CircleStat({ label, home, away, unit = '' }: { label: string; home: number; away: number; unit?: string }) {
  const total = home + away;
  const homePercent = total === 0 ? 50 : Math.round((home / total) * 100);
  // SVG circle: stroke-dasharray trick for the arc
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const homeArc = (homePercent / 100) * circumference;
  const awayArc = circumference - homeArc;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
          {/* Away arc (blue) */}
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="3.5"
            strokeDasharray={`${awayArc} ${circumference}`} strokeDashoffset={`-${homeArc}`} />
          {/* Home arc (cyan) */}
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(34,211,238,0.9)" strokeWidth="3.5"
            strokeDasharray={`${homeArc} ${circumference}`} />
        </svg>
        {/* Center values */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[8px] font-bold leading-none text-center">
            <span className="text-accent-cyan">{home}</span>
            <span className="text-text-muted mx-0.5">:</span>
            <span className="text-accent-blue">{away}</span>
          </div>
        </div>
      </div>
      <span className="text-[9px] text-text-muted mt-0.5 leading-tight">{label}{unit && ` ${unit}`}</span>
    </div>
  );
}

/** Compact horizontal comparison bar */
function CompactBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homePercent = total === 0 ? 50 : Math.round((home / total) * 100);
  const homeLeads = home > away;
  const awayLeads = away > home;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className={`w-5 text-right font-bold ${homeLeads ? 'text-accent-cyan' : 'text-text-secondary'}`}>{home}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
        <div className={`h-full rounded-l-full transition-all ${homeLeads ? 'bg-accent-cyan' : 'bg-accent-cyan/40'}`}
          style={{ width: `${homePercent}%` }} />
        <div className={`h-full rounded-r-full transition-all ${awayLeads ? 'bg-accent-blue' : 'bg-accent-blue/40'}`}
          style={{ width: `${100 - homePercent}%` }} />
      </div>
      <span className={`w-5 text-left font-bold ${awayLeads ? 'text-accent-blue' : 'text-text-secondary'}`}>{away}</span>
      <span className="text-text-muted w-[52px] text-[9px] truncate">{label}</span>
    </div>
  );
}

export default memo(MatchCard);
