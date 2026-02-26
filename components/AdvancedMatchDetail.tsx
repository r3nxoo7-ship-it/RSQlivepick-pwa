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
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'predictions'>('stats');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [homeForm, setHomeForm] = useState<TeamRecentFormResult | null>(null);
  const [awayForm, setAwayForm] = useState<TeamRecentFormResult | null>(null);
  const [formLoading, setFormLoading] = useState(true);
  const [h2hMatches, setH2HMatches] = useState<RecentMatchData[]>([]);

  useEffect(() => {
    async function fetchForm() {
      setFormLoading(true);
      const homeName = match.teams?.home?.name || '';
      const awayName = match.teams?.away?.name || '';
      const homeIdStr = match.teams?.home?.id != null ? String(match.teams.home.id) : '';
      const awayIdStr = match.teams?.away?.id != null ? String(match.teams.away.id) : '';

      try {
        // Round 1: SofaScore find-event + ESPN form + TheSportsDB H2H all in parallel
        // SofaScore find-event resolves SofaScore IDs so we can fetch richer data in Round 2.
        const matchDate = match.fixture?.date
          ? new Date(match.fixture.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const [ssEventRes, homeEspn, awayEspn, h2hRes] = await Promise.all([
          (homeName && awayName)
            ? fetch(`/api/sofascore/find-event?home=${encodeURIComponent(homeName)}&away=${encodeURIComponent(awayName)}&date=${matchDate}`)
                .then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
          homeIdStr
            ? fetch(`/api/espn/team-form?teamId=${homeIdStr}&limit=10`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
          awayIdStr
            ? fetch(`/api/espn/team-form?teamId=${awayIdStr}&limit=10`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
          (homeName && awayName)
            ? fetch(`/api/h2h?home=${encodeURIComponent(homeName)}&away=${encodeURIComponent(awayName)}&limit=20`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
        ]);

        const ssHomeTeamId: number | null = ssEventRes?.homeTeamId ?? null;
        const ssAwayTeamId: number | null = ssEventRes?.awayTeamId ?? null;
        const ssEventId: number | null = ssEventRes?.eventId ?? null;

        // Round 2: SofaScore team form (using IDs from Round 1) + TheSportsDB fallback
        // TheSportsDB is only fetched if neither ESPN nor SofaScore can cover the team.
        const needHomeFallback = !homeEspn?.matches?.length && !ssHomeTeamId && !!homeName;
        const needAwayFallback = !awayEspn?.matches?.length && !ssAwayTeamId && !!awayName;

        const [ssHomeForm, ssAwayForm, homeTsdb, awayTsdb] = await Promise.all([
          ssHomeTeamId
            ? fetch(`/api/sofascore/team-form?teamId=${ssHomeTeamId}`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
          ssAwayTeamId
            ? fetch(`/api/sofascore/team-form?teamId=${ssAwayTeamId}`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
          needHomeFallback
            ? fetch(`/api/team-form?team=${encodeURIComponent(homeName)}&limit=10`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
          needAwayFallback
            ? fetch(`/api/team-form?team=${encodeURIComponent(awayName)}&limit=10`).then(r => r.ok ? r.json() : null).catch(() => null)
            : null,
        ]);

        // Priority: SofaScore (best coverage) > ESPN > TheSportsDB
        const homeRes = ssHomeForm?.matches?.length > 0 ? ssHomeForm
          : homeEspn?.matches?.length > 0 ? homeEspn
          : homeTsdb;
        const awayRes = ssAwayForm?.matches?.length > 0 ? ssAwayForm
          : awayEspn?.matches?.length > 0 ? awayEspn
          : awayTsdb;

        if (homeRes?.matches?.length > 0) setHomeForm({ teamId: homeRes.teamId || homeIdStr, matches: homeRes.matches, form: homeRes.form });
        if (awayRes?.matches?.length > 0) setAwayForm({ teamId: awayRes.teamId || awayIdStr, matches: awayRes.matches, form: awayRes.form });

        let resolvedH2H: any[] = h2hRes?.matches || [];

        // Round 3: ESPN H2H fallback when TheSportsDB returns 0 meetings
        if (resolvedH2H.length === 0 && homeIdStr && awayIdStr) {
          try {
            const espnH2h = await fetch(
              `/api/espn/h2h?homeId=${homeIdStr}&awayId=${awayIdStr}&limit=15`
            ).then(r => r.ok ? r.json() : null).catch(() => null);
            if (espnH2h?.matches?.length > 0) {
              resolvedH2H = espnH2h.matches;
            }
          } catch { /* ESPN H2H fallback failed — keep empty */ }
        }

        // Round 4: SofaScore H2H fallback — cross-references both teams' form histories
        // Best for European meetings ESPN/TheSportsDB both miss.
        if (resolvedH2H.length === 0 && ssEventId && ssHomeTeamId && ssAwayTeamId) {
          try {
            const ssH2h = await fetch(
              `/api/sofascore/h2h?eventId=${ssEventId}&homeTeamId=${ssHomeTeamId}&awayTeamId=${ssAwayTeamId}`
            ).then(r => r.ok ? r.json() : null).catch(() => null);
            if (ssH2h?.matches?.length > 0) {
              resolvedH2H = ssH2h.matches;
            }
          } catch { /* SofaScore H2H fallback failed */ }
        }

        // Bonus: if SofaScore form was fetched but TSDB/ESPN H2H is still empty,
        // extract H2H from the home team's SofaScore event list.
        if (resolvedH2H.length === 0 && ssHomeForm?.allEvents && ssAwayTeamId) {
          const h2hFromForm = (ssHomeForm.allEvents as any[]).filter((m: any) =>
            m.home_team_id === String(ssAwayTeamId) ||
            m.away_team_id === String(ssAwayTeamId)
          );
          if (h2hFromForm.length > 0) resolvedH2H = h2hFromForm;
        }

        setH2HMatches(resolvedH2H);
      } catch (err) {
        console.error('Error fetching team form:', err);
      } finally {
        setFormLoading(false);
      }
    }
    fetchForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.teams?.home?.name, match.teams?.away?.name, match.fixture?.date]);

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
    offsides: getStatValue(match.statistics, match.teams?.home?.name, 'offsides'),
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
    offsides: getStatValue(match.statistics, match.teams?.away?.name, 'offsides'),
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
        <div className="sticky top-[88px] z-10 bg-background/95 backdrop-blur-sm border-b border-accent-cyan/20 px-4 pt-3 pb-0 flex gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('stats')}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
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
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === 'history'
                ? 'bg-accent-cyan/10 text-accent-cyan border-b-2 border-accent-cyan'
                : 'text-text-muted hover:text-white hover:bg-glass-light'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Previous
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === 'predictions'
                ? 'bg-accent-cyan/10 text-accent-cyan border-b-2 border-accent-cyan'
                : 'text-text-muted hover:text-white hover:bg-glass-light'
            }`}
          >
            <Target className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Predictions
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">

          {/* ===== STATISTICS TAB ===== */}
          {activeTab === 'stats' && (
            <>
              {/* Match Events & Momentum (top) */}
              <MomentumSection homeStats={homeStats} awayStats={awayStats} match={match} />

              {/* Live Statistics */}
              <div className="space-y-4">
                <StatRow label="Possession" home={homeStats.possession} away={awayStats.possession} unit="%" compare={true} />
                <StatRow label="Shots on Target" home={homeStats.shotsOnTarget} away={awayStats.shotsOnTarget} compare={true} />
                <StatRow label="Shots Off Target" home={homeStats.shotsOffTarget} away={awayStats.shotsOffTarget} compare={true} />
                <StatRow label="Total Shots" home={homeStats.shotsOnTarget + homeStats.shotsOffTarget} away={awayStats.shotsOnTarget + awayStats.shotsOffTarget} compare={true} />
                <StatRow label="Attacks" home={homeStats.attacks} away={awayStats.attacks} compare={true} />
                <StatRow label="Dangerous Attacks" home={homeStats.dangerousAttacks} away={awayStats.dangerousAttacks} compare={true} />
                <StatRow label="Corners" home={homeStats.corners} away={awayStats.corners} compare={true} />
                <StatRow label="Fouls" home={homeStats.fouls} away={awayStats.fouls} compare={true} />
                <StatRow label="Offsides" home={homeStats.offsides} away={awayStats.offsides} compare={true} />
                <StatRow label="Yellow Cards" home={homeStats.yellowCards} away={awayStats.yellowCards} compare={true} />
                <StatRow label="Red Cards" home={homeStats.redCards} away={awayStats.redCards} compare={false} />
              </div>

              {/* Odds Section */}
              {(match as any).odds && (
                <BettingOddsSection
                  odds={(match as any).odds}
                  homeName={match.teams?.home?.name || 'Home'}
                  awayName={match.teams?.away?.name || 'Away'}
                />
              )}
            </>
          )}

          {/* ===== PREVIOUS GAMES TAB ===== */}
          {activeTab === 'history' && (
            <UnifiedPreviousGames
              match={match}
              homeForm={homeForm}
              awayForm={awayForm}
              h2hMatches={h2hMatches}
              loading={formLoading}
            />
          )}

          {/* ===== PREDICTIONS TAB ===== */}
          {activeTab === 'predictions' && (
            <MatchPredictionsWrapper match={match} />
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

interface MatchEvent {
  minute: number;
  period: number;
  type: string;
  teamId: string | null;
  teamName: string | null;
  player: string | null;
  playerOut: string | null;
  isScoring: boolean;
  text: string;
}

/**
 * Momentum Section - Professional event strip + stat momentum gauge
 * Shows: match events (goals/cards/subs) as compact rows, momentum bar from stats
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

  const hasEvents = events.length > 0;
  const hasStats = match.statistics && match.statistics.length > 0;

  // Filter to key events only (goals, cards, subs, corners - not shots)
  const keyEvents = events.filter(e =>
    ['goal', 'penalty-goal', 'own-goal', 'penalty-miss', 'yellow-card', 'red-card', 'substitution', 'corner'].includes(e.type)
  ).sort((a, b) => a.minute - b.minute);

  // Calculate goals by half from events
  const goalEvents = events.filter(e => e.isScoring);
  const homeGoals1H = goalEvents.filter(e => e.teamId === homeId && e.period === 1).length;
  const awayGoals1H = goalEvents.filter(e => e.teamId !== homeId && e.teamId !== null && e.period === 1).length;
  const homeGoals2H = goalEvents.filter(e => e.teamId === homeId && e.period === 2).length;
  const awayGoals2H = goalEvents.filter(e => e.teamId !== homeId && e.teamId !== null && e.period === 2).length;
  const hasGoalsByHalf = goalEvents.length > 0;

  if (!hasEvents && !hasStats && !eventsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-purple" />
          <h3 className="text-lg font-bold text-white">Match Events</h3>
        </div>
        <div className="rounded-lg p-4 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
          <div className="text-xs text-text-muted">Match data not yet available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Goals by Half (calculated from events) */}
      {hasGoalsByHalf && (
        <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <Clock className="w-4 h-4 text-accent-amber" />
            <span className="text-xs font-bold text-white">Goals by Half</span>
          </div>
          <div className="grid grid-cols-2 gap-0 px-4 pb-3">
            <div className="text-center border-r border-white/10 pr-3">
              <div className="text-[10px] text-text-muted mb-1">First Half</div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-lg font-bold text-accent-cyan">{homeGoals1H}</span>
                <span className="text-xs text-text-muted">-</span>
                <span className="text-lg font-bold text-accent-blue">{awayGoals1H}</span>
              </div>
            </div>
            <div className="text-center pl-3">
              <div className="text-[10px] text-text-muted mb-1">Second Half</div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-lg font-bold text-accent-cyan">{homeGoals2H}</span>
                <span className="text-xs text-text-muted">-</span>
                <span className="text-lg font-bold text-accent-blue">{awayGoals2H}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Events Strip */}
      {eventsLoading ? (
        <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] p-4">
          <div className="text-xs text-text-muted animate-pulse text-center">Loading match events...</div>
        </div>
      ) : keyEvents.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-[11px] font-bold text-accent-cyan truncate max-w-[35%]">{homeName}</span>
            <span className="text-[10px] text-text-muted uppercase tracking-wide">Match Events</span>
            <span className="text-[11px] font-bold text-accent-blue truncate max-w-[35%] text-right">{awayName}</span>
          </div>

          <div className="divide-y divide-white/5">
            {keyEvents.map((evt, i) => {
              const isHome = evt.teamId === homeId;
              return (
                <EventRow key={i} event={evt} isHome={isHome} />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Stat Momentum Gauge */}
      {hasStats && (
        <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <Activity className="w-4 h-4 text-accent-purple" />
            <span className="text-xs font-bold text-white">Match Momentum</span>
          </div>
          <StatMomentumGauge homeStats={homeStats} awayStats={awayStats} />
        </div>
      )}
    </div>
  );
}

/** Compact event row - professional SofaScore-style */
function EventRow({ event, isHome }: { event: MatchEvent; isHome: boolean }) {
  let icon: React.ReactNode = null;
  let label = event.player || event.text || '';
  let extraLabel = '';

  switch (event.type) {
    case 'goal':
      icon = (
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.5" fill="white" stroke="#333" strokeWidth="0.8" />
          <path d="M8 2.5 L9.2 5 L12 5.3 L10 7.5 L10.8 10.5 L8 9 L5.2 10.5 L6 7.5 L4 5.3 L6.8 5 Z"
            fill="none" stroke="#444" strokeWidth="0.6" />
        </svg>
      );
      break;
    case 'penalty-goal':
      icon = (
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.5" fill="white" stroke="#333" strokeWidth="0.8" />
          <text x="8" y="10.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#333">P</text>
        </svg>
      );
      extraLabel = '(pen)';
      break;
    case 'own-goal':
      icon = (
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8" />
          <text x="8" y="10.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">OG</text>
        </svg>
      );
      extraLabel = '(o.g.)';
      break;
    case 'penalty-miss':
      icon = (
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.5" fill="#666" stroke="#444" strokeWidth="0.8" />
          <line x1="5" y1="5" x2="11" y2="11" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="5" x2="5" y2="11" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
      extraLabel = '(pen missed)';
      break;
    case 'yellow-card':
      icon = <div className="w-2.5 h-3.5 rounded-[1px] bg-yellow-400 shadow-sm" />;
      break;
    case 'red-card':
      icon = <div className="w-2.5 h-3.5 rounded-[1px] bg-red-500 shadow-sm" />;
      break;
    case 'corner':
      icon = <span className="text-[12px] leading-none">🚩</span>;
      break;
    case 'substitution':
      icon = (
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-green-400 font-bold leading-none">{'\u25B2'}</span>
          <span className="text-[10px] text-red-400 font-bold leading-none">{'\u25BC'}</span>
        </div>
      );
      // Show "PlayerIn / PlayerOut" for substitutions
      if (event.playerOut) {
        const inName = label.length > 14 ? label.substring(0, 13) + '.' : label;
        const outName = event.playerOut.length > 14 ? event.playerOut.substring(0, 13) + '.' : event.playerOut;
        label = inName;
        extraLabel = `↓ ${outName}`;
      }
      break;
  }

  // Truncate long names (non-sub events)
  if (event.type !== 'substitution' && label.length > 22) label = label.substring(0, 20) + '..';

  return (
    <div className="flex items-center px-4 py-1.5 text-[11px]">
      {/* Home side (left-aligned) */}
      {isHome ? (
        <>
          <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
            <span className="text-white truncate">{label}</span>
            {extraLabel && <span className="text-text-muted text-[9px] shrink-0">{extraLabel}</span>}
            <div className="shrink-0 w-4 flex justify-center">{icon}</div>
          </div>
          <div className="w-10 text-center text-[10px] font-bold text-accent-cyan shrink-0">{event.minute}&apos;</div>
          <div className="flex-1" />
        </>
      ) : (
        <>
          <div className="flex-1" />
          <div className="w-10 text-center text-[10px] font-bold text-accent-blue shrink-0">{event.minute}&apos;</div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="shrink-0 w-4 flex justify-center">{icon}</div>
            <span className="text-white truncate">{label}</span>
            {extraLabel && <span className="text-text-muted text-[9px] shrink-0">{extraLabel}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** Rich visual momentum gauge: possession wave + shot symbols + danger bars */
function StatMomentumGauge({ homeStats, awayStats }: { homeStats: Record<string, number>; awayStats: Record<string, number> }) {
  const categories = [
    { label: 'Possession', home: homeStats.possession, away: awayStats.possession, weight: 0.25 },
    { label: 'Shots on Target', home: homeStats.shotsOnTarget, away: awayStats.shotsOnTarget, weight: 0.25 },
    { label: 'Dangerous Attacks', home: homeStats.dangerousAttacks, away: awayStats.dangerousAttacks, weight: 0.25 },
    { label: 'Total Shots', home: homeStats.shotsOnTarget + homeStats.shotsOffTarget, away: awayStats.shotsOnTarget + awayStats.shotsOffTarget, weight: 0.15 },
    { label: 'Corners', home: homeStats.corners, away: awayStats.corners, weight: 0.10 },
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

  // Possession
  const posTotal = homeStats.possession + awayStats.possession;
  const homePosPercent = posTotal > 0 ? Math.round((homeStats.possession / posTotal) * 100) : 50;
  const awayPosPercent = 100 - homePosPercent;

  // Shots
  const homeShotOn = homeStats.shotsOnTarget || 0;
  const homeShotOff = homeStats.shotsOffTarget || 0;
  const awayShotOn = awayStats.shotsOnTarget || 0;
  const awayShotOff = awayStats.shotsOffTarget || 0;

  // Dangerous attacks — scale bar height relative to max (min 4px, max 32px)
  const maxDanger = Math.max(homeStats.dangerousAttacks || 0, awayStats.dangerousAttacks || 0, 1);
  const homeDangerH = Math.max(4, Math.round((homeStats.dangerousAttacks / maxDanger) * 32));
  const awayDangerH = Math.max(4, Math.round((awayStats.dangerousAttacks / maxDanger) * 32));

  const momentumColor = overall > 10 ? 'text-accent-cyan' : overall < -10 ? 'text-accent-blue' : 'text-accent-yellow';

  return (
    <div className="px-4 pb-4 pt-2 border-t border-white/8 space-y-3">

      {/* ── Possession wave bar ── */}
      <div>
        <div className="flex justify-between text-[9px] text-text-muted mb-1">
          <span>Possession</span>
          <span className="font-bold text-accent-cyan">{homeStats.possession || 0}%</span>
          <span className="font-bold text-accent-blue">{awayStats.possession || 0}%</span>
        </div>
        <div className="relative h-5 rounded-full overflow-hidden bg-white/5 flex">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${homePosPercent}%`,
              background: 'linear-gradient(90deg, rgba(34,211,238,0.7) 0%, rgba(34,211,238,0.35) 100%)'
            }}
          />
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${awayPosPercent}%`,
              background: 'linear-gradient(270deg, rgba(59,130,246,0.7) 0%, rgba(59,130,246,0.35) 100%)'
            }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/25" />
          {/* Percentage labels inside bar */}
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white/80">{homePosPercent}%</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white/80">{awayPosPercent}%</span>
        </div>
      </div>

      {/* ── Shot symbols: on-target (●) and off-target (○) ── */}
      <div>
        <div className="text-[9px] text-text-muted mb-1.5">Shots</div>
        <div className="flex items-center gap-2">
          {/* Home shots (right-aligned toward center) */}
          <div className="flex-1 flex items-center justify-end gap-0.5 flex-wrap-reverse">
            {Array.from({ length: homeShotOn }).map((_, i) => (
              <span key={`hon-${i}`} title="On target" className="text-accent-cyan text-[11px] leading-none">●</span>
            ))}
            {Array.from({ length: homeShotOff }).map((_, i) => (
              <span key={`hoff-${i}`} title="Off target" className="text-accent-cyan/35 text-[11px] leading-none">○</span>
            ))}
          </div>
          {/* Center divider with label */}
          <div className="shrink-0 flex flex-col items-center gap-0.5">
            <span className="text-[8px] text-text-muted">on</span>
            <div className="w-px h-4 bg-white/20" />
            <span className="text-[8px] text-text-muted">off</span>
          </div>
          {/* Away shots (left-aligned from center) */}
          <div className="flex-1 flex items-center justify-start gap-0.5 flex-wrap">
            {Array.from({ length: awayShotOn }).map((_, i) => (
              <span key={`aon-${i}`} title="On target" className="text-accent-blue text-[11px] leading-none">●</span>
            ))}
            {Array.from({ length: awayShotOff }).map((_, i) => (
              <span key={`aoff-${i}`} title="Off target" className="text-accent-blue/35 text-[11px] leading-none">○</span>
            ))}
          </div>
        </div>
        {/* Shot count labels */}
        <div className="flex justify-between text-[9px] mt-1">
          <span className="text-accent-cyan font-bold">{homeShotOn + homeShotOff} shots ({homeShotOn} on)</span>
          <span className="text-accent-blue font-bold">{awayShotOn + awayShotOff} shots ({awayShotOn} on)</span>
        </div>
      </div>

      {/* ── Dangerous attacks up/down bars ── */}
      {(homeStats.dangerousAttacks > 0 || awayStats.dangerousAttacks > 0) && (
        <div>
          <div className="text-[9px] text-text-muted mb-1.5">Dangerous Attacks</div>
          <div className="flex items-end justify-center gap-2 h-10">
            {/* Home bar (grows upward, aligned right of center) */}
            <div className="flex flex-col items-end justify-end flex-1">
              <span className="text-[9px] font-bold text-accent-cyan mb-0.5">{homeStats.dangerousAttacks}</span>
              <div className="w-full max-w-[80px] ml-auto rounded-t transition-all duration-700 bg-accent-cyan/60"
                style={{ height: `${homeDangerH}px` }} />
            </div>
            {/* Center label */}
            <div className="shrink-0 flex flex-col items-center justify-end gap-0.5 pb-0.5">
              <span className="text-[8px] text-text-muted">⚡</span>
            </div>
            {/* Away bar */}
            <div className="flex flex-col items-start justify-end flex-1">
              <span className="text-[9px] font-bold text-accent-blue mb-0.5">{awayStats.dangerousAttacks}</span>
              <div className="w-full max-w-[80px] mr-auto rounded-t transition-all duration-700 bg-accent-blue/60"
                style={{ height: `${awayDangerH}px` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Overall momentum score ── */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/8">
        <div className="flex-1 relative h-2 rounded-full bg-white/5">
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
            style={{
              left: overall >= 0 ? '50%' : `${50 + overall / 2}%`,
              width: `${Math.abs(overall) / 2}%`,
              minWidth: 2,
              background: overall >= 0
                ? 'linear-gradient(90deg, transparent, rgba(34,211,238,0.8))'
                : 'linear-gradient(270deg, transparent, rgba(59,130,246,0.8))'
            }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
        </div>
        <span className="text-[9px] text-text-muted shrink-0">Momentum</span>
        <span className={`text-[11px] font-bold shrink-0 ${momentumColor}`}>
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
/** Returns true when a league name belongs to a UEFA/continental competition */
function isEuropeanComp(leagueName?: string | null): boolean {
  if (!leagueName) return false;
  const l = leagueName.toLowerCase();
  return l.includes('champions') || l.includes('europa') || l.includes('conference') ||
    l.includes('ucl') || l.includes('uel') || l.includes('uecl') || l.includes('uefa') ||
    l.includes('cup') && (l.includes('inter') || l.includes('continental'));
}

function getMatchResult(match: RecentMatchData, teamId: string): 'W' | 'D' | 'L' {
  const isHome = match.home_team_id === teamId;
  const teamScore = isHome ? match.home_score : match.away_score;
  const opponentScore = isHome ? match.away_score : match.home_score;
  if (teamScore > opponentScore) return 'W';
  if (teamScore === opponentScore) return 'D';
  return 'L';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

// TeamFormBox removed - replaced by UnifiedPreviousGames

/**
 * Expanded stats panel - fetches stats on-demand from ESPN summary endpoint.
 * For TheSportsDB matches (id starts with 'tsdb_'), ESPN lookup is skipped and
 * inline stats + venue/season metadata are shown instead.
 */
function ExpandedMatchStats({ match }: { match: RecentMatchData }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  // TheSportsDB matches have prefixed IDs — ESPN cannot find them
  const isTsdbMatch = match.id?.toString().startsWith('tsdb_');

  useEffect(() => {
    async function fetchStats() {
      if (!match.id) { setLoading(false); return; }
      try {
        // ────────────────────────────────────────────────────────
        // Step 1: Resolve SofaScore event + halftime via find-event
        // (skip if we already have sofascoreEventId in raw_data)
        // ────────────────────────────────────────────────────────
        let sofascoreEventId: number | null = match.raw_data?.sofascoreEventId ?? null;
        let period1Home: number | undefined = match.raw_data?.period1Home;
        let period1Away: number | undefined = match.raw_data?.period1Away;

        if (!sofascoreEventId && match.home_team_name && match.away_team_name && match.date) {
          try {
            const matchDate = match.date.split('T')[0];
            const findRes = await fetch(
              `/api/sofascore/find-event?home=${encodeURIComponent(match.home_team_name)}&away=${encodeURIComponent(match.away_team_name)}&date=${matchDate}`
            );
            if (findRes.ok) {
              const findData = await findRes.json();
              if (findData.found) {
                sofascoreEventId = findData.eventId;
                if (findData.period1Home != null) period1Home = findData.period1Home;
                if (findData.period1Away != null) period1Away = findData.period1Away;
              }
            }
          } catch { /* non-fatal — fall through */ }
        }

        // ────────────────────────────────────────────────────────
        // Step 2: Fetch SofaScore stats (richest: xG, big chances,
        // pass accuracy, halftime scores embedded)
        // ────────────────────────────────────────────────────────
        if (sofascoreEventId) {
          const qp = new URLSearchParams({ eventId: String(sofascoreEventId) });
          if (period1Home != null) qp.set('halftimeHome', String(period1Home));
          if (period1Away != null) qp.set('halftimeAway', String(period1Away));
          const ssRes = await fetch(`/api/sofascore/match-stats?${qp.toString()}`);
          if (ssRes.ok) {
            const ssData = await ssRes.json();
            if (ssData.found && ssData.stats) {
              setStats(ssData.stats);
              setLoading(false);
              return; // SofaScore succeeded — skip ESPN
            }
          }
        }

        // ────────────────────────────────────────────────────────
        // Step 3: Inline TheSportsDB data (no ESPN fallback needed)
        // If SofaScore found only halftime but no full stats, still
        // store the half scores so the panel displays them.
        // ────────────────────────────────────────────────────────
        if (isTsdbMatch) {
          const m = match as any;
          const inlineStats: Record<string, number> = {};
          if (m.home_possession != null) { inlineStats.homePoss = m.home_possession; inlineStats.awayPoss = m.away_possession ?? 0; }
          if (m.home_shots_on_target != null) { inlineStats.homeSoT = m.home_shots_on_target; inlineStats.awaySoT = m.away_shots_on_target ?? 0; }
          if (m.home_corners != null) { inlineStats.homeCorners = m.home_corners; inlineStats.awayCorners = m.away_corners ?? 0; }
          if (m.home_yellow_cards != null) { inlineStats.homeYellow = m.home_yellow_cards; inlineStats.awayYellow = m.away_yellow_cards ?? 0; }
          if (m.home_red_cards != null) { inlineStats.homeRed = m.home_red_cards; inlineStats.awayRed = m.away_red_cards ?? 0; }
          // Inject halftime from SofaScore find-event even if stats unavailable
          if (period1Home != null) inlineStats.homeHalfScore = period1Home;
          if (period1Away != null) inlineStats.awayHalfScore = period1Away;
          if (Object.keys(inlineStats).length > 0) setStats(inlineStats);
          setLoading(false);
          return;
        }

        // ────────────────────────────────────────────────────────
        // Step 4: ESPN fallback for non-TheSportsDB matches
        // ────────────────────────────────────────────────────────
        const leagueCode = match.raw_data?.leagueCode;
        const res = await fetch(`/api/espn/match-stats?eventId=${match.id}${leagueCode ? `&league=${leagueCode}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            // Inject SofaScore halftime scores if ESPN didn't return them
            if (period1Home != null && data.stats.homeHalfScore == null) data.stats.homeHalfScore = period1Home;
            if (period1Away != null && data.stats.awayHalfScore == null) data.stats.awayHalfScore = period1Away;
            setStats(data.stats);
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, isTsdbMatch, match.home_team_name, match.away_team_name, match.date,
      match.raw_data?.sofascoreEventId, match.raw_data?.period1Home, match.raw_data?.period1Away, match.raw_data?.leagueCode]);

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

  // Show halftime if EITHER team's half score was parsed (the missing one defaults to 0)
  const hasHalftime = stats.homeHalfScore != null || stats.awayHalfScore != null;
  const h1Home = stats.homeHalfScore ?? 0;
  const h1Away = stats.awayHalfScore ?? 0;
  const h2Home = Math.max(0, (match.home_score || 0) - h1Home);
  const h2Away = Math.max(0, (match.away_score || 0) - h1Away);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-b px-3 py-3 mb-1 space-y-2 bg-[rgba(15,23,42,0.6)]"
    >
      {/* Score + halftime breakdown */}
      <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
        <span className="truncate font-medium">{match.home_team_name}</span>
        <div className="flex flex-col items-center gap-0.5 px-2">
          <span className="font-bold text-white text-xs">{match.home_score} - {match.away_score}</span>
          {hasHalftime && (
            <div className="flex gap-2 text-[9px] text-text-muted">
              <span className="text-accent-cyan/70">1H: {h1Home}-{h1Away}</span>
              <span>2H: {h2Home}-{h2Away}</span>
            </div>
          )}
        </div>
        <span className="truncate text-right font-medium">{match.away_team_name}</span>
      </div>

      {/* Full-match stats */}
      {(match as any).venue && (
        <div className="text-[9px] text-text-muted text-center -mt-1 mb-1">📍 {(match as any).venue}</div>
      )}
      {stats.homePoss > 0 && <MiniStatRow label="Possession" home={stats.homePoss} away={stats.awayPoss} unit="%" />}
      {(stats.homeSoT > 0 || stats.awaySoT > 0) && <MiniStatRow label="On Target" home={stats.homeSoT} away={stats.awaySoT} />}
      {(stats.homeShots > 0 || stats.awayShots > 0) && <MiniStatRow label="Total Shots" home={stats.homeShots} away={stats.awayShots} />}
      {(stats.homeCorners > 0 || stats.awayCorners > 0) && <MiniStatRow label="Corners" home={stats.homeCorners} away={stats.awayCorners} />}
      {(stats.homeFouls > 0 || stats.awayFouls > 0) && <MiniStatRow label="Fouls" home={stats.homeFouls} away={stats.awayFouls} />}
      {(stats.homeOffsides > 0 || stats.awayOffsides > 0) && <MiniStatRow label="Offsides" home={stats.homeOffsides} away={stats.awayOffsides} />}
      {(stats.homeYellow > 0 || stats.awayYellow > 0) && <MiniStatRow label="Yellow Cards" home={stats.homeYellow} away={stats.awayYellow} />}
      {(stats.homeRed > 0 || stats.awayRed > 0) && <MiniStatRow label="Red Cards" home={stats.homeRed} away={stats.awayRed} />}
      {/* SofaScore-exclusive rich metrics — only shown when SofaScore is the data source */}
      {(stats as any)._source === 'sofascore' && (
        <>
          {((stats as any).homeXg > 0 || (stats as any).awayXg > 0) && (
            <MiniStatRow label="xG" home={parseFloat(((stats as any).homeXg ?? 0).toFixed(2))} away={parseFloat(((stats as any).awayXg ?? 0).toFixed(2))} />
          )}
          {((stats as any).homeBigChances > 0 || (stats as any).awayBigChances > 0) && (
            <MiniStatRow label="Big Chances" home={(stats as any).homeBigChances ?? 0} away={(stats as any).awayBigChances ?? 0} />
          )}
          {((stats as any).homeShotsInBox > 0 || (stats as any).awayShotsInBox > 0) && (
            <MiniStatRow label="Shots In Box" home={(stats as any).homeShotsInBox ?? 0} away={(stats as any).awayShotsInBox ?? 0} />
          )}
          {((stats as any).homePassPct > 0 || (stats as any).awayPassPct > 0) && (
            <MiniStatRow label="Pass Accuracy" home={(stats as any).homePassPct ?? 0} away={(stats as any).awayPassPct ?? 0} unit="%" />
          )}
        </>
      )}
      {(stats as any)._source === 'sofascore' && (
        <div className="text-[9px] text-text-muted text-right mt-1 opacity-50">via SofaScore</div>
      )}
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

/**
 * Unified Previous Games card - single card with Home/H2H/Away tabs
 */
function UnifiedPreviousGames({
  match,
  homeForm,
  awayForm,
  h2hMatches,
  loading,
}: {
  match: LiveMatch;
  homeForm: TeamRecentFormResult | null;
  awayForm: TeamRecentFormResult | null;
  h2hMatches: RecentMatchData[];
  loading: boolean;
}) {
  const [activeSection, setActiveSection] = useState<'home' | 'h2h' | 'away'>('home');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';
  const homeTeamId = homeForm?.teamId || String(match.teams?.home?.id || '');
  const awayTeamId = awayForm?.teamId || String(match.teams?.away?.id || '');
  const homeNameLower = homeName.toLowerCase();

  // Compute H2H summary — use name matching since TheSportsDB uses tsdb_* IDs
  let homeWins = 0, awayWins = 0, draws = 0;
  h2hMatches.forEach(m => {
    // Determine if current home team is listed as home in this historical match
    const mHomeNameLower = m.home_team_name.toLowerCase();
    const isCurrentHomeAtHome =
      mHomeNameLower.includes(homeNameLower.split(' ')[0].toLowerCase()) ||
      homeNameLower.includes(mHomeNameLower.split(' ')[0].toLowerCase());
    if (m.home_score > m.away_score) {
      if (isCurrentHomeAtHome) homeWins++; else awayWins++;
    } else if (m.away_score > m.home_score) {
      if (isCurrentHomeAtHome) awayWins++; else homeWins++;
    } else {
      draws++;
    }
  });

  const [h2hShowAll, setH2hShowAll] = useState(false);

  // Get matches for current tab
  const getDisplayMatches = (): RecentMatchData[] => {
    if (activeSection === 'h2h') return h2hShowAll ? h2hMatches : h2hMatches.slice(0, 10);
    if (activeSection === 'home') return homeForm?.matches?.slice(0, 10) || [];
    return awayForm?.matches?.slice(0, 10) || [];
  };

  const getActiveTeamId = (): string => {
    if (activeSection === 'home') return homeTeamId;
    if (activeSection === 'away') return awayTeamId;
    return homeTeamId; // H2H uses home perspective
  };

  const displayMatches = getDisplayMatches();
  const activeTeamId = getActiveTeamId();

  // Compute form summary for active tab
  const getFormSummary = () => {
    if (activeSection === 'h2h') {
      return { wins: homeWins, draws, losses: awayWins, label: `${homeName} perspective` };
    }
    const form = activeSection === 'home' ? homeForm?.form : awayForm?.form;
    if (!form) return null;
    return { wins: form.wins, draws: form.draws, losses: form.losses, label: `Last ${form.played}` };
  };

  const formSummary = getFormSummary();

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-[rgba(15,23,42,0.85)] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-white/5 rounded" />
          <div className="h-8 bg-white/5 rounded" />
          <div className="h-6 bg-white/5 rounded w-3/4" />
          <div className="h-6 bg-white/5 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => { setActiveSection('home'); setExpandedMatchId(null); }}
          className={`flex-1 py-3 text-center text-xs font-bold transition-colors ${
            activeSection === 'home'
              ? 'bg-accent-cyan/10 text-accent-cyan border-b-2 border-accent-cyan'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="truncate block px-1">{homeName}</span>
          {homeForm && (
            <span className="text-[10px] font-normal opacity-70">{homeForm.form.winRate}%</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setActiveSection('h2h'); setExpandedMatchId(null); }}
          className={`flex-1 py-3 text-center text-xs font-bold transition-colors border-x border-white/10 ${
            activeSection === 'h2h'
              ? 'bg-accent-yellow/10 text-accent-yellow border-b-2 border-accent-yellow'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          H2H
          {h2hMatches.length > 0 && (
            <span className="text-[10px] font-normal opacity-70 ml-1">({h2hMatches.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setActiveSection('away'); setExpandedMatchId(null); }}
          className={`flex-1 py-3 text-center text-xs font-bold transition-colors ${
            activeSection === 'away'
              ? 'bg-accent-blue/10 text-accent-blue border-b-2 border-accent-blue'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="truncate block px-1">{awayName}</span>
          {awayForm && (
            <span className="text-[10px] font-normal opacity-70">{awayForm.form.winRate}%</span>
          )}
        </button>
      </div>

      {/* H2H Summary bar (only in H2H mode) */}
      {activeSection === 'h2h' && h2hMatches.length > 0 && (
        <div className="flex items-center px-4 py-3 border-b border-white/8 bg-white/[0.02]">
          <div className="flex-1 text-center">
            <div className="text-xl font-bold text-accent-cyan">{homeWins}</div>
            <div className="text-[10px] text-text-muted truncate">{homeName}</div>
          </div>
          <div className="text-center px-4">
            <div className="text-xl font-bold text-accent-yellow">{draws}</div>
            <div className="text-[10px] text-text-muted">Draws</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-xl font-bold text-accent-blue">{awayWins}</div>
            <div className="text-[10px] text-text-muted truncate">{awayName}</div>
          </div>
        </div>
      )}

      {/* Form W/D/L badges (for team tabs) */}
      {activeSection !== 'h2h' && formSummary && (() => {
        const activeMatches = (activeSection === 'home' ? homeForm : awayForm)?.matches || [];
        const domMatches = activeMatches.filter(m => !isEuropeanComp(m.league));
        const eurMatches = activeMatches.filter(m => isEuropeanComp(m.league));
        const hasEurOnly = eurMatches.length > 0 && domMatches.length === 0;
        const hasMix = eurMatches.length > 0 && domMatches.length > 0;
        return (
          <div className="border-b border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                {activeMatches.slice(0, 5).map((m, i) => {
                  const tid = activeSection === 'home' ? homeTeamId : awayTeamId;
                  const result = getMatchResult(m, tid);
                  const isEur = isEuropeanComp(m.league);
                  return (
                    <div
                      key={i}
                      title={m.league || ''}
                      className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[9px] relative ${
                        result === 'W' ? 'bg-accent-green/30 text-accent-green'
                          : result === 'D' ? 'bg-accent-yellow/30 text-accent-yellow'
                            : 'bg-accent-red/30 text-accent-red'
                      } ${isEur ? 'ring-1 ring-orange-400/60' : ''}`}
                    >
                      {result}
                    </div>
                  );
                })}
              </div>
              <span className="text-[11px] text-text-secondary">
                <span className="text-accent-green font-bold">W{formSummary.wins}</span>{' '}
                <span className="text-accent-yellow font-bold">D{formSummary.draws}</span>{' '}
                <span className="text-accent-red font-bold">L{formSummary.losses}</span>
              </span>
            </div>
            {/* Competition mix warning */}
            {hasEurOnly && (
              <div className="px-4 pb-2 text-[10px] text-orange-400/80 flex items-center gap-1">
                <span>⚠</span>
                <span>Only European games available — domestic form not fetched yet</span>
              </div>
            )}
            {hasMix && (
              <div className="px-4 pb-2 text-[10px] text-text-muted flex items-center gap-2">
                <span className="text-text-secondary">Competitions:</span>
                <span className="px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">{domMatches.length} domestic</span>
                <span className="px-1.5 py-0.5 rounded bg-orange-400/10 text-orange-400">{eurMatches.length} European</span>
                <span className="opacity-50 text-[9px]">(🟠 = UEFA)</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Match rows */}
      <div className="divide-y divide-white/8">
        {displayMatches.length === 0 ? (
          <div className="text-xs text-text-muted text-center py-6">
            {activeSection === 'h2h' ? 'No head-to-head matches found' : 'No recent matches found'}
          </div>
        ) : (
          displayMatches.map((m, i) => {
            const matchKey = m.id || `${m.date}-${i}`;
            const isExpanded = expandedMatchId === matchKey;

            if (activeSection === 'h2h') {
              // H2H row: use name matching (TheSportsDB uses tsdb_* IDs, not ESPN IDs)
              const mHomeNameLower = m.home_team_name.toLowerCase();
              const isCurrentHomeAtHome =
                mHomeNameLower.includes(homeNameLower.split(' ')[0]) ||
                homeNameLower.includes(mHomeNameLower.split(' ')[0]);
              const homeScore = isCurrentHomeAtHome ? m.home_score : m.away_score;
              const awayScore = isCurrentHomeAtHome ? m.away_score : m.home_score;
              const homeTeamWon = homeScore > awayScore;
              const awayTeamWon = awayScore > homeScore;
              const isDraw = homeScore === awayScore;
              // season/round info from TheSportsDB (stored in raw_data or league field)
              const seasonInfo = (m as any).season ? (m as any).season : '';
              const roundInfo = (m as any).round ? `R${(m as any).round}` : '';

              return (
                <div key={matchKey}>
                  <div
                    onClick={() => setExpandedMatchId(isExpanded ? null : matchKey)}
                    className={`flex items-center gap-2 px-4 py-3 text-[11px] cursor-pointer transition ${
                      isExpanded ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className={`text-[9px] w-[55px] shrink-0 leading-tight ${isEuropeanComp(m.league) ? 'text-orange-400/80' : 'text-text-muted'}`}>
                      <div className="truncate">{m.league || ''}</div>
                      {(seasonInfo || roundInfo) && (
                        <div className="opacity-60">{[seasonInfo, roundInfo].filter(Boolean).join(' ')}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right truncate">
                      <span className={homeTeamWon ? 'text-accent-green font-bold' : 'text-white'}>
                        {m.home_team_name}
                      </span>
                    </div>
                    <span className={`font-bold text-xs px-2 shrink-0 tabular-nums ${
                      isDraw ? 'text-accent-yellow' : homeTeamWon ? 'text-accent-cyan' : 'text-accent-blue'
                    }`}>
                      {homeScore} - {awayScore}
                    </span>
                    <div className="flex-1 min-w-0 truncate">
                      <span className={awayTeamWon ? 'text-accent-green font-bold' : 'text-white'}>
                        {m.away_team_name}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0 w-[46px] text-right">
                      {formatDate(m.date)}
                    </span>
                  </div>
                  {isExpanded && <ExpandedMatchStats match={m} />}
                </div>
              );
            }

            // Team form row: show opponent, venue, result
            const isHome = m.home_team_id === activeTeamId;
            const result = getMatchResult(m, activeTeamId);

            return (
              <div key={matchKey}>
                <div
                  onClick={() => setExpandedMatchId(isExpanded ? null : matchKey)}
                  className={`flex items-center gap-2 px-4 py-3 text-[11px] cursor-pointer transition ${
                    isExpanded ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`text-[9px] w-[50px] shrink-0 truncate ${isEuropeanComp(m.league) ? 'text-orange-400/80' : 'text-text-muted'}`}>
                    {m.league || ''}
                  </span>
                  <span className={`text-[9px] font-bold w-3 shrink-0 ${isHome ? 'text-accent-cyan' : 'text-text-muted'}`}>
                    {isHome ? 'H' : 'A'}
                  </span>
                  <div className="flex-1 min-w-0 text-right truncate">
                    <span className="text-white">{m.home_team_name}</span>
                  </div>
                  <span className={`font-bold text-xs px-2 shrink-0 ${
                    result === 'W' ? 'text-accent-green' : result === 'D' ? 'text-accent-yellow' : 'text-accent-red'
                  }`}>
                    {m.home_score} - {m.away_score}
                  </span>
                  <div className="flex-1 min-w-0 truncate">
                    <span className="text-white">{m.away_team_name}</span>
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0 w-[50px] text-right">
                    {formatDate(m.date)}
                  </span>
                </div>
                {isExpanded && <ExpandedMatchStats match={m} />}
              </div>
            );
          })
        )}
      </div>

      {/* Show more / less for H2H */}
      {activeSection === 'h2h' && h2hMatches.length > 10 && (
        <button
          type="button"
          onClick={() => setH2hShowAll(v => !v)}
          className="w-full py-2 text-[11px] text-text-muted hover:text-white border-t border-white/8 transition"
        >
          {h2hShowAll
            ? `Show less (${h2hMatches.length} total)`
            : `Show all ${h2hMatches.length} meetings`}
        </button>
      )}
    </div>
  );
}
