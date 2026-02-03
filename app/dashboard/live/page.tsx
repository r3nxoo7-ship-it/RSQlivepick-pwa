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
  Bell, 
  BellOff, 
  Zap,
  Settings,
  Radio
} from 'lucide-react';
import { getLiveMatches, LiveMatch } from '@/lib/unified-api';
import MatchCard from '@/components/MatchCard';
import MatchStatsDisplay from '@/components/MatchStatsDisplay';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';
import { applyFiltersToMatches, FilterMatchResult } from '@/lib/filter-engine';
import { useBackgroundScanner } from '@/lib/background-scanner';
import { checkNotificationStatus, requestNotificationPermission } from '@/lib/notifications';
import { useRouter } from 'next/navigation';

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
  
  // Use background scanner hook
  const backgroundScanner = useBackgroundScanner(true);
  
  // ============================================
  // LOAD FUNCTIONS
  // ============================================
  
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
      console.log('🔍 Fetching live matches...');
      const liveMatches = await getLiveMatches();
      
      setMatches(liveMatches);
      setLastUpdate(new Date());
      
      console.log(`✅ Loaded ${liveMatches.length} live matches`);
      
      // Apply filters directly inline to avoid dependency issues
      if (userFilters.length > 0) {
        setApplyingFilters(true);
        try {
          console.log('🎯 Applying filters to matches...');
          const results = await applyFiltersToMatches(liveMatches, userFilters);
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
    : matches.filter(m => m.league.name === selectedLeague);
  
  if (showOnlyFiltered === true) {
    filteredMatches = filteredMatches.filter(m => filterResults.has(m.fixture.id));
  }
  
  const leagues = Array.from(new Set(matches.map(m => m.league.name)));
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleMatchClick = (match: LiveMatch) => {
    const matchedFilters = filterResults.get(match.fixture.id);
    
    if (matchedFilters && matchedFilters.length > 0) {
      const filterNames = matchedFilters.map(r => r.filter.name).join(', ');
      const conditions = matchedFilters[0].matchedConditions.join('\n');
      
      alert(
        `⚽ ${match.teams.home.name} vs ${match.teams.away.name}\n\n` +
        `✅ Matched Filters (${matchedFilters.length}):\n${filterNames}\n\n` +
        `📊 Conditions:\n${conditions}`
      );
    } else {
      alert(
        `⚽ ${match.teams.home.name} vs ${match.teams.away.name}\n\n` +
        `Match ID: ${match.fixture.id}\n` +
        `Liga: ${match.league.name}\n\n` +
        `❌ No filters matched`
      );
    }
  };
  
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
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div>
              <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent mb-2">
                ⚽ Live Matches
              </h1>
              <p className="text-text-secondary text-lg">
                Real-time scanner with <span className="text-accent-cyan font-semibold">{matches.length} matches</span>
                {lastUpdate && (
                  <> • Last update: <span className="text-accent-cyan">{lastUpdate.toLocaleTimeString()}</span></>
                )}
              </p>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </motion.div>
          
          {/* ========== STATS BAR ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-4 sm:p-6 border-t border-glass-lighter"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-accent-cyan/10 to-cyan-900/5 border border-accent-cyan/20">
                <div className="stat-label text-xs sm:text-sm text-text-secondary font-semibold mb-1">Live</div>
                <div className="stat-value text-2xl sm:text-3xl font-bold text-accent-cyan">{matches.length}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-accent-green/10 to-green-900/5 border border-accent-green/20">
                <div className="stat-label text-xs sm:text-sm text-text-secondary font-semibold mb-1">Scanned</div>
                <div className="stat-value text-accent-green text-2xl sm:text-3xl font-bold">{matchesWithFilters}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-accent-amber/10 to-amber-900/5 border border-accent-amber/20">
                <div className="stat-label text-xs sm:text-sm text-text-secondary font-semibold mb-1">Filters</div>
                <div className="stat-value text-accent-amber text-2xl sm:text-3xl font-bold">{activeFiltersCount}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-accent-purple/10 to-purple-900/5 border border-accent-purple/20">
                <div className="stat-label text-xs sm:text-sm text-text-secondary font-semibold mb-1">Scans</div>
                <div className="stat-value text-accent-purple text-2xl sm:text-3xl font-bold">{scannerStats.totalScans}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-accent-blue/10 to-blue-900/5 border border-accent-blue/20">
                <div className="stat-label text-xs sm:text-sm text-text-secondary font-semibold mb-1">Alerts</div>
                <div className="stat-value text-accent-blue text-2xl sm:text-3xl font-bold">{scannerStats.notificationsSent}</div>
              </div>
            </div>
          </motion.div>
          
          {/* ========== SCANNER CONTROL ========== */}
          <div className="glass-card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left side - Info */}
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                {scannerStats.isRunning ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Radio className="w-6 h-6 text-accent-green animate-pulse" />
                  </div>
                ) : (
                  <Zap className="w-6 h-6 text-text-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-lg">
                    Background Scanner
                    {scannerStats.isRunning && (
                      <span className="ml-2 text-sm text-accent-cyan animate-pulse">● Active</span>
                    )}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {scannerStats.isRunning ? (
                      <>
                        ✅ Always running - auto-scanning every 30s in background
                        {scannerStats.lastScanTime && (
                          <> • Last: {new Date(scannerStats.lastScanTime).toLocaleTimeString()}</>
                        )}
                      </>
                    ) : (
                      <>
                        ⏸️ Initializing scanner...
                      </>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Right side - Controls */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Notification Status */}
                {!notificationsReady && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent-amber/10 text-xs">
                    <Bell className="w-3 h-3 text-accent-amber" />
                    <span className="text-accent-amber hidden sm:inline">Permission needed</span>
                    <span className="text-accent-amber sm:hidden">Permission</span>
                  </div>
                )}
                
                {/* Settings Button */}
                <button
                  onClick={() => router.push('/dashboard/notifications')}
                  className="btn-secondary p-2 sm:p-3"
                  title="Notification Settings"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
            {/* Scanner Info - Expanded when enabled */}
            {scannerEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-glass-medium"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <p className="text-text-muted mb-1">Filters Monitored</p>
                    <p className="font-semibold text-accent-cyan">{filtersWithNotifications}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1">Matches Scanned</p>
                    <p className="font-semibold">{matches.length}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1">Total Scans</p>
                    <p className="font-semibold text-accent-amber">{scannerStats.totalScans}</p>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Warning când nu sunt filtre cu notificări */}
            {scannerEnabled && filtersWithNotifications === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-lg bg-accent-amber/10 border border-accent-amber/20"
              >
                <p className="text-xs sm:text-sm text-accent-amber flex items-center gap-2">
                  <Bell className="w-4 h-4 flex-shrink-0" />
                  No active filters with notifications! Enable notifications in the Filters section.
                </p>
              </motion.div>
            )}
          </div>
          
          {/* ========== FILTERS ========== */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <FilterIcon className="w-5 h-5 text-accent-cyan" />
              <span className="font-display font-semibold">Filters:</span>
              
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="input-field max-w-xs"
              >
                <option value="all">All Leagues ({matches.length})</option>
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyFiltered || false}
                    onChange={(e) => setShowOnlyFiltered(e.target.checked)}
                    className="w-4 h-4 rounded border-glass-medium bg-glass-light accent-accent-cyan"
                  />
                  <span className="text-sm">
                    <Target className="w-4 h-4 inline mr-1 text-accent-green" />
                    Matched Only ({matchesWithFilters})
                  </span>
                </label>
              )}
              
              {applyingFilters && (
                <span className="text-sm text-text-muted flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Applying filters...
                </span>
              )}
              
              <span className="text-text-muted text-sm ml-auto">
                {activeFiltersCount === 0 ? (
                  '💡 Create filters in the Filters section'
                ) : (
                  `✅ ${activeFiltersCount} active filters`
                )}
              </span>
            </div>
          </div>
          
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
            >
              {filteredMatches.map((match, index) => (
                <motion.div
                  key={match.fixture.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <MatchCard
                    match={match}
                    onClick={() => setSelectedMatch(match)}
                    showStatistics={true}
                    filterResults={filterResults.get(match.fixture.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-glass-light rounded-2xl shadow-2xl max-w-lg w-full p-6 relative animate-fadeIn">
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="absolute top-3 right-3 text-text-secondary hover:text-accent-cyan"
                  aria-label="Close"
                >
                  ×
                </button>
                <h2 className="text-xl font-bold mb-2 text-accent-cyan">
                  {selectedMatch.teams.home.name} vs {selectedMatch.teams.away.name}
                </h2>
                <div className="text-sm text-text-secondary mb-4">
                  <p>League: {selectedMatch.league.name}</p>
                  <p>Time: {selectedMatch.fixture.status.long} ({selectedMatch.fixture.status.elapsed}&apos;)</p>
                  <p>Score: {selectedMatch.goals.home} - {selectedMatch.goals.away}</p>
                </div>
                <div className="text-center text-sm text-text-muted">
                  <p>Full stats integration coming soon</p>
                </div>
              </div>
            </div>
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
