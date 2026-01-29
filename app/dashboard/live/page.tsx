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
  Settings
} from 'lucide-react';
import { getLiveMatches, LiveMatch } from '@/lib/unified-api';
import MatchCard from '@/components/MatchCard';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';
import { applyFiltersToMatches, FilterMatchResult } from '@/lib/filter-engine';
import { useMatchScanner } from '@/hooks/useMatchScanner';
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
  
  // ============================================
  // MATCH SCANNER HOOK
  // ============================================
  
  const { stats: scannerStats, resetNotifications } = useMatchScanner(
    matches,
    userFilters,
    scannerEnabled,
    45 // Scanează la 45 secunde
  );
  
  // ============================================
  // LOAD FUNCTIONS
  // ============================================
  
  const loadUserFilters = useCallback(async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;

      const filters = await dbHelpers.getUserFilters(currentUser.id);
      setUserFilters(filters);

      console.log(`✅ Loaded ${filters.length} user filters`);
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  }, []);
  
  const applyFilters = useCallback(async (matchesToFilter: LiveMatch[]) => {
    if (userFilters.length === 0) {
      setFilterResults(new Map());
      return;
    }
    
    setApplyingFilters(true);
    
    try {
      console.log('🎯 Applying filters to matches...');
      const results = await applyFiltersToMatches(matchesToFilter, userFilters);
      setFilterResults(results);
      
      console.log(`✅ ${results.size} matches have filter matches`);
    } catch (err) {
      console.error('Error applying filters:', err);
    } finally {
      setApplyingFilters(false);
    }
  }, [userFilters]);
  
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching live matches...');
      const liveMatches = await getLiveMatches();
      
      setMatches(liveMatches);
      setLastUpdate(new Date());
      
      console.log(`✅ Loaded ${liveMatches.length} live matches`);
      
      await applyFilters(liveMatches);
      
    } catch (err) {
      console.error('❌ Error fetching matches:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, [applyFilters]);
  
  const checkNotificationPermissions = useCallback(async () => {
    const status = await checkNotificationStatus();
    setNotificationsReady(status.ready);
    console.log('🔔 Notification status:', status);
    
    if (!status.ready && status.supported) {
      console.log('⚠️ Notifications not ready. User needs to grant permission.');
    }
  }, []);
  
  // ============================================
  // EFFECTS
  // ============================================
  
  // Load showOnlyFiltered from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('live-show-only-filtered');
    setShowOnlyFiltered(saved === 'true' ? true : false);
  }, []);
  
  // Persist showOnlyFiltered to localStorage when it changes
  useEffect(() => {
    if (showOnlyFiltered !== null) {
      localStorage.setItem('live-show-only-filtered', String(showOnlyFiltered));
    }
  }, [showOnlyFiltered]);
  
  useEffect(() => {
    loadUserFilters();
    fetchMatches();
    checkNotificationPermissions();
  }, [loadUserFilters, fetchMatches, checkNotificationPermissions]);
  
  useEffect(() => {
    if (matches.length > 0 && userFilters.length > 0) {
      applyFilters(matches);
    }
  }, [userFilters, matches, applyFilters]);
  
  useEffect(() => {
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
  
  const handleToggleScanner = async () => {
    if (!scannerEnabled && !notificationsReady) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('You must grant notification permission to enable the scanner!');
        return;
      }
      setNotificationsReady(true);
    }
    
    setScannerEnabled(!scannerEnabled);
    console.log(`🔄 Scanner ${!scannerEnabled ? 'ENABLED' : 'DISABLED'}`);
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text mb-2">
                ⚽ Live Matches
              </h1>
              <p className="text-text-secondary">
                {lastUpdate ? (
                  <>Last update: {lastUpdate.toLocaleTimeString()}</>
                ) : (
                  'Loading matches...'
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
          </div>
          
          {/* ========== STATS BAR ========== */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="stat-card">
              <div className="stat-label">Live Matches</div>
              <div className="stat-value">{matches.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">With Filters</div>
              <div className="stat-value text-accent-green">{matchesWithFilters}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Filters</div>
              <div className="stat-value">{activeFiltersCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Scans</div>
              <div className="stat-value text-accent-amber">{scannerStats.totalScans}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Notifications</div>
              <div className="stat-value text-accent-purple">{scannerStats.notificationsSent}</div>
            </div>
          </div>
          
          {/* ========== SCANNER CONTROL ========== */}
          <div className="glass-card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left side - Info */}
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                {scannerEnabled ? (
                  <Zap className="w-6 h-6 text-accent-green animate-pulse flex-shrink-0" />
                ) : (
                  <Zap className="w-6 h-6 text-text-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-lg">
                    Auto-Scanner
                    {scannerStats.isScanning && (
                      <span className="ml-2 text-sm text-accent-cyan">Scanning...</span>
                    )}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {scannerEnabled ? (
                      <>
                        ✅ Active - auto-scanning every 45s
                        {scannerStats.lastScanTime && (
                          <> • Last: {scannerStats.lastScanTime.toLocaleTimeString()}</>
                        )}
                      </>
                    ) : (
                      'Disabled - enable for automatic notifications'
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
                
                {/* Scanner Toggle */}
                <button
                  onClick={handleToggleScanner}
                  className={`
                    px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all flex items-center gap-2 text-sm sm:text-base whitespace-nowrap
                    ${scannerEnabled 
                      ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30 border-2 border-accent-green' 
                      : 'bg-glass-light text-text-secondary hover:bg-glass-medium border-2 border-glass-medium'}
                  `}
                >
                  {scannerEnabled ? (
                    <>
                      <BellOff className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Stop Scanner</span>
                      <span className="sm:hidden">Stop</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Start Scanner</span>
                      <span className="sm:hidden">Start</span>
                    </>
                  )}
                </button>
                
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
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
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
                    onClick={() => handleMatchClick(match)}
                    showStatistics={false}
                    filterResults={filterResults.get(match.fixture.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
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
