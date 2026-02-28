'use client';

import { motion } from 'framer-motion';
import { Target, TrendingUp, Clock } from 'lucide-react';
import type { LiveMatch } from '@/lib/types';
import { FilterMatchResult } from '@/lib/filter-engine';
import { MatchOdds, formatOdds } from '@/lib/odds-provider';
import { memo } from 'react';

interface TeamFormData {
  wins: number;
  draws: number;
  losses: number;
  played: number;
}

interface MatchCardProps {
  match: LiveMatch;
  onClick?: () => void;
  showStatistics?: boolean;
  filterResults?: FilterMatchResult[];
  odds?: MatchOdds;
  homeForm?: TeamFormData;
  awayForm?: TeamFormData;
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
  homeForm,
  awayForm,
}: MatchCardProps) {
  const isLive =
    match.fixture.status.short === 'LIVE' ||
    match.fixture.status.short === '1H' ||
    match.fixture.status.short === '2H' ||
    match.fixture.status.short === 'HT' ||
    match.fixture.status.short === 'ET' ||
    match.fixture.status.short === 'P';

  const isFinished = match.fixture.status.short === 'FT' || match.fixture.status.short === 'AET' || match.fixture.status.short === 'PEN';
  const isUpcoming = !isLive && !isFinished;
  const minute = match.fixture.status.elapsed || 0;

  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';
  const homeGoals = match.goals?.home ?? 0;
  const awayGoals = match.goals?.away ?? 0;

  // Kickoff time for upcoming — show date prefix if not today
  const kickoffTime = (() => {
    if (!match.fixture?.date) return null;
    const d = new Date(match.fixture.date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    const dateStr = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    return `${dateStr} ${timeStr}`;
  })();

  // Extract key stats for inline display
  const ss = match.sofascore_stats;
  const hasStats = (match.statistics && match.statistics.length > 0) || !!ss;
  const possession = { home: getStat(match, homeName, 'possession') || ss?.homePossession || 0, away: getStat(match, awayName, 'possession') || ss?.awayPossession || 0 };
  const shotsOn = { home: getStat(match, homeName, 'shots on goal') || ss?.homeShotsOnTarget || 0, away: getStat(match, awayName, 'shots on goal') || ss?.awayShotsOnTarget || 0 };
  const shotsOff = { home: getStat(match, homeName, 'shots off goal') || ss?.homeShotsOff || 0, away: getStat(match, awayName, 'shots off goal') || ss?.awayShotsOff || 0 };
  const corners = { home: getStat(match, homeName, 'corner') || ss?.homeCorners || 0, away: getStat(match, awayName, 'corner') || ss?.awayCorners || 0 };
  const attacks = { home: getStat(match, homeName, 'attacks'), away: getStat(match, awayName, 'attacks') };
  const dangerousAttacks = { home: getStat(match, homeName, 'dangerous'), away: getStat(match, awayName, 'dangerous') };
  const yellowCards = { home: getStat(match, homeName, 'yellow') || ss?.homeYellowCards || 0, away: getStat(match, awayName, 'yellow') || ss?.awayYellowCards || 0 };
  const redCards = { home: getStat(match, homeName, 'red') || ss?.homeRedCards || 0, away: getStat(match, awayName, 'red') || ss?.awayRedCards || 0 };
  const fouls = { home: getStat(match, homeName, 'fouls') || ss?.homeFouls || 0, away: getStat(match, awayName, 'fouls') || ss?.awayFouls || 0 };
  const offsides = { home: getStat(match, homeName, 'offsides') || ss?.homeOffsides || 0, away: getStat(match, awayName, 'offsides') || ss?.awayOffsides || 0 };
  const xg = ss && (ss.homeXg > 0 || ss.awayXg > 0) ? { home: ss.homeXg, away: ss.awayXg } : null;

  // Odds shortcuts
  const bk = odds?.bookmakers;
  const hasOdds = bk && (bk.home_win || bk.draw || bk.away_win);
  const hasOU25 = bk && (bk.goals_over_2_5 || bk.goals_under_2_5);
  const hasAH = bk && (bk.asian_handicap_home_odd || bk.asian_handicap_away_odd);

  return (
    <motion.div
      onClick={onClick}
      className={`rounded-xl p-4 cursor-pointer transition-all border bg-[rgba(15,23,42,0.95)] ${
        isLive ? 'border-accent-red/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]' : 'border-white/10 hover:border-accent-cyan/40'
      }`}
    >
      {/* Header: League + Status/Time */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide truncate max-w-[70%]">
          {match.league?.name || 'Unknown'}
        </span>
        {isLive ? (
          <span className="px-2 py-0.5 rounded-full bg-accent-red/20 text-[10px] font-bold text-accent-red flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
            {minute}&apos;
          </span>
        ) : isFinished ? (
          <span className="text-[10px] font-bold text-text-muted shrink-0">FT</span>
        ) : kickoffTime ? (
          <span className="flex items-center gap-1 text-[10px] text-accent-cyan/80 shrink-0">
            <Clock className="w-3 h-3" />
            {kickoffTime}
          </span>
        ) : null}
      </div>

      {/* ===== UPCOMING LAYOUT ===== */}
      {isUpcoming ? (
        <>
          {/* Team names + form badges */}
          <div className="flex items-center gap-2 mb-3">
            {/* Home team */}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm text-white truncate block">{homeName}</span>
              {homeForm && homeForm.played > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {homeForm.wins > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-[9px] font-bold text-green-400">{homeForm.wins}W</span>
                  )}
                  {homeForm.draws > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[9px] font-bold text-yellow-400">{homeForm.draws}D</span>
                  )}
                  {homeForm.losses > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[9px] font-bold text-red-400">{homeForm.losses}L</span>
                  )}
                </div>
              )}
            </div>

            {/* VS divider */}
            <span className="text-xs font-bold text-text-muted/60 shrink-0 px-1">vs</span>

            {/* Away team */}
            <div className="flex-1 min-w-0 text-right">
              <span className="font-semibold text-sm text-white truncate block text-right">{awayName}</span>
              {awayForm && awayForm.played > 0 && (
                <div className="flex items-center gap-1 mt-1 justify-end">
                  {awayForm.wins > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-[9px] font-bold text-green-400">{awayForm.wins}W</span>
                  )}
                  {awayForm.draws > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[9px] font-bold text-yellow-400">{awayForm.draws}D</span>
                  )}
                  {awayForm.losses > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[9px] font-bold text-red-400">{awayForm.losses}L</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Odds section for upcoming */}
          {hasOdds && (
            <div className="border-t border-white/8 pt-3 space-y-2.5">
              {/* Bookmaker label */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-accent-amber">
                <TrendingUp className="w-3 h-3" />
                <span>Decimal Odds</span>
              </div>

              {/* 1X2 */}
              <div>
                <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wide">Match Result (1X2)</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <OddsCell label={`1 ${homeName.split(' ')[0]}`} value={bk?.home_win} color="cyan" />
                  <OddsCell label="X Draw" value={bk?.draw} color="yellow" />
                  <OddsCell label={`2 ${awayName.split(' ')[0]}`} value={bk?.away_win} color="blue" />
                </div>
              </div>

              {/* Goals O/U 2.5 */}
              {hasOU25 && (
                <div>
                  <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wide">Goals Over/Under 2.5</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <OddsCell label="Over 2.5" value={bk?.goals_over_2_5} color="green" />
                    <OddsCell label="Under 2.5" value={bk?.goals_under_2_5} color="red" />
                  </div>
                </div>
              )}

              {/* Asian Handicap */}
              {hasAH && (
                <div>
                  <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wide">Asian Handicap</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <OddsCell
                      label={`${homeName.split(' ')[0]} (${bk?.asian_handicap_line !== undefined ? (bk.asian_handicap_line >= 0 ? '+' : '') + bk.asian_handicap_line : '-0.5'})`}
                      value={bk?.asian_handicap_home_odd}
                      color="cyan"
                    />
                    <OddsCell
                      label={`${awayName.split(' ')[0]} (${bk?.asian_handicap_line !== undefined ? ((-bk.asian_handicap_line) >= 0 ? '+' : '') + (-bk.asian_handicap_line) : '+0.5'})`}
                      value={bk?.asian_handicap_away_odd}
                      color="blue"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No odds placeholder */}
          {!hasOdds && (
            <div className="border-t border-white/8 pt-2 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60">
                <TrendingUp className="w-3 h-3" />
                <span>Odds unavailable</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ===== LIVE / FINISHED LAYOUT ===== */}

          {/* Score Section */}
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
            <div className="border-t border-white/8 pt-3 space-y-3">
              {/* Compact icon stats grid */}
              <div className="flex flex-wrap gap-1 justify-center">
                <IconStat icon={<span className="w-2 h-2.5 rounded-[1px] bg-red-500 inline-block" />} label="Red" home={redCards.home} away={redCards.away} />
                <IconStat icon={<span className="w-2 h-2.5 rounded-[1px] bg-yellow-400 inline-block" />} label="Yellow" home={yellowCards.home} away={yellowCards.away} />
                {(fouls.home + fouls.away > 0) && (
                  <IconStat icon="⚠️" label="Fouls" home={fouls.home} away={fouls.away} />
                )}
                <IconStat icon="🎯" label="Shots OT" home={shotsOn.home} away={shotsOn.away} />
                <IconStat icon="🚩" label="Corners" home={corners.home} away={corners.away} />
                {offsides.home + offsides.away > 0 && (
                  <IconStat icon="🏳️" label="Offsides" home={offsides.home} away={offsides.away} />
                )}
                {xg && (
                  <IconStat icon="📊" label="xG" home={xg.home} away={xg.away} decimal />
                )}
              </div>

              {/* Circular progress indicators */}
              <div className="grid grid-cols-3 gap-2">
                {possession.home + possession.away > 0 && <CircleStat label="Possession" home={possession.home} away={possession.away} unit="%" />}
                {attacks.home + attacks.away > 0 && <CircleStat label="Attacks" home={attacks.home} away={attacks.away} />}
                {dangerousAttacks.home + dangerousAttacks.away > 0 && <CircleStat label="Dangerous" home={dangerousAttacks.home} away={dangerousAttacks.away} />}
              </div>
            </div>
          )}

          {/* Odds for live matches (1X2 only) */}
          {hasOdds && isLive && (
            <div className="border-t border-white/8 pt-3 mt-2">
              <div className="flex items-center gap-1 mb-2 text-[10px] font-semibold text-accent-amber">
                <TrendingUp className="w-3 h-3" />
                1X2
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <div className="text-center px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="font-bold text-accent-cyan">{formatOdds(bk?.home_win)}</div>
                  <div className="text-[9px] text-text-muted">1</div>
                </div>
                <div className="text-center px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="font-bold text-accent-yellow">{formatOdds(bk?.draw)}</div>
                  <div className="text-[9px] text-text-muted">X</div>
                </div>
                <div className="text-center px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="font-bold text-accent-blue">{formatOdds(bk?.away_win)}</div>
                  <div className="text-[9px] text-text-muted">2</div>
                </div>
              </div>
            </div>
          )}
        </>
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
    </motion.div>
  );
}

/** Odds cell for upcoming matches */
function OddsCell({ label, value, color }: { label: string; value: number | undefined; color: 'cyan' | 'blue' | 'yellow' | 'green' | 'red' }) {
  const colorMap = {
    cyan: 'text-accent-cyan',
    blue: 'text-accent-blue',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };
  return (
    <div className="text-center px-2 py-2 rounded-lg bg-white/5 border border-white/10">
      <div className={`font-bold text-[13px] tabular-nums ${colorMap[color]}`}>
        {value ? value.toFixed(2) : '-'}
      </div>
      <div className="text-[9px] text-text-muted mt-0.5 truncate leading-tight" title={label}>{label}</div>
    </div>
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

/** Compact icon stat badge for match card */
function IconStat({ icon, label, home, away, decimal }: { icon: React.ReactNode; label: string; home: number; away: number; decimal?: boolean }) {
  const fmt = (v: number) => decimal ? v.toFixed(1) : String(v);
  return (
    <div className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg bg-white/5 min-w-[48px]">
      <div className="text-[10px] leading-none">{icon}</div>
      <div className="text-[10px] font-bold whitespace-nowrap">
        <span className="text-accent-cyan">{fmt(home)}</span>
        <span className="text-text-muted mx-0.5">-</span>
        <span className="text-accent-blue">{fmt(away)}</span>
      </div>
      <div className="text-[8px] text-text-muted leading-none">{label}</div>
    </div>
  );
}

export default memo(MatchCard);
