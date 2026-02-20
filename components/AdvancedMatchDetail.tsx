'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, BarChart3, Clock, Activity, Filter as FilterIcon, Target, ChevronDown } from 'lucide-react';
import { LiveMatch } from '@/lib/unified-api';
import MatchPredictionsWrapper from '@/components/MatchPredictionsWrapper';
import type { FilterMatchResult } from '@/lib/filter-engine';

interface AdvancedMatchDetailProps {
  match: LiveMatch;
  onClose: () => void;
  filterResults?: FilterMatchResult[];
}

interface RecentMatchData {
  id?: string;
  date: string;
  league: string;
  sport?: string;
  status?: string;
  minute?: number | null;
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
  raw_data?: Record<string, any>;
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

export default function AdvancedMatchDetail({ match, onClose, filterResults }: AdvancedMatchDetailProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'history'>('stats');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [homeForm, setHomeForm] = useState<TeamRecentFormResult | null>(null);
  const [awayForm, setAwayForm] = useState<TeamRecentFormResult | null>(null);
  const [formLoading, setFormLoading] = useState(true);
  const [h2hMatches, setH2HMatches] = useState<RecentMatchData[]>([]);

  useEffect(() => {
    async function fetchForm() {
      setFormLoading(true);
      try {
        const homeId = match.teams?.home?.id;
        const awayId = match.teams?.away?.id;
        const homeIdStr = homeId !== undefined && homeId !== null ? String(homeId) : '';
        const awayIdStr = awayId !== undefined && awayId !== null ? String(awayId) : '';
        // Map league name to ESPN code for faster lookup
        const leagueMap: Record<string, string> = {
          'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Serie A': 'ita.1',
          'Bundesliga': 'ger.1', 'Ligue 1': 'fra.1', 'MLS': 'usa.1',
          'Champions League': 'uefa.champions',
        };
        const leagueCode = leagueMap[match.league?.name || ''] || '';
        const leagueParam = leagueCode ? `&league=${leagueCode}` : '';

        const [homeRes, awayRes, h2hRes] = await Promise.all([
          homeId ? fetch(`/api/espn/team-form?teamId=${encodeURIComponent(homeIdStr)}&limit=10${leagueParam}`).then(r => r.ok ? r.json() : null) : null,
          awayId ? fetch(`/api/espn/team-form?teamId=${encodeURIComponent(awayIdStr)}&limit=10${leagueParam}`).then(r => r.ok ? r.json() : null) : null,
          (homeId && awayId) ? fetch(`/api/espn/h2h?homeId=${encodeURIComponent(homeIdStr)}&awayId=${encodeURIComponent(awayIdStr)}&limit=10`).then(r => r.ok ? r.json() : null) : null,
        ]);

        if (homeRes) setHomeForm({ teamId: homeIdStr || '', matches: homeRes.matches || [], form: homeRes.form });
        if (awayRes) setAwayForm({ teamId: awayIdStr || '', matches: awayRes.matches || [], form: awayRes.form });
        if (h2hRes && h2hRes.matches) setH2HMatches(h2hRes.matches || []);
      } catch (err) {
        console.error('Error fetching team form:', err);
      } finally {
        setFormLoading(false);
      }
    }
    fetchForm();
  }, [match.teams?.home?.id, match.teams?.away?.id, match.league?.name]);

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
              aria-label="Close match details"
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

        {/* Collapsible Triggered Filters */}
        {filterResults && filterResults.length > 0 && (
          <div className="mx-6 mt-4">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-accent-green/30 bg-accent-green/5 hover:bg-accent-green/10 transition-colors"
            >
              <span className="text-sm font-semibold text-accent-green flex items-center gap-2">
                <Target className="w-4 h-4" />
                {filterResults.length} Filter{filterResults.length > 1 ? 's' : ''} Triggered
              </span>
              <ChevronDown className={`w-4 h-4 text-accent-green transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
            </button>
            {filtersExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-1 space-y-1 px-1"
              >
                {filterResults.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-glass-light/50 text-xs">
                    <FilterIcon className="w-3 h-3 text-accent-cyan mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-accent-cyan">{result.filter.name}</span>
                      <p className="text-text-muted mt-0.5">{result.matchedConditions.join(', ')}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="sticky top-[88px] z-10 bg-background/95 backdrop-blur-sm border-b border-accent-cyan/20 px-6 pt-4 pb-0 flex gap-1">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === 'stats'
                ? 'bg-accent-cyan/10 text-accent-cyan border-b-2 border-accent-cyan'
                : 'text-text-muted hover:text-white hover:bg-glass-light'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === 'history'
                ? 'bg-accent-cyan/10 text-accent-cyan border-b-2 border-accent-cyan'
                : 'text-text-muted hover:text-white hover:bg-glass-light'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Previous Games
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">

          {/* ===== STATISTICS TAB ===== */}
          {activeTab === 'stats' && (
            <>
              {/* Live Statistics */}
              <div className="space-y-4">
                <StatRow label="Possession" home={homeStats.possession} away={awayStats.possession} unit="%" compare={true} />
                <StatRow label="Shots on Target" home={homeStats.shotsOnTarget} away={awayStats.shotsOnTarget} compare={true} />
                <StatRow label="Shots Off Target" home={homeStats.shotsOffTarget} away={awayStats.shotsOffTarget} compare={true} />
                <StatRow label="Total Shots" home={homeStats.shotsOnTarget + homeStats.shotsOffTarget} away={awayStats.shotsOnTarget + awayStats.shotsOffTarget} compare={true} />
                <StatRow label="Attacks" home={homeStats.attacks} away={awayStats.attacks} compare={true} />
                <StatRow label="Dangerous Attacks" home={homeStats.dangerousAttacks} away={awayStats.dangerousAttacks} compare={true} />
                <StatRow label="Corners" home={homeStats.corners} away={awayStats.corners} compare={true} />
                <StatRow label="Yellow Cards" home={homeStats.yellowCards} away={awayStats.yellowCards} compare={true} />
                <StatRow label="Red Cards" home={homeStats.redCards} away={awayStats.redCards} compare={false} />
              </div>

              {/* Goals by Half */}
              {(homeStats.firstHalf > 0 || awayStats.firstHalf > 0 || homeStats.secondHalf > 0 || awayStats.secondHalf > 0) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-accent-amber" />
                    <h3 className="text-lg font-bold text-white">Goals by Half</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <TimeWindowStat label="First Half" home={homeStats.firstHalf} away={awayStats.firstHalf} />
                    <TimeWindowStat label="Second Half" home={homeStats.secondHalf} away={awayStats.secondHalf} />
                  </div>
                </div>
              )}

              {/* Match Momentum */}
              <MomentumSection homeStats={homeStats} awayStats={awayStats} match={match} />

              {/* Odds Section */}
              {(match as any).odds && (
                <BettingOddsSection
                  odds={(match as any).odds}
                  homeName={match.teams?.home?.name || 'Home'}
                  awayName={match.teams?.away?.name || 'Away'}
                />
              )}

              {/* AI Predictions */}
              <MatchPredictionsWrapper match={match} />
            </>
          )}

          {/* ===== PREVIOUS GAMES TAB ===== */}
          {activeTab === 'history' && (
            <>
              {/* Head-to-Head */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent-blue" />
                  Head-to-Head ({h2hMatches.length > 0 ? `Last ${h2hMatches.length}` : 'Recent'})
                </h3>

                {formLoading && h2hMatches.length === 0 && (
                  <div className="text-xs text-text-muted animate-pulse">Loading H2H data...</div>
                )}

                {!formLoading && h2hMatches.length === 0 && (
                  <div className="text-xs text-text-muted">No recent H2H matches found</div>
                )}

                {h2hMatches.length > 0 && (() => {
                  const homeTeamId = String(match.teams?.home?.id || '');
                  const homeName = match.teams?.home?.name || 'Home';
                  const awayName = match.teams?.away?.name || 'Away';

                  let homeWins = 0, awayWins = 0, draws = 0, totalHomeGoals = 0, totalAwayGoals = 0;
                  h2hMatches.forEach(m => {
                    const hScore = m.home_score;
                    const aScore = m.away_score;
                    const isCurrentHomeAtHome = String(m.home_team_id) === homeTeamId;
                    totalHomeGoals += isCurrentHomeAtHome ? hScore : aScore;
                    totalAwayGoals += isCurrentHomeAtHome ? aScore : hScore;

                    if (hScore > aScore) {
                      if (isCurrentHomeAtHome) homeWins++; else awayWins++;
                    } else if (aScore > hScore) {
                      if (isCurrentHomeAtHome) awayWins++; else homeWins++;
                    } else {
                      draws++;
                    }
                  });

                  return (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.85)]">
                        <div className="text-center flex-1">
                          <div className="text-xs text-text-muted mb-1 truncate">{homeName}</div>
                          <div className="text-2xl font-bold text-accent-cyan">{homeWins}</div>
                          <div className="text-[10px] text-text-muted">wins</div>
                        </div>
                        <div className="text-center px-4">
                          <div className="text-xs text-text-muted mb-1">Draws</div>
                          <div className="text-2xl font-bold text-accent-yellow">{draws}</div>
                          <div className="text-[10px] text-text-muted">{totalHomeGoals}-{totalAwayGoals} goals</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-xs text-text-muted mb-1 truncate">{awayName}</div>
                          <div className="text-2xl font-bold text-accent-blue">{awayWins}</div>
                          <div className="text-[10px] text-text-muted">wins</div>
                        </div>
                      </div>

                      <div className="space-y-0 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
                        {h2hMatches.map((m, i) => {
                          const isCurrentHomeAtHome = String(m.home_team_id) === homeTeamId;
                          const homeTeamWon = isCurrentHomeAtHome
                            ? m.home_score > m.away_score
                            : m.away_score > m.home_score;
                          const awayTeamWon = isCurrentHomeAtHome
                            ? m.away_score > m.home_score
                            : m.home_score > m.away_score;
                          const isDraw = m.home_score === m.away_score;

                          return (
                            <div
                              key={m.id || i}
                              className="flex items-center gap-2 px-3 py-2.5 text-[11px] border-b border-white/8 last:border-b-0 hover:bg-white/5 transition"
                            >
                              <span className="text-text-muted w-[52px] shrink-0 text-[10px]">
                                {formatDate(m.date)}
                              </span>
                              <div className="flex-1 min-w-0 text-right truncate">
                                <span className={homeTeamWon && isCurrentHomeAtHome || awayTeamWon && !isCurrentHomeAtHome ? 'text-accent-green font-bold' : 'text-white'}>
                                  {m.home_team_name}
                                </span>
                              </div>
                              <span className={`font-bold text-xs px-2 shrink-0 ${
                                isDraw ? 'text-accent-yellow' : homeTeamWon ? 'text-accent-cyan' : 'text-accent-blue'
                              }`}>
                                {m.home_score} - {m.away_score}
                              </span>
                              <div className="flex-1 min-w-0 truncate">
                                <span className={awayTeamWon && isCurrentHomeAtHome || homeTeamWon && !isCurrentHomeAtHome ? 'text-accent-green font-bold' : 'text-white'}>
                                  {m.away_team_name}
                                </span>
                              </div>
                              {m.league && (
                                <span className="text-[9px] text-text-muted shrink-0 truncate max-w-[60px]">{m.league}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Team Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent-green" />
                  Team Form (Last 10 Matches)
                </h3>
                <p className="text-xs text-text-muted -mt-2">Click any match to see detailed stats</p>
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
            </>
          )}

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
  const homeLeads = home > away;
  const awayLeads = away > home;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
      <div className="text-center text-xs text-text-muted">{label}</div>
      <div className="flex items-center gap-3">
        <div className={`w-12 text-right text-lg font-bold ${homeLeads ? 'text-accent-cyan' : 'text-text-secondary'}`}>
          {home}{unit}
        </div>
        <div className="flex-1 h-2.5 bg-glass-light rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-500 rounded-l-full ${homeLeads ? 'bg-accent-cyan' : 'bg-accent-cyan/40'}`}
            style={{ width: `${homePercent}%` }}
          />
          <div
            className={`h-full transition-all duration-500 rounded-r-full ${awayLeads ? 'bg-accent-blue' : 'bg-accent-blue/40'}`}
            style={{ width: `${awayPercent}%` }}
          />
        </div>
        <div className={`w-12 text-left text-lg font-bold ${awayLeads ? 'text-accent-blue' : 'text-text-secondary'}`}>
          {away}{unit}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Convert American moneyline to decimal odds
 * +330 → 4.30, -180 → 1.56
 */
function mlToDecimal(ml: any): string {
  const num = typeof ml === 'string' ? parseFloat(ml) : ml;
  if (!num || isNaN(num)) return '—';
  if (num > 0) return ((num / 100) + 1).toFixed(2);
  return ((100 / Math.abs(num)) + 1).toFixed(2);
}

function formatML(ml: any): string {
  const num = typeof ml === 'string' ? parseFloat(ml) : ml;
  if (!num || isNaN(num)) return '—';
  return num > 0 ? `+${num}` : String(num);
}

function BettingOddsSection({
  odds,
  homeName,
  awayName,
}: {
  odds: Record<string, any>;
  homeName: string;
  awayName: string;
}) {
  const [showAmerican, setShowAmerican] = useState(false);
  const fmt = showAmerican ? formatML : mlToDecimal;

  const hasMoneyline = odds.homeWin || odds.draw || odds.awayWin;
  const hasOverUnder = odds.overUnderLine != null;
  const hasSpread = odds.homeSpreadLine != null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent-blue" />
          <h3 className="text-lg font-bold text-white">Betting Odds</h3>
        </div>
        <div className="flex items-center gap-2">
          {odds.provider && (
            <span className="text-[10px] text-text-muted">{odds.provider}</span>
          )}
          <button
            onClick={() => setShowAmerican(!showAmerican)}
            className="text-[10px] px-2 py-0.5 rounded bg-glass-light text-text-muted hover:text-white transition"
          >
            {showAmerican ? 'American' : 'Decimal'}
          </button>
        </div>
      </div>

      {/* 1X2 Match Result */}
      {hasMoneyline && (
        <div>
          <div className="text-xs text-text-muted mb-2 font-semibold">Match Result (1X2)</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-[10px] text-text-muted mb-1">1</div>
              <div className="text-xs text-text-secondary mb-0.5 truncate">{homeName}</div>
              <div className="text-lg font-bold text-accent-cyan">{fmt(odds.homeWin)}</div>
            </div>
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-[10px] text-text-muted mb-1">X</div>
              <div className="text-xs text-text-secondary mb-0.5">Draw</div>
              <div className="text-lg font-bold text-accent-yellow">{fmt(odds.draw)}</div>
            </div>
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-[10px] text-text-muted mb-1">2</div>
              <div className="text-xs text-text-secondary mb-0.5 truncate">{awayName}</div>
              <div className="text-lg font-bold text-accent-cyan">{fmt(odds.awayWin)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Over/Under */}
      {hasOverUnder && (
        <div>
          <div className="text-xs text-text-muted mb-2 font-semibold">Goals Over/Under {odds.overUnderLine}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-xs text-text-secondary mb-1">Over {odds.overUnderLine}</div>
              <div className="text-lg font-bold text-accent-green">{odds.overOdds ? fmt(odds.overOdds) : '—'}</div>
            </div>
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-xs text-text-secondary mb-1">Under {odds.overUnderLine}</div>
              <div className="text-lg font-bold text-accent-red">{odds.underOdds ? fmt(odds.underOdds) : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Spread/Handicap */}
      {hasSpread && (
        <div>
          <div className="text-xs text-text-muted mb-2 font-semibold">Asian Handicap</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-xs text-text-secondary mb-1 truncate">{homeName} ({odds.homeSpreadLine})</div>
              <div className="text-lg font-bold text-accent-cyan">{odds.homeSpreadOdds ? fmt(odds.homeSpreadOdds) : '—'}</div>
            </div>
            <div className="bg-glass-light rounded-lg p-3 text-center">
              <div className="text-xs text-text-secondary mb-1 truncate">{awayName} ({odds.awaySpreadLine})</div>
              <div className="text-lg font-bold text-accent-cyan">{odds.awaySpreadOdds ? fmt(odds.awaySpreadOdds) : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {!hasMoneyline && !hasOverUnder && !hasSpread && (
        <div className="text-xs text-text-muted text-center py-4">No odds available for this match</div>
      )}
    </div>
  );
}

function TimeWindowStat({ label, home, away }: { label: string; home: number; away: number; disabled?: boolean }) {
  return (
    <div className="rounded-lg p-3 border border-white/10 bg-[rgba(15,23,42,0.85)]">
      <div className="text-xs text-text-muted mb-2">{label}</div>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-accent-cyan">{home}</div>
        <div className="text-xs text-text-secondary">-</div>
        <div className="text-lg font-bold text-accent-blue">{away}</div>
      </div>
    </div>
  );
}

interface MatchEvent {
  minute: number;
  period: number;
  type: string;
  teamId: string | null;
  teamName: string | null;
  player: string | null;
  isScoring: boolean;
  text: string;
}

/**
 * Momentum Section - Bundesliga-style event timeline + stat-based momentum gauge
 */
function MomentumSection({
  homeStats,
  awayStats,
  match,
}: {
  homeStats: Record<string, number>;
  awayStats: Record<string, number>;
  match: LiveMatch;
}) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  const isLiveOrFinished = match.fixture?.status?.short !== 'NS' && match.fixture?.status?.short !== 'TBD';
  const matchId = match.fixture?.id;
  const leagueName = match.league?.name || '';

  // Fetch key events from ESPN
  useEffect(() => {
    if (!matchId || !isLiveOrFinished) return;
    let cancelled = false;
    setEventsLoading(true);

    fetch(`/api/espn/match-events?eventId=${matchId}&league=${encodeURIComponent(leagueName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setEvents(data.events || []);
        setHomeTeamId(data.homeTeamId || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEventsLoading(false); });

    return () => { cancelled = true; };
  }, [matchId, isLiveOrFinished, leagueName]);

  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';
  const homeId = match.teams?.home?.id ? String(match.teams.home.id) : homeTeamId;
  const elapsed = match.fixture?.status?.elapsed || 90;
  const isHT = match.fixture?.status?.short === 'HT';
  const isFT = match.fixture?.status?.short === 'FT' || match.fixture?.status?.short === 'AET';
  const totalMinutes = isFT ? 90 : elapsed;

  // Split events into home and away
  const homeEvents = events.filter(e => e.teamId && e.teamId === homeId);
  const awayEvents = events.filter(e => e.teamId && e.teamId !== homeId);

  const hasEvents = events.length > 0;
  const hasStats = match.statistics && match.statistics.length > 0;

  if (!hasEvents && !hasStats && !eventsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-purple" />
          <h3 className="text-lg font-bold text-white">Match Momentum</h3>
        </div>
        <div className="rounded-lg p-4 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
          <div className="text-xs text-text-muted">Match data not yet available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-accent-purple" />
        <h3 className="text-lg font-bold text-white">Match Momentum</h3>
      </div>

      <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
        {/* Team names header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-[11px] font-bold text-accent-cyan truncate max-w-[40%]">{homeName}</span>
          <span className="text-[10px] text-text-muted">MATCH MOMENTUM</span>
          <span className="text-[11px] font-bold text-accent-blue truncate max-w-[40%] text-right">{awayName}</span>
        </div>

        {/* Timeline visualization */}
        {eventsLoading ? (
          <div className="px-4 py-6 text-center">
            <div className="text-xs text-text-muted animate-pulse">Loading match events...</div>
          </div>
        ) : hasEvents ? (
          <div className="px-3 pb-3">
            {/* Event timeline - Bundesliga style */}
            <div className="relative" style={{ height: '140px' }}>
              {/* Center line (0 axis) */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />

              {/* Minute markers */}
              <div className="absolute left-0 right-0 top-1/2 flex justify-between px-1 -translate-y-1/2">
                {[0, 15, 30, 45, 60, 75, 90].filter(m => m <= totalMinutes).map(m => (
                  <div key={m} className="flex flex-col items-center">
                    <div className="w-px h-2 bg-white/15" />
                  </div>
                ))}
              </div>

              {/* Minute labels */}
              <div className="absolute left-0 right-0 bottom-0 flex justify-between px-1 text-[8px] text-text-muted">
                <span>1&apos;</span>
                {!isHT && <span className="absolute left-1/2 -translate-x-1/2">HT</span>}
                <span>{isFT ? 'FT' : `${elapsed}'`}</span>
              </div>

              {/* Home events (bars going UP from center) */}
              {homeEvents.map((evt, i) => {
                const xPercent = Math.min((evt.minute / totalMinutes) * 100, 100);
                return (
                  <EventMarker key={`h-${i}`} event={evt} xPercent={xPercent} isHome={true} />
                );
              })}

              {/* Away events (bars going DOWN from center) */}
              {awayEvents.map((evt, i) => {
                const xPercent = Math.min((evt.minute / totalMinutes) * 100, 100);
                return (
                  <EventMarker key={`a-${i}`} event={evt} xPercent={xPercent} isHome={false} />
                );
              })}

              {/* HT separator line */}
              <div
                className="absolute top-2 bottom-4 w-px bg-white/30"
                style={{ left: `${Math.min((45 / totalMinutes) * 100, 50)}%` }}
              />
            </div>

            {/* Event legend */}
            <div className="flex items-center justify-center gap-3 flex-wrap pt-2 border-t border-white/8 mt-1">
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <svg width="10" height="10" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="white" stroke="#333" strokeWidth="0.8" /></svg> Goal
              </div>
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <span className="w-2 h-2.5 rounded-[1px] bg-yellow-400 inline-block" /> Yellow
              </div>
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <span className="w-2 h-2.5 rounded-[1px] bg-red-500 inline-block" /> Red
              </div>
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <span className="text-green-400">{'\u25B2'}</span><span className="text-red-400">{'\u25BC'}</span> Sub
              </div>
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> On Target
              </div>
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <span className="w-2 h-2 rounded-full border border-orange-400 inline-block" /> Off Target
              </div>
            </div>
          </div>
        ) : null}

        {/* Stat-based momentum gauge (below timeline) */}
        {hasStats && <StatMomentumGauge homeStats={homeStats} awayStats={awayStats} />}
      </div>
    </div>
  );
}

/** Individual event marker on the timeline */
function EventMarker({ event, xPercent, isHome }: { event: MatchEvent; xPercent: number; isHome: boolean }) {
  const topBase = 50; // center line at 50%

  // Event icon and bar height
  let barHeight = 0;
  let icon: React.ReactNode = null;

  switch (event.type) {
    case 'goal':
    case 'penalty-goal':
    case 'own-goal':
      barHeight = 38;
      // Football/soccer ball icon
      icon = (
        <svg width="16" height="16" viewBox="0 0 16 16" className="drop-shadow-md">
          <circle cx="8" cy="8" r="7" fill="white" stroke="#333" strokeWidth="0.8" />
          <path d="M8 1.5 L9.5 4.5 L13 5 L10.5 8 L11.5 12 L8 10.5 L4.5 12 L5.5 8 L3 5 L6.5 4.5 Z"
            fill="none" stroke="#333" strokeWidth="0.7" strokeLinejoin="round" />
          {event.type === 'penalty-goal' && <text x="8" y="10.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#333">P</text>}
          {event.type === 'own-goal' && <text x="8" y="10.5" textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="#dc2626">OG</text>}
        </svg>
      );
      break;
    case 'penalty-miss':
      barHeight = 30;
      // Ball with X overlay
      icon = (
        <svg width="16" height="16" viewBox="0 0 16 16" className="drop-shadow-md">
          <circle cx="8" cy="8" r="7" fill="white" stroke="#333" strokeWidth="0.8" opacity="0.6" />
          <line x1="4" y1="4" x2="12" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="4" x2="4" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
      break;
    case 'shot-on-target':
      barHeight = 22;
      // Larger circle for shot on target (orange)
      icon = <div className="w-3.5 h-3.5 rounded-full bg-orange-400 border border-orange-500 shadow-sm" />;
      break;
    case 'shot-off-target':
      barHeight = 14;
      // Smaller circle for shot off target (orange, hollow)
      icon = <div className="w-2.5 h-2.5 rounded-full border-2 border-orange-400 bg-transparent" />;
      break;
    case 'yellow-card':
      barHeight = 20;
      icon = <div className="w-2.5 h-3.5 rounded-[1px] bg-yellow-400" />;
      break;
    case 'red-card':
      barHeight = 28;
      icon = <div className="w-2.5 h-3.5 rounded-[1px] bg-red-500" />;
      break;
    case 'substitution':
      barHeight = 12;
      // Green arrow IN, Red arrow OUT
      icon = (
        <div className="flex flex-col items-center leading-none">
          <span className="text-[9px] text-green-400 font-bold">{'\u25B2'}</span>
          <span className="text-[9px] text-red-400 font-bold -mt-0.5">{'\u25BC'}</span>
        </div>
      );
      break;
    default:
      barHeight = 10;
      break;
  }

  // Position: home goes up (lower top%), away goes down (higher top%)
  const barColor = isHome ? 'bg-accent-cyan/70' : 'bg-accent-blue/70';
  const top = isHome ? `${topBase - barHeight}%` : `${topBase}%`;

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${xPercent}%`,
        top,
        height: `${barHeight}%`,
        transform: 'translateX(-50%)',
        zIndex: event.isScoring ? 10 : 5,
      }}
      title={`${event.minute}' ${event.text}`}
    >
      {/* Bar */}
      <div className={`w-1.5 flex-1 ${barColor} rounded-sm`} />
      {/* Icon at the end (top for home, bottom for away) */}
      <div className={`absolute ${isHome ? '-top-2' : '-bottom-2'}`}>
        {icon}
      </div>
      {/* Minute label for goals */}
      {event.isScoring && (
        <div className={`absolute text-[7px] font-bold text-white ${isHome ? '-top-5' : '-bottom-5'}`}>
          {event.minute}&apos;
        </div>
      )}
    </div>
  );
}

/** Compact stat-based momentum gauge */
function StatMomentumGauge({ homeStats, awayStats }: { homeStats: Record<string, number>; awayStats: Record<string, number> }) {
  const categories = [
    { label: 'Possession', home: homeStats.possession, away: awayStats.possession, weight: 0.25 },
    { label: 'Shots on Target', home: homeStats.shotsOnTarget, away: awayStats.shotsOnTarget, weight: 0.20 },
    { label: 'Dangerous Attacks', home: homeStats.dangerousAttacks, away: awayStats.dangerousAttacks, weight: 0.20 },
    { label: 'Corners', home: homeStats.corners, away: awayStats.corners, weight: 0.15 },
    { label: 'Total Shots', home: homeStats.shotsOnTarget + homeStats.shotsOffTarget, away: awayStats.shotsOnTarget + awayStats.shotsOffTarget, weight: 0.10 },
    { label: 'Fouls Won', home: awayStats.fouls, away: homeStats.fouls, weight: 0.10 },
  ].filter(c => c.home + c.away > 0);

  if (categories.length === 0) return null;

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  let overall = 0;
  for (const cat of categories) {
    const total = cat.home + cat.away;
    if (total === 0) continue;
    overall += ((cat.home / total) * 2 - 1) * (cat.weight / totalWeight) * 100;
  }
  overall = Math.round(overall);
  const barPosition = 50 + overall / 2;

  return (
    <div className="px-4 pb-3 pt-2 border-t border-white/8 space-y-2">
      {/* Momentum bar */}
      <div className="relative h-4 rounded-full overflow-hidden bg-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${barPosition}%`, background: 'linear-gradient(90deg, rgba(34,211,238,0.1) 0%, rgba(34,211,238,0.5) 100%)' }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-full transition-all duration-700"
          style={{ width: `${100 - barPosition}%`, background: 'linear-gradient(270deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.5) 100%)' }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
        <div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-lg transition-all duration-700"
          style={{
            left: `${barPosition}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: overall > 10 ? 'rgb(34,211,238)' : overall < -10 ? 'rgb(59,130,246)' : 'rgb(250,204,21)',
          }}
        />
      </div>
      <div className="text-center">
        <span className="text-[9px] text-text-muted">Stat Momentum: </span>
        <span className={`text-[10px] font-bold ${overall > 0 ? 'text-accent-cyan' : overall < 0 ? 'text-accent-blue' : 'text-accent-yellow'}`}>
          {overall > 0 ? '+' : ''}{overall}
        </span>
      </div>
    </div>
  );
}

/** Stats Breakdown - category comparison bars */
function StatsBreakdown({ homeStats, awayStats, match }: { homeStats: Record<string, number>; awayStats: Record<string, number>; match: LiveMatch }) {
  const categories = [
    { label: 'Possession', home: homeStats.possession, away: awayStats.possession },
    { label: 'Shots on Target', home: homeStats.shotsOnTarget, away: awayStats.shotsOnTarget },
    { label: 'Dangerous Attacks', home: homeStats.dangerousAttacks, away: awayStats.dangerousAttacks },
    { label: 'Corners', home: homeStats.corners, away: awayStats.corners },
    { label: 'Total Shots', home: homeStats.shotsOnTarget + homeStats.shotsOffTarget, away: awayStats.shotsOnTarget + awayStats.shotsOffTarget },
    { label: 'Fouls Won', home: awayStats.fouls, away: homeStats.fouls },
  ].filter(c => c.home + c.away > 0);

  if (categories.length === 0) return null;

  return (
    <div className="rounded-xl p-4 border border-white/10 bg-[rgba(15,23,42,0.85)] space-y-2">
      {categories.map(cat => {
        const total = cat.home + cat.away;
        const homePercent = total > 0 ? Math.round((cat.home / total) * 100) : 50;
        const homeLead = cat.home > cat.away;
        const awayLead = cat.away > cat.home;

        return (
          <div key={cat.label} className="flex items-center gap-2 text-[10px]">
            <span className={`w-5 text-right font-bold ${homeLead ? 'text-accent-cyan' : 'text-text-secondary'}`}>
              {cat.home}
            </span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div
                className={`h-full rounded-l-full transition-all duration-500 ${homeLead ? 'bg-accent-cyan' : 'bg-accent-cyan/30'}`}
                style={{ width: `${homePercent}%` }}
              />
              <div
                className={`h-full rounded-r-full transition-all duration-500 ${awayLead ? 'bg-accent-blue' : 'bg-accent-blue/30'}`}
                style={{ width: `${100 - homePercent}%` }}
              />
            </div>
            <span className={`w-5 text-left font-bold ${awayLead ? 'text-accent-blue' : 'text-text-secondary'}`}>
              {cat.away}
            </span>
            <span className="text-text-muted w-[80px] text-[9px] truncate">{cat.label}</span>
          </div>
        );
      })}
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
  const [venueFilter, setVenueFilter] = useState<'ALL' | 'HOME' | 'AWAY'>('ALL');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-lg p-4 border border-white/10 animate-pulse bg-[rgba(15,23,42,0.85)]">
        <div className="font-semibold text-white mb-3">{team}</div>
        <div className="space-y-2">
          <div className="h-8 bg-white/5 rounded" />
          <div className="h-6 bg-white/5 rounded w-3/4" />
          <div className="h-6 bg-white/5 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!recentData || !recentData.matches || recentData.matches.length === 0) {
    return (
      <div className="rounded-lg p-4 border border-white/10 bg-[rgba(15,23,42,0.85)]">
        <div className="font-semibold text-white mb-3">{team}</div>
        <div className="text-xs text-text-muted">No recent match data available</div>
      </div>
    );
  }

  const { matches, form } = recentData;

  // Filter by venue
  const filteredMatches = matches.filter(m => {
    if (venueFilter === 'HOME') return m.home_team_id === teamId;
    if (venueFilter === 'AWAY') return m.away_team_id === teamId;
    return true;
  });

  return (
    <div className="rounded-lg p-4 border border-white/10 bg-[rgba(15,23,42,0.85)]">
      {/* Header: Team name + W/D/L badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-white text-sm truncate">{team}</div>
        <div className="flex items-center gap-1">
          {matches.slice(0, 10).map((m, i) => {
            const result = getMatchResult(m, teamId);
            return (
              <div
                key={i}
                className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[9px] ${
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

      {/* Venue filter tabs */}
      <div className="flex gap-1 mb-3">
        {(['ALL', 'HOME', 'AWAY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setVenueFilter(tab)}
            className={`px-3 py-1 text-[10px] font-bold rounded transition ${
              venueFilter === tab
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'text-text-muted hover:text-white hover:bg-glass-light'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Match rows */}
      <div className="space-y-0 mb-3">
        {filteredMatches.slice(0, 10).map((m, i) => {
          const result = getMatchResult(m, teamId);
          const isHome = m.home_team_id === teamId;
          const matchKey = m.id || `${m.date}-${i}`;
          const isExpanded = expandedMatchId === matchKey;

          return (
            <div key={matchKey}>
              {/* Match row */}
              <div
                onClick={() => setExpandedMatchId(isExpanded ? null : matchKey)}
                className={`flex items-center gap-1.5 text-[11px] py-2.5 px-2 border-b border-white/8 cursor-pointer transition rounded ${
                  isExpanded ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {/* Date */}
                <span className="text-text-muted w-[42px] shrink-0 text-[10px]">
                  {formatDate(m.date)}
                </span>

                {/* Venue badge */}
                <span className={`text-[8px] font-bold w-3 shrink-0 ${isHome ? 'text-accent-cyan' : 'text-text-muted'}`}>
                  {isHome ? 'H' : 'A'}
                </span>

                {/* Opponent name */}
                <div className="flex-1 min-w-0 truncate text-white">
                  {isHome ? m.away_team_name : m.home_team_name}
                </div>

                {/* Score */}
                <span className={`font-bold shrink-0 text-xs px-1 ${
                  result === 'W' ? 'text-accent-green' : result === 'D' ? 'text-accent-yellow' : 'text-accent-red'
                }`}>
                  {m.home_score}-{m.away_score}
                </span>

                {/* W/D/L badge */}
                <div className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] shrink-0 ${
                  result === 'W'
                    ? 'bg-accent-green/30 text-accent-green'
                    : result === 'D'
                      ? 'bg-accent-yellow/30 text-accent-yellow'
                      : 'bg-accent-red/30 text-accent-red'
                }`}>
                  {result}
                </div>

                {/* Expand arrow */}
                <span className={`text-[10px] text-text-muted shrink-0 transition ${isExpanded ? 'rotate-90' : ''}`}>
                  ▸
                </span>
              </div>

              {/* Expanded match detail */}
              {isExpanded && (
                <ExpandedMatchStats match={m} />
              )}
            </div>
          );
        })}

        {filteredMatches.length === 0 && (
          <div className="text-xs text-text-muted py-2">No {venueFilter.toLowerCase()} matches found</div>
        )}
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
        <span className={`font-bold ${
          form.winRate >= 60 ? 'text-accent-green' : form.winRate >= 40 ? 'text-accent-yellow' : 'text-accent-red'
        }`}>
          {form.winRate}% WR
        </span>
      </div>
    </div>
  );
}

/**
 * Expanded stats panel - fetches stats on-demand from ESPN summary endpoint
 */
function ExpandedMatchStats({ match }: { match: RecentMatchData }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!match.id) { setLoading(false); return; }
      try {
        const leagueCode = match.raw_data?.leagueCode;
        const res = await fetch(`/api/espn/match-stats?eventId=${match.id}${leagueCode ? `&league=${leagueCode}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stats) setStats(data.stats);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    fetchStats();
  }, [match.id, match.raw_data?.leagueCode]);

  if (loading) {
    return (
      <div className="py-3 px-2 text-[10px] text-text-muted rounded-b mb-1 bg-[rgba(15,23,42,0.6)]">
        Loading stats...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-2 px-2 text-[10px] text-text-muted rounded-b mb-1 bg-[rgba(15,23,42,0.6)]">
        Statistics not available for this match
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-b px-3 py-3 mb-1 space-y-2 bg-[rgba(15,23,42,0.6)]"
    >
      {/* Match header */}
      <div className="flex items-center justify-between text-[10px] text-text-muted mb-2">
        <span className="truncate">{match.home_team_name}</span>
        <span className="font-bold text-white text-xs px-2">{match.home_score} - {match.away_score}</span>
        <span className="truncate text-right">{match.away_team_name}</span>
      </div>

      {/* Stats rows */}
      {stats.homePoss > 0 && <MiniStatRow label="Possession" home={stats.homePoss} away={stats.awayPoss} unit="%" />}
      {(stats.homeSoT > 0 || stats.awaySoT > 0) && <MiniStatRow label="On Target" home={stats.homeSoT} away={stats.awaySoT} />}
      {(stats.homeShots > 0 || stats.awayShots > 0) && <MiniStatRow label="Total Shots" home={stats.homeShots} away={stats.awayShots} />}
      {(stats.homeCorners > 0 || stats.awayCorners > 0) && <MiniStatRow label="Corners" home={stats.homeCorners} away={stats.awayCorners} />}
      {(stats.homeYellow > 0 || stats.awayYellow > 0) && <MiniStatRow label="Yellow Cards" home={stats.homeYellow} away={stats.awayYellow} />}
      {(stats.homeRed > 0 || stats.awayRed > 0) && <MiniStatRow label="Red Cards" home={stats.homeRed} away={stats.awayRed} />}
      {(stats.homeFouls > 0 || stats.awayFouls > 0) && <MiniStatRow label="Fouls" home={stats.homeFouls} away={stats.awayFouls} />}
      {(stats.homeOffsides > 0 || stats.awayOffsides > 0) && <MiniStatRow label="Offsides" home={stats.homeOffsides} away={stats.awayOffsides} />}
    </motion.div>
  );
}

/**
 * Compact stat comparison row for expanded match detail
 */
function MiniStatRow({ label, home, away, unit = '' }: { label: string; home: number; away: number; unit?: string }) {
  const total = home + away;
  const homePercent = total === 0 ? 50 : Math.round((home / total) * 100);

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className={`w-8 text-right font-bold ${home > away ? 'text-accent-cyan' : 'text-text-secondary'}`}>
        {home}{unit}
      </span>
      <div className="flex-1 h-1.5 bg-glass-light rounded-full overflow-hidden flex">
        <div
          className="h-full bg-accent-cyan/60 rounded-l"
          style={{ width: `${homePercent}%` }}
        />
        <div
          className="h-full bg-accent-blue/60 rounded-r"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
      <span className={`w-8 text-left font-bold ${away > home ? 'text-accent-blue' : 'text-text-secondary'}`}>
        {away}{unit}
      </span>
      <span className="text-text-muted w-[68px] text-[9px] truncate">{label}</span>
    </div>
  );
}
