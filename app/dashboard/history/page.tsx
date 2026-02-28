'use client';

// ============================================
// TRIGGERED MATCHES HISTORY PAGE
// ============================================
// Groups triggers by match, expandable cards with LivePick-style stats
// Clickable filters show trigger context (score at trigger time, minute)

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Filter as FilterIcon,
  Zap,
  Trophy,
  RefreshCw,
  ChevronDown,
  BarChart3,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers } from '@/lib/supabase';
import type { TriggeredMatch } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

type ViewMode = 'matches' | 'filters';

interface MatchGroup {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  scoreHome: number | null;
  scoreAway: number | null;
  matchStatus: string;
  latestTriggerAt: string;
  // Deduplicated: one entry per filter_id
  triggers: TriggeredMatch[];
}

interface FilterGroup {
  filterId: string;
  filterName: string;
  matches: TriggeredMatch[];
  latestTriggerAt: string;
  matchCount: number;
}

interface FinalResult {
  homeTeam: string;
  awayTeam: string;
  scoreHome: number | null;
  scoreAway: number | null;
  status: string;
  statusLong: string;
  loaded: boolean;
}

interface ESPNStats {
  homePoss: number; awayPoss: number;
  homeSoT: number; awaySoT: number;
  homeShots: number; awayShots: number;
  homeCorners: number; awayCorners: number;
  homeYellow: number; awayYellow: number;
  homeRed: number; awayRed: number;
  homeFouls: number; awayFouls: number;
  homeOffsides: number; awayOffsides: number;
}

// ============================================
// HELPERS
// ============================================

const LEAGUE_MAP: Record<string, string> = {
  'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Serie A': 'ita.1',
  'Bundesliga': 'ger.1', 'Ligue 1': 'fra.1', 'MLS': 'usa.1',
  'Champions League': 'uefa.champions', 'Europa League': 'uefa.europa',
  'Turkish Super Lig': 'tur.1', 'Super Lig': 'tur.1',
  'Eredivisie': 'ned.1', 'Primeira Liga': 'por.1', 'Scottish Premiership': 'sco.1',
};

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

    // Deduplicate: only keep first trigger per filter_id
    const alreadyHasFilter = group.triggers.some(t => t.filter_id === m.filter_id);
    if (!alreadyHasFilter) {
      group.triggers.push(m);
    }

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

function groupByFilter(matches: TriggeredMatch[]): FilterGroup[] {
  // Only show matches from last 12 hours
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  const recent = matches.filter(m => new Date(m.triggered_at).getTime() > twelveHoursAgo);

  const map = new Map<string, FilterGroup>();

  for (const m of recent) {
    const key = m.filter_id;
    if (!map.has(key)) {
      map.set(key, {
        filterId: key,
        filterName: m.filter_name,
        matches: [],
        latestTriggerAt: m.triggered_at,
        matchCount: 0,
      });
    }
    const group = map.get(key)!;

    // Deduplicate: only keep first trigger per match_id within a filter
    const alreadyHasMatch = group.matches.some(t => t.match_id === m.match_id);
    if (!alreadyHasMatch) {
      group.matches.push(m);
      group.matchCount++;
    }

    // Track latest
    if (new Date(m.triggered_at) > new Date(group.latestTriggerAt)) {
      group.latestTriggerAt = m.triggered_at;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestTriggerAt).getTime() - new Date(a.latestTriggerAt).getTime()
  );
}

function getTimeSince(triggeredAt: string): string {
  const diffMs = Date.now() - new Date(triggeredAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

// ============================================
// MAIN PAGE
// ============================================

export default function HistoryTriggeredPage() {
  const router = useRouter();

  const [triggeredMatches, setTriggeredMatches] = useState<TriggeredMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | '30m' | '2h' | '24h'>('24h');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('matches');

  const itemsPerPage = 50;

  const loadTriggeredMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

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

  const matchGroups = groupByMatch(triggeredMatches);
  const filterGroups = groupByFilter(triggeredMatches);
  const uniqueFilters = new Set(triggeredMatches.map(m => m.filter_id)).size;

  return (
    <AuthWrapper>
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-3">

          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-glass-light rounded-lg transition shrink-0"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Triggered History</h1>
                <p className="text-xs text-text-muted">Matches that triggered your filters</p>
              </div>
            </div>
            <button
              onClick={() => { setPage(0); setExpandedMatch(null); loadTriggeredMatches(true); }}
              disabled={refreshing || loading}
              className="p-2 rounded-lg hover:bg-glass-light transition disabled:opacity-50 shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-text-secondary ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* VIEW MODE TABS */}
          <div className="flex gap-1 bg-glass-light/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('matches')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                viewMode === 'matches'
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              By Match
            </button>
            <button
              onClick={() => setViewMode('filters')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                viewMode === 'filters'
                  ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5" />
              By Filter
            </button>
          </div>

          {/* TIME PILLS + STATS inline — only for Matches view */}
          {viewMode === 'matches' && (
            <div className="flex items-center gap-2 flex-wrap">
              {(['30m', '2h', '24h', 'all'] as const).map((range) => (
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
              {matchGroups.length > 0 && (
                <span className="text-[10px] text-text-muted ml-auto">
                  {matchGroups.length} matches {'\u00B7'} {uniqueFilters} filters
                </span>
              )}
            </div>
          )}

          {/* By Filter view info */}
          {viewMode === 'filters' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Last 12 hours
              </span>
              {filterGroups.length > 0 && (
                <span className="text-[10px] text-text-muted">
                  {filterGroups.length} filter{filterGroups.length !== 1 ? 's' : ''} {'\u00B7'} {filterGroups.reduce((sum, g) => sum + g.matchCount, 0)} matches
                </span>
              )}
            </div>
          )}

          {/* CONTENT */}
          {loading && triggeredMatches.length === 0 ? (
            <div className="rounded-lg p-8 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
              <Zap className="w-6 h-6 text-accent-cyan mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-text-muted">Loading...</p>
            </div>
          ) : viewMode === 'matches' ? (
            /* ===== BY MATCH VIEW ===== */
            matchGroups.length === 0 ? (
              <div className="rounded-lg p-8 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
                <Trophy className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-secondary">
                  No triggered matches {timeRange !== 'all' ? `in the last ${timeRange === '30m' ? '30 minutes' : timeRange === '2h' ? '2 hours' : '24 hours'}` : ''}
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
                  />
                ))}
              </div>
            )
          ) : (
            /* ===== BY FILTER VIEW ===== */
            filterGroups.length === 0 ? (
              <div className="rounded-lg p-8 border border-white/10 bg-[rgba(15,23,42,0.85)] text-center">
                <FilterIcon className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-secondary">No filter triggers in the last 12 hours</p>
                <p className="text-[11px] text-text-muted mt-1.5 max-w-xs mx-auto">
                  Switch to &quot;By Match&quot; to see all history, or keep the app open during match times.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filterGroups.map((group) => (
                  <FilterGroupCard key={group.filterId} group={group} />
                ))}
              </div>
            )
          )}

          {/* LOAD MORE — only for matches view */}
          {viewMode === 'matches' && hasMore && !loading && (
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
// MATCH GROUP CARD
// ============================================

function MatchGroupCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: MatchGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Expanded filter detail (clickable filter name)
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // Fetch final result on mount (always, not just when expanded)
  useEffect(() => {
    if (finalResult) return;
    
    setLoadingResult(true);
    fetch(`/api/match-result?match_id=${group.matchId}`)
      .then(res => res.json())
      .then(data => {
        if (data.scoreHome !== undefined && data.scoreAway !== undefined) {
          setFinalResult({
            homeTeam: data.homeTeam || group.homeTeam,
            awayTeam: data.awayTeam || group.awayTeam,
            scoreHome: data.scoreHome,
            scoreAway: data.scoreAway,
            status: data.status || '',
            statusLong: data.statusLong || '',
            loaded: true,
          });
        } else {
          // Use group's current data if no update available
          setFinalResult({
            homeTeam: group.homeTeam,
            awayTeam: group.awayTeam,
            scoreHome: group.scoreHome,
            scoreAway: group.scoreAway,
            status: group.matchStatus,
            statusLong: '',
            loaded: true,
          });
        }
      })
      .catch(err => {
        console.error('Error fetching final result:', err);
        // Fallback to group's data
        setFinalResult({
          homeTeam: group.homeTeam,
          awayTeam: group.awayTeam,
          scoreHome: group.scoreHome,
          scoreAway: group.scoreAway,
          status: group.matchStatus,
          statusLong: '',
          loaded: true,
        });
      })
      .finally(() => setLoadingResult(false));
  }, [isExpanded, group, finalResult]);

  // Determine if match is finished
  const isFinished = finalResult?.status?.toLowerCase() === 'ft' || 
                     finalResult?.statusLong?.toLowerCase().includes('finished') ||
                     group.matchStatus?.toLowerCase() === 'finished';

  // Use final score in header if available, otherwise fall back to triggered score
  const displayScoreHome = finalResult?.loaded ? finalResult.scoreHome : group.scoreHome;
  const displayScoreAway = finalResult?.loaded ? finalResult.scoreAway : group.scoreAway;
  const scoresChanged = finalResult?.loaded &&
    (finalResult.scoreHome !== group.scoreHome || finalResult.scoreAway !== group.scoreAway);

  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
      {/* Card header - always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          {/* Score */}
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-accent-cyan">{displayScoreHome ?? 0}</span>
              <span className="text-xs text-text-muted">-</span>
              <span className="text-lg font-bold text-accent-blue">{displayScoreAway ?? 0}</span>
              {isFinished && (
                <span className="text-[10px] bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded font-semibold ml-1">
                  FT
                </span>
              )}
              {loadingResult && !finalResult && (
                <span className="w-3 h-3 rounded-full border-2 border-accent-cyan/40 border-t-accent-cyan animate-spin ml-1" />
              )}
            </div>
            {scoresChanged && (
              <span className="text-[9px] text-accent-cyan/70 leading-tight">
                triggered {group.scoreHome ?? 0}-{group.scoreAway ?? 0}
              </span>
            )}
          </div>

          {/* Teams + meta */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {group.homeTeam} vs {group.awayTeam}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px]">
              <span className="text-text-muted truncate">{group.leagueName}</span>
              <span className="text-accent-blue">{getTimeSince(group.latestTriggerAt)}</span>
            </div>
          </div>

          {/* Filter count + chevron */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full">
              {group.triggers.length}
            </span>
            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-white/8">
          {/* Final Result Display */}
          {finalResult && isFinished && (
            <div className="px-3 py-2.5 bg-accent-green/5 border-b border-accent-green/20">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted">Final Result:</span>
                <span className="font-bold text-accent-green">
                  {finalResult.scoreHome} - {finalResult.scoreAway}
                </span>
              </div>
              {group.scoreHome !== finalResult.scoreHome || group.scoreAway !== finalResult.scoreAway ? (
                <div className="text-[10px] text-accent-cyan mt-1">
                  Changed from {group.scoreHome ?? 0}-{group.scoreAway ?? 0} when triggered
                </div>
              ) : null}
            </div>
          )}

          {/* Triggered filters - clickable */}
          <div className="px-3 py-2 space-y-1">
            {group.triggers.map((trigger, i) => {
              const isFilterExpanded = expandedFilter === (trigger.id || String(i));
              // Display triggered score - should always have a value now
              const triggerScore = (trigger.score_home !== null && trigger.score_away !== null)
                ? `${trigger.score_home}-${trigger.score_away}`
                : '0-0';

              return (
                <div key={trigger.id || i}>
                  {/* Filter row - clickable */}
                  <button
                    onClick={() => setExpandedFilter(
                      isFilterExpanded ? null : (trigger.id || String(i))
                    )}
                    className="w-full flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg hover:bg-white/5 transition text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FilterIcon className="w-3 h-3 text-accent-purple shrink-0" />
                      <span className="text-xs text-white font-medium truncate">
                        {trigger.filter_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {trigger.match_time != null && (
                        <span className="bg-accent-cyan/10 text-accent-cyan text-[10px] px-1.5 py-0.5 rounded font-semibold">
                          {trigger.match_time}&apos;
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted font-medium">
                        {triggerScore}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Filter detail - trigger context */}
                  {isFilterExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mx-2 mb-1.5 px-3 py-2.5 rounded-lg bg-white/3 border border-white/5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3 h-3 text-accent-blue shrink-0" />
                        <span className="text-[11px] text-text-secondary">
                          Picked <span className="text-accent-cyan font-semibold">{getTimeSince(trigger.triggered_at)}</span>
                          {trigger.match_time != null && (
                            <> at <span className="text-white font-semibold">{trigger.match_time}&apos;</span> minute</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">Score when triggered:</span>
                        <span className="font-bold text-white">{triggerScore}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="text-text-muted">Time:</span>
                        <span className="text-text-secondary">
                          {new Date(trigger.triggered_at).toLocaleString([], {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* LivePick-style stats */}
          <LivePickStats matchId={group.matchId} leagueName={group.leagueName} homeName={group.homeTeam} awayName={group.awayTeam} />
        </div>
      )}
    </div>
  );
}

// ============================================
// FILTER GROUP CARD (By Filter view)
// ============================================

function FilterGroupCard({ group }: { group: FilterGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Sort matches within this filter by trigger time (newest first)
  const sortedMatches = [...group.matches].sort(
    (a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
  );

  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(15,23,42,0.85)] overflow-hidden">
      {/* Filter header — always visible */}
      <button
        onClick={() => { setIsExpanded(!isExpanded); setExpandedMatchId(null); }}
        className="w-full text-left p-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          {/* Filter icon + name */}
          <div className="w-8 h-8 rounded-lg bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center shrink-0">
            <FilterIcon className="w-4 h-4 text-accent-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {group.filterName}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px]">
              <span className="text-accent-purple font-medium">
                {group.matchCount} match{group.matchCount !== 1 ? 'es' : ''}
              </span>
              <span className="text-text-muted">{'\u00B7'}</span>
              <span className="text-accent-blue">{getTimeSince(group.latestTriggerAt)}</span>
            </div>
          </div>

          {/* Match count badge + chevron */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full">
              {group.matchCount}
            </span>
            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* Expanded: list of triggered matches */}
      {isExpanded && (
        <div className="border-t border-white/8 px-3 py-2 space-y-1">
          {sortedMatches.map((trigger) => {
            const isMatchExpanded = expandedMatchId === trigger.match_id;
            const triggerScore = (trigger.score_home !== null && trigger.score_away !== null)
              ? `${trigger.score_home}-${trigger.score_away}`
              : '0-0';

            return (
              <div key={trigger.id || trigger.match_id}>
                {/* Match row */}
                <button
                  onClick={() => setExpandedMatchId(isMatchExpanded ? null : trigger.match_id)}
                  className="w-full flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg hover:bg-white/5 transition text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Score badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-accent-cyan">{trigger.score_home ?? 0}</span>
                      <span className="text-[10px] text-text-muted">-</span>
                      <span className="text-xs font-bold text-accent-blue">{trigger.score_away ?? 0}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-white font-medium truncate block">
                        {trigger.home_team} vs {trigger.away_team}
                      </span>
                      {trigger.league_name && (
                        <span className="text-[9px] text-text-muted truncate block">{trigger.league_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {trigger.match_time != null && (
                      <span className="bg-accent-cyan/10 text-accent-cyan text-[10px] px-1.5 py-0.5 rounded font-semibold">
                        {trigger.match_time}&apos;
                      </span>
                    )}
                    <span className="text-[10px] text-accent-blue">{getTimeSince(trigger.triggered_at)}</span>
                    <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${isMatchExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Match detail — trigger context */}
                {isMatchExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mx-2 mb-1.5 px-3 py-2.5 rounded-lg bg-white/3 border border-white/5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3 h-3 text-accent-blue shrink-0" />
                      <span className="text-[11px] text-text-secondary">
                        Triggered <span className="text-accent-cyan font-semibold">{getTimeSince(trigger.triggered_at)}</span>
                        {trigger.match_time != null && (
                          <> at <span className="text-white font-semibold">{trigger.match_time}&apos;</span> minute</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Score when triggered:</span>
                      <span className="font-bold text-white">{triggerScore}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-text-muted">Time:</span>
                      <span className="text-text-secondary">
                        {new Date(trigger.triggered_at).toLocaleString([], {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {trigger.league_name && (
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="text-text-muted">League:</span>
                        <span className="text-text-secondary">{trigger.league_name}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// LIVEPICK-STYLE STATS (circular gauges + bars)
// ============================================

function LivePickStats({
  matchId,
  leagueName,
  homeName,
  awayName,
}: {
  matchId: string;
  leagueName: string;
  homeName: string;
  awayName: string;
}) {
  const [stats, setStats] = useState<ESPNStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveScore, setLiveScore] = useState<{ home: number; away: number } | null>(null);

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
      <div className="px-3 py-3 border-t border-white/5">
        <div className="text-[10px] text-text-muted animate-pulse">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="px-3 py-3 border-t border-white/5">
        <div className="text-[10px] text-text-muted">Statistics not available</div>
      </div>
    );
  }

  // Key gauges (LivePick-style circular)
  const gauges: { label: string; home: number; away: number }[] = [];
  if (stats.homeShots + stats.awayShots > 0) gauges.push({ label: 'Shots', home: stats.homeShots, away: stats.awayShots });
  if (stats.homeCorners + stats.awayCorners > 0) gauges.push({ label: 'Corners', home: stats.homeCorners, away: stats.awayCorners });
  if (stats.homePoss > 0) gauges.push({ label: 'Possession', home: stats.homePoss, away: stats.awayPoss });

  // Bar stats
  const bars: { label: string; home: number; away: number; unit?: string }[] = [];
  if (stats.homeSoT + stats.awaySoT > 0) bars.push({ label: 'On Target', home: stats.homeSoT, away: stats.awaySoT });
  if (stats.homeShots + stats.awayShots - stats.homeSoT - stats.awaySoT > 0) {
    bars.push({ label: 'Off Target', home: stats.homeShots - stats.homeSoT, away: stats.awayShots - stats.awaySoT });
  }

  // Card stats
  const hasCards = stats.homeYellow + stats.awayYellow + stats.homeRed + stats.awayRed > 0;

  if (gauges.length === 0 && bars.length === 0) {
    return (
      <div className="px-3 py-3 border-t border-white/5">
        <div className="text-[10px] text-text-muted">No statistics recorded</div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-t border-white/5 space-y-3">
      {/* Circular gauges row */}
      {gauges.length > 0 && (
        <div className="flex justify-around">
          {gauges.map(g => (
            <CircleGauge key={g.label} label={g.label} home={g.home} away={g.away} />
          ))}
        </div>
      )}

      {/* On Target / Off Target bars */}
      {bars.length > 0 && (
        <div className="space-y-1.5">
          {bars.map(bar => (
            <StatBar key={bar.label} label={bar.label} home={bar.home} away={bar.away} />
          ))}
        </div>
      )}

      {/* Cards row */}
      {hasCards && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            {stats.homeYellow > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <span className="w-2 h-2.5 rounded-[1px] bg-yellow-400 inline-block" />
                <span className="text-text-secondary font-bold">{stats.homeYellow}</span>
              </span>
            )}
            {stats.homeRed > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <span className="w-2 h-2.5 rounded-[1px] bg-red-500 inline-block" />
                <span className="text-text-secondary font-bold">{stats.homeRed}</span>
              </span>
            )}
          </div>
          <span className="text-[9px] text-text-muted">Cards</span>
          <div className="flex items-center gap-1.5">
            {stats.awayYellow > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <span className="text-text-secondary font-bold">{stats.awayYellow}</span>
                <span className="w-2 h-2.5 rounded-[1px] bg-yellow-400 inline-block" />
              </span>
            )}
            {stats.awayRed > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <span className="text-text-secondary font-bold">{stats.awayRed}</span>
                <span className="w-2 h-2.5 rounded-[1px] bg-red-500 inline-block" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Fouls + Offsides compact row */}
      {(stats.homeFouls + stats.awayFouls > 0 || stats.homeOffsides + stats.awayOffsides > 0) && (
        <div className="flex items-center justify-center gap-4 text-[10px] text-text-muted pt-1 border-t border-white/5">
          {stats.homeFouls + stats.awayFouls > 0 && (
            <span>{stats.homeFouls} Fouls {stats.awayFouls}</span>
          )}
          {stats.homeOffsides + stats.awayOffsides > 0 && (
            <span>{stats.homeOffsides} Offsides {stats.awayOffsides}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// CIRCLE GAUGE (LivePick-style)
// ============================================

function CircleGauge({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homePercent = total > 0 ? (home / total) * 100 : 50;
  const awayPercent = 100 - homePercent;

  // SVG circle
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const homeArc = (homePercent / 100) * circumference;
  const awayArc = circumference - homeArc;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] text-text-muted font-semibold">{label}</span>
      <div className="relative w-[64px] h-[64px]">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          {/* Away arc (background) */}
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke="rgba(59,130,246,0.4)"
            strokeWidth="5"
            strokeDasharray={`${awayArc} ${homeArc}`}
            strokeDashoffset={-homeArc}
          />
          {/* Home arc */}
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke="rgb(34,211,238)"
            strokeWidth="5"
            strokeDasharray={`${homeArc} ${awayArc}`}
            strokeLinecap="round"
          />
        </svg>
        {/* Center values */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center leading-tight">
            <span className="text-[11px] font-bold text-accent-cyan">{home}</span>
            <span className="text-[8px] text-text-muted mx-0.5">/</span>
            <span className="text-[11px] font-bold text-accent-blue">{away}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STAT BAR (On Target / Off Target style)
// ============================================

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homeP = total > 0 ? Math.round((home / total) * 100) : 50;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-accent-cyan w-5 text-center">{home}</span>
        <span className="text-text-muted text-[9px]">{label}</span>
        <span className="font-bold text-accent-blue w-5 text-center">{away}</span>
      </div>
      <div className="flex gap-0.5 h-1.5">
        <div className="flex-1 flex justify-end">
          <div
            className="h-full shrink-0 rounded-l-full bg-accent-cyan transition-all"
            style={{ width: `${homeP}%` }}
          />
        </div>
        <div className="flex-1 flex justify-start">
          <div
            className="h-full shrink-0 rounded-r-full bg-accent-blue transition-all"
            style={{ width: `${100 - homeP}%` }}
          />
        </div>
      </div>
    </div>
  );
}
