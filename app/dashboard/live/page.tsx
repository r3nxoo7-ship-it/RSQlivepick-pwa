'use client';

// ============================================
// R$Q - LIVE MATCHES PAGE (WITH AUTO-SCANNER)
// ============================================
// Versiune optimizată cu Match Scanner integrat

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Filter as FilterIcon,
  Activity,
  Target,
  Zap,
  Clock,
  Trophy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getLiveAndUpcomingMatches, LiveMatch } from '@/lib/unified-api';
import MatchCard from '@/components/MatchCard';
import AdvancedMatchDetail from '@/components/AdvancedMatchDetail';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter, TriggeredMatch } from '@/lib/supabase';
import { applyFiltersToMatches, FilterMatchResult } from '@/lib/filter-engine';
import { useBackgroundScanner } from '@/lib/background-scanner';
import { checkNotificationStatus, requestNotificationPermission } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Group triggers by match_id, dedup by filter_id
interface TriggeredMatchGroup {
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

function groupTriggeredByMatch(matches: TriggeredMatch[]): TriggeredMatchGroup[] {
  const map = new Map<string, TriggeredMatchGroup>();
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
    if (!group.triggers.some(t => t.filter_id === m.filter_id)) {
      group.triggers.push(m);
    }
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

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function LiveMatchesPage() {
  const router = useRouter();

  // ============================================
  // STATE
  // ============================================
  
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Filter state
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [userFilters, setUserFilters] = useState<Filter[]>([]);
  const [filterResults, setFilterResults] = useState<Map<number, FilterMatchResult[]>>(new Map());
  const [showOnlyFiltered, setShowOnlyFiltered] = useState<boolean | null>(null); // null = loading from localStorage
  const [applyingFilters, setApplyingFilters] = useState(false);

  // Scanner state
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [scannerStats, setScannerStats] = useState({
    isRunning: false,
    totalScans: 0,
    notificationsSent: 0,
    activeFilters: 0,
    matchesScanned: 0,
    lastScanTime: null as Date | null,
  });

  // Triggered matches state (last 20 minutes)
  const [recentlyTriggered, setRecentlyTriggered] = useState<any[]>([]);
  const [triggeredLoading, setTriggeredLoading] = useState(false);

  // Team form + odds for upcoming matches
  const [teamFormMap, setTeamFormMap] = useState<Record<string, { wins: number; draws: number; losses: number; played: number }>>({});
  const [matchOddsMap, setMatchOddsMap] = useState<Record<string, any>>({});

  // Expanded match group state
  const [expandedTriggered, setExpandedTriggered] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Full history state
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [historyMatches, setHistoryMatches] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyTimeRange, setHistoryTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('7d');
  
  // Use background scanner hook
  const backgroundScanner = useBackgroundScanner(true);

    // ============================================
  // LOAD FUNCTIONS
  // ============================================

  const loadRecentlyTriggered = useCallback(async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;

      setTriggeredLoading(true);
      const params = new URLSearchParams({ user_id: currentUser.id, range: '24h', limit: '10' });
      const res = await fetch(`/api/triggered-matches/list?${params}`);
      const result = await res.json();
      setRecentlyTriggered(result.matches || []);
    } catch (err) {
      console.error('Error loading triggered matches:', err);
    } finally {
      setTriggeredLoading(false);
    }
  }, []);

  const loadFullHistory = useCallback(async (page: number, timeRange: string, reset: boolean) => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;

      setHistoryLoading(true);
      const itemsPerPage = 20;
      let matches: any[] = [];

      if (timeRange === 'all') {
        matches = await dbHelpers.getTriggeredMatchesHistory(currentUser.id, itemsPerPage, page * itemsPerPage);
      } else {
        const minutesMap: Record<string, number> = { '24h': 24 * 60, '7d': 7 * 24 * 60, '30d': 30 * 24 * 60 };
        matches = await dbHelpers.getTriggeredMatches(currentUser.id, minutesMap[timeRange] || 20, 50);
      }

      if (reset) {
        setHistoryMatches(matches);
      } else {
        setHistoryMatches(prev => [...prev, ...matches]);
      }
      setHistoryHasMore(matches.length === itemsPerPage);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);
  
  const loadUserFilters = useCallback(async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return [];

      const filters = await dbHelpers.getUserFilters(currentUser.id);
      setUserFilters(filters);

      console.log(`✅ Loaded ${filters.length} user filters`);
      return filters;
    } catch (err) {
      console.error('Error loading filters:', err);
      return [];
    }
  }, []);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching live + upcoming matches...');
      const { live, upcoming, teamForm } = await getLiveAndUpcomingMatches();
      const allMatches = [...live, ...upcoming];

      setMatches(allMatches);
      setLastUpdate(new Date());

      // Store team form keyed by team ID (string)
      setTeamFormMap(teamForm || {});

      console.log(`✅ Loaded ${allMatches.length} matches (${live.length} live, ${upcoming.length} upcoming)`);

      // Fetch pre-match odds for today (best-effort, silently skip on error)
      if (upcoming.length > 0) {
        try {
          const oddsRes = await fetch('/api/odds/upcoming');
          if (oddsRes.ok) {
            const oddsData = await oddsRes.json();
            setMatchOddsMap(oddsData.oddsMap || {});
            console.log(`✅ Loaded odds for ${oddsData.count || 0} upcoming matches`);
          }
        } catch (oddsErr) {
          console.warn('⚠️ Could not fetch pre-match odds:', oddsErr);
        }
      }
      
      // Apply filters directly inline to avoid dependency issues
      if (userFilters.length > 0) {
        setApplyingFilters(true);
        try {
          console.log('🎯 Applying filters to matches...');
          const results = await applyFiltersToMatches(allMatches, userFilters);
          setFilterResults(results);
          console.log(`✅ ${results.size} matches have filter matches`);
        } catch (err) {
          console.error('Error applying filters:', err);
        } finally {
          setApplyingFilters(false);
        }
      } else {
        setFilterResults(new Map());
      }
      
    } catch (err) {
      console.error('❌ Error fetching matches:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, [userFilters]);

  const checkNotificationPermissions = useCallback(async () => {
    try {
      const status = await checkNotificationStatus();
      setNotificationsReady(status.ready);
      console.log('🔔 Notification status:', status);
      
      if (!status.ready && status.supported) {
        console.log('⚠️ Notifications not ready. User needs to grant permission.');
     }
    } catch (err) {
      console.error('Error checking notification permissions:', err);
    }
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  // Add modal state
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);
  
  // Load showOnlyFiltered from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('live-show-only-filtered');
    setShowOnlyFiltered(saved === 'true' ? true : false);
  }, []);
  
  // Update scanner stats every 5 seconds

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = backgroundScanner.getState();
      setScannerStats({
        isRunning: stats.isRunning,
        totalScans: stats.totalScans,
        notificationsSent: stats.notificationsSent,
        activeFilters: stats.activeFilters,
        matchesScanned: stats.matchesScanned,
        lastScanTime: stats.lastScanTime,
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [backgroundScanner]);

  // Load recently triggered matches every 10 seconds
  useEffect(() => {
    loadRecentlyTriggered();
    const interval = setInterval(() => {
      loadRecentlyTriggered();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [loadRecentlyTriggered]);
  
  // Persist showOnlyFiltered to localStorage when it changes
  useEffect(() => {
    if (showOnlyFiltered !== null) {
      localStorage.setItem('live-show-only-filtered', String(showOnlyFiltered));
    }
  }, [showOnlyFiltered]);
  
  useEffect(() => {
    loadUserFilters();
    checkNotificationPermissions();
  }, [loadUserFilters, checkNotificationPermissions]);
  
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);
  
  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh matches...');
      fetchMatches();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchMatches]);
  // ============================================
  // FILTER LOGIC
  // ============================================
  
  const matchesWithFilters = Array.from(filterResults.keys()).length;
  const activeFiltersCount = userFilters.filter(f => f.is_active).length;
  const filtersWithNotifications = userFilters.filter(f => f.is_active && f.notification_enabled).length;
   let filteredMatches = selectedLeague === 'all' 
    ? matches 
    : matches.filter(m => m.league?.name === selectedLeague);

  if (showOnlyFiltered === true) {
filteredMatches = filteredMatches.filter(m => m.fixture?.id && filterResults.has(m.fixture.id));  }
  
  const leagues = Array.from(new Set(matches.map(m => m.league?.name || 'Unknown')));
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleRefresh = () => {
    fetchMatches();
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ========== HEADER ========== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl overflow-hidden mb-4"
          >
            {/* Background gradient with mobile optimization */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/20 to-accent-blue/20 md:from-accent-cyan/30 md:to-accent-blue/30"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-70"></div>
            
            {/* Header content */}
            <div className="relative p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent mb-1 sm:mb-2 line-clamp-1">
                  ⚽ Live Matches
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-text-secondary line-clamp-2">
                  {(() => {
                    const live = matches.filter(m => { const s = m.fixture?.status?.short; return s === 'LIVE' || s === '1H' || s === '2H' || s === 'HT'; });
                    const upcoming = matches.length - live.length;
                    return <>
                      {live.length > 0 ? <><span className="text-accent-green font-semibold">{live.length} live</span>{upcoming > 0 && <> + <span className="text-text-muted">{upcoming} upcoming</span></>}</> : <span className="text-text-muted">{matches.length} upcoming</span>}
                    </>;
                  })()}
                  {lastUpdate && (
                    <> • <span className="text-accent-cyan">{lastUpdate.toLocaleTimeString()}</span></>
                  )}
                </p>
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="btn-secondary flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0 sm:px-4 sm:py-2 px-3 py-2 text-sm sm:text-base"
              >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </motion.div>
          
          {/* ========== STATS BAR ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-3 sm:p-4 md:p-6 border-t border-glass-lighter"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              <div className="text-center p-2 sm:p-3 rounded-lg bg-gradient-to-br from-accent-cyan/10 to-cyan-900/5 border border-accent-cyan/20">
                <div className="stat-label text-xs text-text-secondary font-semibold mb-0.5 sm:mb-1">Live</div>
                <div className="stat-value text-lg sm:text-2xl md:text-3xl font-bold text-accent-cyan">{matches.filter(m => { const s = m.fixture?.status?.short; return s === 'LIVE' || s === '1H' || s === '2H' || s === 'HT'; }).length}</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-gradient-to-br from-accent-green/10 to-green-900/5 border border-accent-green/20">
                <div className="stat-label text-xs text-text-secondary font-semibold mb-0.5 sm:mb-1">Scanned</div>
                <div className="stat-value text-accent-green text-lg sm:text-2xl md:text-3xl font-bold">{matchesWithFilters}</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-gradient-to-br from-accent-amber/10 to-amber-900/5 border border-accent-amber/20">
                <div className="stat-label text-xs text-text-secondary font-semibold mb-0.5 sm:mb-1">Filters</div>
                <div className="stat-value text-accent-amber text-lg sm:text-2xl md:text-3xl font-bold">{activeFiltersCount}</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-gradient-to-br from-accent-purple/10 to-purple-900/5 border border-accent-purple/20">
                <div className="stat-label text-xs text-text-secondary font-semibold mb-0.5 sm:mb-1">Scans</div>
                <div className="stat-value text-accent-purple text-lg sm:text-2xl md:text-3xl font-bold">{scannerStats.totalScans}</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-gradient-to-br from-accent-blue/10 to-blue-900/5 border border-accent-blue/20">
                <div className="stat-label text-xs text-text-secondary font-semibold mb-0.5 sm:mb-1">Alerts</div>
                <div className="stat-value text-accent-blue text-lg sm:text-2xl md:text-3xl font-bold">{scannerStats.notificationsSent}</div>
              </div>
            </div>
          </motion.div>

          
          {/* ========== FILTERS SECTION ========== */}
          <div className="glass-card p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
              <FilterIcon className="w-5 h-5 text-accent-cyan flex-shrink-0" />
              <span className="font-display font-semibold text-sm sm:text-base">Filters:</span>
              
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="input-field max-w-xs text-sm py-2"
                title="Filter by league"
              >
                <option value="all">All ({matches.length})</option>
                {leagues.map(league => {
                  const count = matches.filter(m => m.league.name === league).length;
                  return (
                    <option key={league} value={league}>
                      {league} ({count})
                    </option>
                  );
                })}
              </select>
              
              {activeFiltersCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={showOnlyFiltered || false}
                    onChange={(e) => setShowOnlyFiltered(e.target.checked)}
                    className="w-4 h-4 rounded border-glass-medium bg-glass-light accent-accent-cyan"
                  />
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3 sm:w-4 sm:h-4 text-accent-green flex-shrink-0" />
                    <span className="hidden sm:inline">Matched</span>
                    <span className="sm:hidden">({matchesWithFilters})</span>
                    <span className="hidden sm:inline">({matchesWithFilters})</span>
                  </span>
                </label>
              )}
              
              {applyingFilters && (
                <span className="text-xs sm:text-sm text-text-muted flex items-center gap-2 flex-shrink-0">
                  <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Applying...
                </span>
              )}
              
              <span className="text-text-muted text-xs sm:text-sm ml-auto sm:ml-0 flex-shrink-0">
                {activeFiltersCount === 0 ? (
                  '💡 Create filters'
                ) : (
                  `✅ ${activeFiltersCount} filters`
                )}
              </span>
            </div>
            {/* ... rest of stats ... */}
          </div>
          
          {/* ========== RECENTLY TRIGGERED (Grouped by match) ========== */}
          {recentlyTriggered.length > 0 && (() => {
            const groups = groupTriggeredByMatch(recentlyTriggered);
            return (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 sm:p-6 border-l-4 border-accent-cyan"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent-cyan animate-pulse" />
                    Recently Triggered
                    <span className="text-sm text-accent-cyan ml-2">({groups.length} match{groups.length !== 1 ? 'es' : ''})</span>
                  </h3>
                  <button
                    onClick={() => {
                      setShowFullHistory(!showFullHistory);
                      if (!showFullHistory && historyMatches.length === 0) {
                        loadFullHistory(0, historyTimeRange, true);
                      }
                    }}
                    className="text-sm text-accent-cyan hover:text-accent-blue transition-colors flex items-center gap-1"
                  >
                    {showFullHistory ? 'Hide' : 'Full'} History
                    {showFullHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {groups.map((group) => {
                    const isExpanded = expandedTriggered === group.matchId;
                    const timeSince = (() => {
                      const diffMs = Date.now() - new Date(group.latestTriggerAt).getTime();
                      const mins = Math.floor(diffMs / 60000);
                      const secs = Math.floor((diffMs % 60000) / 1000);
                      if (mins < 1) return `${secs}s ago`;
                      return `${mins}m ago`;
                    })();

                    return (
                      <div key={group.matchId} className="rounded-lg bg-glass-light border border-accent-cyan/30 overflow-hidden">
                        {/* Match header */}
                        <div
                          onClick={() => setExpandedTriggered(isExpanded ? null : group.matchId)}
                          className="flex items-center justify-between p-3 hover:bg-glass-light/80 cursor-pointer transition-all text-sm group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-accent-cyan truncate group-hover:text-accent-blue transition-colors">
                              {group.homeTeam} vs {group.awayTeam}
                              {group.scoreHome != null && (
                                <span className="text-accent-green ml-2 font-bold">{group.scoreHome}-{group.scoreAway}</span>
                              )}
                            </p>
                            <p className="text-xs text-text-muted">
                              {group.triggers.length} filter{group.triggers.length > 1 ? 's' : ''} triggered
                              {group.leagueName && <span className="ml-1">• {group.leagueName}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs text-accent-blue whitespace-nowrap">{timeSince}</span>
                            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded: filter list */}
                        {isExpanded && (
                          <div className="border-t border-glass-medium px-3 pb-3 space-y-1.5 pt-2">
                            {group.triggers.map((t) => (
                              <Link
                                key={t.id}
                                href={`/dashboard/triggered/${t.id}`}
                                className="flex items-center gap-2 p-2 rounded-md bg-glass-dark/50 hover:bg-glass-dark transition-colors text-xs"
                              >
                                <FilterIcon className="w-3 h-3 text-accent-cyan shrink-0" />
                                <span className="text-accent-cyan font-semibold truncate flex-1">{t.filter_name}</span>
                                <div className="flex items-center gap-2 shrink-0 text-text-muted">
                                  {t.match_time && (
                                    <span className="bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded font-semibold">
                                      {t.match_time}&apos;
                                    </span>
                                  )}
                                  {t.score_home != null && (
                                    <span className="text-text-secondary">{t.score_home}-{t.score_away}</span>
                                  )}
                                  <Clock className="w-3 h-3" />
                                  <span>{new Date(t.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })()}
          
          {/* ========== LOADING ========== */}
          {loading && matches.length === 0 && (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">Loading live matches...</p>
            </div>
          )}
          
          {/* ========== ERROR ========== */}
          {error && (
            <div className="glass-card p-6 border-l-4 border-accent-red">
              <h3 className="text-accent-red font-semibold mb-2">
                ❌ Loading Error
              </h3>
              <p className="text-text-secondary text-sm mb-3">{error}</p>
              <button onClick={handleRefresh} className="btn-primary">
                Try Again
              </button>
            </div>
          )}
          
          {/* ========== MECIURI ========== */}
{!loading && !error && filteredMatches.length > 0 && (
  <>
    {/* Main matches grid */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {filteredMatches.map((match, index) => (
        <motion.div
          key={match.fixture?.id || index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <MatchCard
            match={match}
            onClick={() => setSelectedMatch(match)}
            showStatistics={true}
            filterResults={
              match.fixture?.id ? filterResults.get(match.fixture.id) : undefined
            }
            homeForm={teamFormMap[String(match.teams?.home?.id)]}
            awayForm={teamFormMap[String(match.teams?.away?.id)]}
            odds={(() => {
              // Try to find odds by normalized team name pair
              if (!matchOddsMap) return undefined;
              const hName = (match.teams?.home?.name || '').trim().toLowerCase();
              const aName = (match.teams?.away?.name || '').trim().toLowerCase();
              const entry = matchOddsMap[`${hName}|${aName}`];
              if (!entry) return undefined;
              return { fixture_id: match.fixture?.id ?? 0, odds: [], timestamp: 0, bookmakers: entry };
            })()}
          />
        </motion.div>
      ))}
    </motion.div>
  </>
)}


          {/* Floating Action Button for New Filter */}
          <button
            onClick={() => router.push('/dashboard/filters/new')}
            className="fixed bottom-20 right-4 z-40 bg-gradient-to-br from-accent-cyan to-accent-blue text-white rounded-full shadow-lg p-4 flex items-center justify-center md:hidden hover:scale-105 transition"
            aria-label="Create New Filter"
          >
            <FilterIcon className="w-7 h-7" />
          </button>

          {/* Match Details Modal */}
          {selectedMatch && (
            <AdvancedMatchDetail
              match={selectedMatch}
              onClose={() => setSelectedMatch(null)}
              filterResults={
                selectedMatch.fixture?.id
                  ? filterResults.get(selectedMatch.fixture.id)
                  : undefined
              }
            />
          )}
          
          {/* ========== EMPTY STATE ========== */}
          {!loading && !error && filteredMatches.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Activity className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">
                No live matches at the moment
              </h3>
              <p className="text-text-secondary mb-4">
                {matches.length > 0 
                  ? 'No matches match the selected filter.'
                  : 'Try again when matches are scheduled (usually afternoon/evening).'}
              </p>
              <button onClick={handleRefresh} className="btn-primary">
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Check Again
              </button>
            </div>
          )}
          
          {/* ========== FULL TRIGGERED HISTORY ========== */}
          {showFullHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card p-4 sm:p-6 border border-glass-lighter"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent-purple" />
                  Triggered History
                </h3>
              </div>

              {/* Time range filter */}
              <div className="flex gap-2 flex-wrap mb-4">
                {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setHistoryTimeRange(range);
                      setHistoryPage(0);
                      loadFullHistory(0, range, true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      historyTimeRange === range
                        ? 'bg-accent-cyan text-black'
                        : 'bg-glass-light text-text-secondary hover:bg-glass-medium'
                    }`}
                  >
                    {range === 'all' ? 'All' : range}
                  </button>
                ))}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 rounded-lg bg-glass-light border border-glass-lighter">
                  <div className="text-xs text-text-muted">Triggered</div>
                  <div className="text-lg font-bold text-accent-cyan">{historyMatches.length}</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-glass-light border border-glass-lighter">
                  <div className="text-xs text-text-muted">Matches</div>
                  <div className="text-lg font-bold text-accent-green">
                    {new Set(historyMatches.map(m => m.match_id)).size}
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-glass-light border border-glass-lighter">
                  <div className="text-xs text-text-muted">Filters</div>
                  <div className="text-lg font-bold text-accent-purple">
                    {new Set(historyMatches.map(m => m.filter_id)).size}
                  </div>
                </div>
              </div>

              {/* History list (grouped by match) */}
              {historyLoading && historyMatches.length === 0 ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin mb-2">
                    <Zap className="w-6 h-6 text-accent-cyan" />
                  </div>
                  <p className="text-text-secondary text-sm">Loading history...</p>
                </div>
              ) : historyMatches.length === 0 ? (
                <div className="text-center py-6">
                  <Trophy className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-text-secondary text-sm">No triggered matches found</p>
                </div>
              ) : (() => {
                const historyGroups = groupTriggeredByMatch(historyMatches);
                return (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {historyGroups.map((group) => {
                      const isExpanded = expandedHistory === group.matchId;
                      const timeSince = (() => {
                        const diffMs = Date.now() - new Date(group.latestTriggerAt).getTime();
                        const mins = Math.floor(diffMs / 60000);
                        const hours = Math.floor(diffMs / 3600000);
                        const days = Math.floor(diffMs / 86400000);
                        if (mins < 1) return 'Just now';
                        if (mins < 60) return `${mins}m ago`;
                        if (hours < 24) return `${hours}h ago`;
                        return `${days}d ago`;
                      })();

                      return (
                        <div key={group.matchId} className="rounded-lg bg-glass-light/50 border border-glass-lighter overflow-hidden">
                          <div
                            onClick={() => setExpandedHistory(isExpanded ? null : group.matchId)}
                            className="flex items-center justify-between p-3 hover:border-accent-cyan/40 cursor-pointer transition-all text-sm group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white truncate group-hover:text-accent-cyan transition-colors">
                                {group.homeTeam} vs {group.awayTeam}
                                {group.scoreHome != null && (
                                  <span className="text-accent-green ml-2 font-bold">{group.scoreHome}-{group.scoreAway}</span>
                                )}
                              </p>
                              <p className="text-xs text-text-muted mt-0.5">
                                {group.triggers.length} filter{group.triggers.length > 1 ? 's' : ''}
                                {group.leagueName && <span className="ml-1">• {group.leagueName}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs text-text-muted whitespace-nowrap">{timeSince}</span>
                              <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-glass-medium px-3 pb-3 space-y-1.5 pt-2">
                              {group.triggers.map((t) => (
                                <Link
                                  key={t.id}
                                  href={`/dashboard/triggered/${t.id}`}
                                  className="flex items-center gap-2 p-2 rounded-md bg-glass-dark/50 hover:bg-glass-dark transition-colors text-xs"
                                >
                                  <FilterIcon className="w-3 h-3 text-accent-cyan shrink-0" />
                                  <span className="text-accent-cyan font-semibold truncate flex-1">{t.filter_name}</span>
                                  <div className="flex items-center gap-2 shrink-0 text-text-muted">
                                    {t.match_time && (
                                      <span className="bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded font-semibold">
                                        {t.match_time}&apos;
                                      </span>
                                    )}
                                    {t.score_home != null && (
                                      <span className="text-text-secondary">{t.score_home}-{t.score_away}</span>
                                    )}
                                    <span>{new Date(t.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Load more */}
              {historyHasMore && !historyLoading && historyTimeRange === 'all' && (
                <button
                  onClick={() => {
                    const nextPage = historyPage + 1;
                    setHistoryPage(nextPage);
                    loadFullHistory(nextPage, historyTimeRange, false);
                  }}
                  className="w-full mt-3 py-2 rounded-lg bg-glass-light text-accent-cyan text-sm font-semibold hover:bg-glass-medium transition-all"
                >
                  Load More
                </button>
              )}
            </motion.div>
          )}

          {/* ========== INFO ========== */}
          <div className="glass-card p-4 text-sm">
            <h4 className="font-semibold text-accent-cyan mb-2">
              💡 How does the Auto-Scanner work?
            </h4>
            <ul className="space-y-1 text-text-muted">
              <li>• The scanner checks matches every 45 seconds</li>
              <li>• When a match matches an active filter → you get automatic notification!</li>
              <li>• Notifications are sent only once per match + filter (no duplicates)</li>
              <li>• You can enable/disable notifications per filter in the Filters section</li>
              <li>• Match refresh runs every 30s, scanner every 45s (for API optimization)</li>
            </ul>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}