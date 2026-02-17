'use client';

// ============================================
// TRIGGERED MATCHES HISTORY PAGE
// ============================================
// Groups triggers by match, expandable cards with inline ESPN stats

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Filter as FilterIcon,
  Zap,
  Trophy,
  Calendar,
  RefreshCw,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers } from '@/lib/supabase';
import type { TriggeredMatch } from '@/lib/supabase';

// Group triggers by match_id
interface MatchGroup {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  scoreHome: number | null;
  scoreAway: number | null;
  matchStatus: string;
  latestTriggerAt: string;
  triggers: TriggeredMatch[];
}

function groupByMatch(matches: TriggeredMatch[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();

  for (const m of matches) {
    const key = m.match_id;
    if (!map.has(key)) {
      map.set(key, {
        matchId: key,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        leagueName: m.league_name || '',
        scoreHome: m.score_home,
        scoreAway: m.score_away,
        matchStatus: m.match_status || '',
        latestTriggerAt: m.triggered_at,
        triggers: [],
      });
    }
    const group = map.get(key)!;
    group.triggers.push(m);
    // Keep latest score/status
    if (new Date(m.triggered_at) > new Date(group.latestTriggerAt)) {
      group.latestTriggerAt = m.triggered_at;
      if (m.score_home != null) group.scoreHome = m.score_home;
      if (m.score_away != null) group.scoreAway = m.score_away;
      if (m.match_status) group.matchStatus = m.match_status;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestTriggerAt).getTime() - new Date(a.latestTriggerAt).getTime()
  );
}

export default function HistoryTriggeredPage() {
  const router = useRouter();

  const [triggeredMatches, setTriggeredMatches] = useState<TriggeredMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('7d');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const itemsPerPage = 50;

  const loadTriggeredMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;

      const params = new URLSearchParams({
        user_id: currentUser.id,
        range: timeRange,
        limit: String(itemsPerPage),
        offset: String(page * itemsPerPage),
      });
      const res = await fetch(`/api/triggered-matches/list?${params}`);
      const result = await res.json();
      const matches: TriggeredMatch[] = result.matches || [];

      if (page === 0 || isRefresh) {
        setTriggeredMatches(matches);
      } else {
        setTriggeredMatches(prev => [...prev, ...matches]);
      }

      setHasMore(matches.length === itemsPerPage);
    } catch (err) {
      console.error('Error loading triggered matches:', err);
      setError('Failed to load triggered matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, timeRange]);

  useEffect(() => {
    loadTriggeredMatches();
  }, [loadTriggeredMatches]);

  const handleTimeRangeChange = (range: typeof timeRange) => {
    setTimeRange(range);
    setPage(0);
    setExpandedMatch(null);
  };

  const handleRefresh = () => {
    setPage(0);
    setExpandedMatch(null);
    loadTriggeredMatches(true);
  };

  const getTimeSince = (triggeredAt: string): string => {
    const diffMs = Date.now() - new Date(triggeredAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(diffMs / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  };

  const matchGroups = groupByMatch(triggeredMatches);

  return (
    <AuthWrapper>
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-glass-light rounded-lg transition shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                  Triggered History
                </h1>
                <p className="text-xs text-text-muted">Matches that triggered your filters</p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 rounded-lg hover:bg-glass-light transition disabled:opacity-50 shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-text-secondary ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* TIME FILTER - compact pills */}
          <div className="flex gap-1.5 flex-wrap">
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  timeRange === range
                    ? 'bg-accent-cyan text-black'
                    : 'bg-glass-light text-text-muted hover:text-white'
                }`}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>

          {/* QUICK STATS */}
          {matchGroups.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2.5 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
                <div className="text-[10px] text-text-muted">Matches</div>
                <div className="text-lg font-bold text-accent-cyan">{matchGroups.length}</div>
              </div>
              <div className="rounded-lg p-2.5 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
                <div className="text-[10px] text-text-muted">Triggers</div>
                <div className="text-lg font-bold text-accent-green">{triggeredMatches.length}</div>
              </div>
              <div className="rounded-lg p-2.5 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
                <div className="text-[10px] text-text-muted">Filters</div>
                <div className="text-lg font-bold text-accent-purple">
                  {new Set(triggeredMatches.map(m => m.filter_id)).size}
                </div>
              </div>
            </div>
          )}

          {/* MATCH LIST */}
          {loading && triggeredMatches.length === 0 ? (
            <div className="rounded-lg p-8 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
              <Zap className="w-6 h-6 text-accent-cyan mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-text-muted">Loading...</p>
            </div>
          ) : matchGroups.length === 0 ? (
            <div className="rounded-lg p-8 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
              <Trophy className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-sm text-text-secondary">
                No triggered matches {timeRange !== 'all' ? `in the last ${timeRange}` : ''}
              </p>
              <p className="text-[11px] text-text-muted mt-1.5 max-w-xs mx-auto">
                Keep the app open during match times. Your active filters will trigger automatically.
              </p>
              {timeRange !== 'all' && (
                <button
                  onClick={() => handleTimeRangeChange('all')}
                  className="text-accent-cyan text-xs mt-3 hover:underline"
                >
                  Show All Time
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {matchGroups.map((group) => (
                <MatchGroupCard
                  key={group.matchId}
                  group={group}
                  isExpanded={expandedMatch === group.matchId}
                  onToggle={() => setExpandedMatch(
                    expandedMatch === group.matchId ? null : group.matchId
                  )}
                  getTimeSince={getTimeSince}
                />
              ))}
            </div>
          )}

          {/* LOAD MORE */}
          {hasMore && !loading && (
            <button
              onClick={() => setPage(prev => prev + 1)}
              className="w-full py-2.5 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.85)] text-sm font-semibold text-accent-cyan hover:bg-glass-light transition"
            >
              Load More
            </button>
          )}
        </div>
      </div>
    </AuthWrapper>
  );
}

// ============================================
// MATCH GROUP CARD (expandable)
// ============================================

function MatchGroupCard({
  group,
  isExpanded,
  onToggle,
  getTimeSince,
}: {
  group: MatchGroup;
  isExpanded: boolean;
  onToggle: () => void;
  getTimeSince: (t: string) => string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
      {/* Collapsed card header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-3 sm:p-4 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          {/* Score */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-lg font-bold text-accent-cyan">{group.scoreHome ?? 0}</span>
            <span className="text-xs text-text-muted">-</span>
            <span className="text-lg font-bold text-accent-blue">{group.scoreAway ?? 0}</span>
          </div>

          {/* Teams + League */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-white truncate">
                {group.homeTeam}
              </span>
              <span className="text-[10px] text-text-muted shrink-0">vs</span>
              <span className="font-semibold text-sm text-white truncate">
                {group.awayTeam}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-text-muted truncate">{group.leagueName}</span>
              <span className="text-[10px] text-accent-blue">{getTimeSince(group.latestTriggerAt)}</span>
            </div>
          </div>

          {/* Filter count badge + chevron */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full">
              {group.triggers.length} {group.triggers.length === 1 ? 'filter' : 'filters'}
            </span>
            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t border-white/8"
        >
          {/* Triggered filters list */}
          <div className="px-3 sm:px-4 py-2 space-y-1.5">
            <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1">
              Triggered Filters
            </div>
            {group.triggers.map((trigger, i) => (
              <div
                key={trigger.id || i}
                className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-white/3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FilterIcon className="w-3 h-3 text-accent-purple shrink-0" />
                  <span className="text-xs text-white font-medium truncate">
                    {trigger.filter_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px] text-text-muted">
                  {trigger.match_time != null && (
                    <span className="bg-accent-cyan/10 text-accent-cyan px-1.5 py-0.5 rounded font-semibold">
                      {trigger.match_time}&apos;
                    </span>
                  )}
                  <span>
                    {new Date(trigger.triggered_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Inline ESPN stats */}
          <InlineMatchStats matchId={group.matchId} leagueName={group.leagueName} />
        </motion.div>
      )}
    </div>
  );
}

// ============================================
// INLINE MATCH STATS (fetched on expand)
// ============================================

interface ESPNStats {
  homePoss: number;
  awayPoss: number;
  homeSoT: number;
  awaySoT: number;
  homeShots: number;
  awayShots: number;
  homeCorners: number;
  awayCorners: number;
  homeYellow: number;
  awayYellow: number;
  homeRed: number;
  awayRed: number;
  homeFouls: number;
  awayFouls: number;
  homeOffsides: number;
  awayOffsides: number;
}

const LEAGUE_MAP: Record<string, string> = {
  'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Serie A': 'ita.1',
  'Bundesliga': 'ger.1', 'Ligue 1': 'fra.1', 'MLS': 'usa.1',
  'Champions League': 'uefa.champions', 'Europa League': 'uefa.europa',
  'Turkish Super Lig': 'tur.1', 'Super Lig': 'tur.1',
  'Eredivisie': 'ned.1', 'Primeira Liga': 'por.1', 'Scottish Premiership': 'sco.1',
};

function InlineMatchStats({ matchId, leagueName }: { matchId: string; leagueName: string }) {
  const [stats, setStats] = useState<ESPNStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const leagueCode = LEAGUE_MAP[leagueName] || '';
    const leagueParam = leagueCode ? `&league=${leagueCode}` : '';

    fetch(`/api/espn/match-stats?eventId=${matchId}${leagueParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data?.stats) setStats(data.stats);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [matchId, leagueName]);

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-3 border-t border-white/5">
        <div className="text-[10px] text-text-muted animate-pulse">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="px-3 sm:px-4 py-3 border-t border-white/5">
        <div className="text-[10px] text-text-muted">Statistics not available</div>
      </div>
    );
  }

  const rows: { label: string; home: number; away: number; unit?: string }[] = [];
  if (stats.homePoss > 0) rows.push({ label: 'Possession', home: stats.homePoss, away: stats.awayPoss, unit: '%' });
  if (stats.homeSoT + stats.awaySoT > 0) rows.push({ label: 'Shots on Target', home: stats.homeSoT, away: stats.awaySoT });
  if (stats.homeShots + stats.awayShots > 0) rows.push({ label: 'Total Shots', home: stats.homeShots, away: stats.awayShots });
  if (stats.homeCorners + stats.awayCorners > 0) rows.push({ label: 'Corners', home: stats.homeCorners, away: stats.awayCorners });
  if (stats.homeYellow + stats.awayYellow > 0) rows.push({ label: 'Yellow Cards', home: stats.homeYellow, away: stats.awayYellow });
  if (stats.homeRed + stats.awayRed > 0) rows.push({ label: 'Red Cards', home: stats.homeRed, away: stats.awayRed });
  if (stats.homeFouls + stats.awayFouls > 0) rows.push({ label: 'Fouls', home: stats.homeFouls, away: stats.awayFouls });
  if (stats.homeOffsides + stats.awayOffsides > 0) rows.push({ label: 'Offsides', home: stats.homeOffsides, away: stats.awayOffsides });

  if (rows.length === 0) {
    return (
      <div className="px-3 sm:px-4 py-3 border-t border-white/5">
        <div className="text-[10px] text-text-muted">No statistics recorded</div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-3 border-t border-white/5 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart3 className="w-3 h-3 text-accent-cyan" />
        <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Match Statistics</span>
      </div>
      {rows.map(row => {
        const total = row.home + row.away;
        const homeP = total > 0 ? Math.round((row.home / total) * 100) : 50;
        const homeLeads = row.home > row.away;
        const awayLeads = row.away > row.home;

        return (
          <div key={row.label} className="flex items-center gap-2 text-[11px]">
            <span className={`w-7 text-right font-bold ${homeLeads ? 'text-accent-cyan' : 'text-text-secondary'}`}>
              {row.home}{row.unit || ''}
            </span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div
                className={`h-full rounded-l-full ${homeLeads ? 'bg-accent-cyan' : 'bg-accent-cyan/30'}`}
                style={{ width: `${homeP}%` }}
              />
              <div
                className={`h-full rounded-r-full ${awayLeads ? 'bg-accent-blue' : 'bg-accent-blue/30'}`}
                style={{ width: `${100 - homeP}%` }}
              />
            </div>
            <span className={`w-7 text-left font-bold ${awayLeads ? 'text-accent-blue' : 'text-text-secondary'}`}>
              {row.away}{row.unit || ''}
            </span>
            <span className="text-text-muted w-[72px] text-[9px] truncate">{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}
