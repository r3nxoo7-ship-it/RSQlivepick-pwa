'use client';

// ============================================
// R$Q - LIVE MATCHES PAGE (WITH AUTO-SCANNER)
// ============================================

import { DynamicStatBar } from '@/components/DynamicStatBar';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  Filter as FilterIcon, 
  Activity, 
  Target, 
  Zap,
} from 'lucide-react';
import { getLiveMatches, getMatchStatistics, LiveMatch } from '@/lib/unified-api';
import MatchCard from '@/components/MatchCard';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';
import { applyFiltersToMatches, FilterMatchResult } from '@/lib/filter-engine';
import { useBackgroundScanner } from '@/lib/background-scanner';
import { checkNotificationStatus } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LiveMatchesPage() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Modal & Stats State
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);
  const [selectedMatchStats, setSelectedMatchStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Filter state
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [userFilters, setUserFilters] = useState<Filter[]>([]);
  const [filterResults, setFilterResults] = useState<Map<number, FilterMatchResult[]>>(new Map());
  const [showOnlyFiltered, setShowOnlyFiltered] = useState<boolean | null>(null);
  const [applyingFilters, setApplyingFilters] = useState(false);
  
  // Scanner state
  const [scannerStats, setScannerStats] = useState({
    isRunning: false,
    totalScans: 0,
    notificationsSent: 0,
    activeFilters: 0,
    matchesScanned: 0,
    lastScanTime: null as Date | null,
  });
  
  const [recentlyTriggered, setRecentlyTriggered] = useState<any[]>([]);
  const backgroundScanner = useBackgroundScanner(true);
  
  // ============================================
  // LOAD FUNCTIONS
  // ============================================
  
  const loadRecentlyTriggered = useCallback(async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;
      const triggered = await dbHelpers.getTriggeredMatches(currentUser.id, 20, 10);
      setRecentlyTriggered(triggered);
    } catch (err) {
      console.error('Error loading triggered matches:', err);
    }
  }, []);

  const loadUserFilters = useCallback(async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return [];
      const filters = await dbHelpers.getUserFilters(currentUser.id);
      setUserFilters(filters);
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
      const liveMatches = await getLiveMatches();
      setMatches(liveMatches);
      setLastUpdate(new Date());
      
      if (userFilters.length > 0) {
        setApplyingFilters(true);
        const results = await applyFiltersToMatches(liveMatches, userFilters);
        setFilterResults(results);
        setApplyingFilters(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, [userFilters]);
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleMatchClick = async (match: LiveMatch) => {
    setSelectedMatch(match);
    setLoadingStats(true);
    setSelectedMatchStats(null); // Reset anterior
    try {
      const fixtureId = match.fixture?.id;
      if (fixtureId) {
        const stats = await getMatchStatistics(Number(fixtureId));
        const mapped = stats.reduce((acc: any, s: any) => {
          acc[s.type] = { home: s.home, away: s.away };
          return acc;
        }, {});
        setSelectedMatchStats(mapped);
      }
    } catch (err) {
      console.error("Eroare statistici:", err);
    } finally {
      setLoadingStats(false);
    }
  };
  
  const handleRefresh = () => {
    fetchMatches();
  };

  // ============================================
  // EFFECTS
  // ============================================
  
  useEffect(() => {
    const saved = localStorage.getItem('live-show-only-filtered');
    setShowOnlyFiltered(saved === 'true');
    loadUserFilters();
  }, [loadUserFilters]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

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

  useEffect(() => {
    loadRecentlyTriggered();
    const interval = setInterval(loadRecentlyTriggered, 10000);
    return () => clearInterval(interval);
  }, [loadRecentlyTriggered]);

  // ============================================
  // RENDER LOGIC
  // ============================================
  const leagues = Array.from(new Set(matches.map(m => m.league?.name || 'Unknown')));
  let filteredMatches = selectedLeague === 'all' 
    ? matches 
    : matches.filter(m => m.league?.name === selectedLeague);
  
  if (showOnlyFiltered) {
    filteredMatches = filteredMatches.filter(m => m.fixture?.id && filterResults.has(m.fixture.id));
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-xl overflow-hidden mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/20 to-accent-blue/20"></div>
            <div className="relative p-8 flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent">⚽ Live Analytics</h1>
                <p className="text-text-secondary">{matches.length} matches active</p>
              </div>
              <button onClick={handleRefresh} disabled={loading} className="btn-secondary flex gap-2">
                <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </motion.div>

          {/* STATS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-card p-4 text-center border-b-2 border-accent-cyan">
              <p className="text-xs text-text-secondary uppercase">Live</p>
              <p className="text-2xl font-black text-accent-cyan">{matches.length}</p>
            </div>
            <div className="glass-card p-4 text-center border-b-2 border-accent-green">
              <p className="text-xs text-text-secondary uppercase">Matched</p>
              <p className="text-2xl font-black text-accent-green">{Array.from(filterResults.keys()).length}</p>
            </div>
            {/* ... rest of stats ... */}
          </div>

          {/* FILTERS SECTION */}
          <div className="glass-card p-4 flex gap-4 items-center">
            <FilterIcon className="text-accent-cyan" />
            <select value={selectedLeague} onChange={(e) => setSelectedLeague(e.target.value)} className="input-field max-w-xs">
              <option value="all">All Leagues</option>
              {leagues.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showOnlyFiltered || false} onChange={(e) => setShowOnlyFiltered(e.target.checked)} className="accent-accent-cyan" />
              <span className="text-sm font-bold">Show Only Filtered</span>
            </label>
          </div>

          {/* MATCH GRID */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMatches.map((match) => (
                <MatchCard 
                  key={match.fixture.id} 
                  match={match} 
                  onClick={() => handleMatchClick(match)}
                  filterResults={filterResults.get(match.fixture.id)}
                />
              ))}
            </div>
          )}

          {/* MODAL STATISTICI */}
          {selectedMatch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-[#050505] border border-white/10 rounded-3xl w-full max-w-md p-6 relative">
                <button onClick={() => setSelectedMatch(null)} className="absolute top-5 right-5 text-white/50 text-2xl">✕</button>
                
                <div className="text-center mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <p className="flex-1 font-black uppercase text-sm">{selectedMatch.teams.home.name}</p>
                    <div className="mx-4 bg-white text-black px-4 py-1 font-black text-2xl skew-x-[-10deg]">
                      {selectedMatch.goals.home} - {selectedMatch.goals.away}
                    </div>
                    <p className="flex-1 font-black uppercase text-sm text-right">{selectedMatch.teams.away.name}</p>
                  </div>
                  <span className="text-accent-cyan text-xs font-bold animate-pulse tracking-widest uppercase">
                    Minute {selectedMatch.fixture.status.elapsed}&apos;
                  </span>
                </div>

                <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/5">
                  {loadingStats ? (
                    <div className="py-10 text-center animate-pulse text-accent-cyan font-bold">LOADING LIVE DATA...</div>
                  ) : selectedMatchStats ? (
                    <>
                      <DynamicStatBar 
                        label="Dangerous Attacks" 
                        homeValue={selectedMatchStats['Dangerous Attacks']?.home || 0} 
                        awayValue={selectedMatchStats['Dangerous Attacks']?.away || 0} 
                      />
                      <DynamicStatBar 
                        label="Shots on Target" 
                        homeValue={selectedMatchStats['Shots on Goal']?.home || 0} 
                        awayValue={selectedMatchStats['Shots on Goal']?.away || 0} 
                      />
                      <DynamicStatBar 
                        label="Possession %" 
                        homeValue={parseInt(selectedMatchStats['Ball Possession']?.home) || 0} 
                        awayValue={parseInt(selectedMatchStats['Ball Possession']?.away) || 0} 
                      />
                    </>
                  ) : (
                    <p className="text-center py-10 opacity-30">No stats available</p>
                  )}
                </div>
              </motion.div>
            </div>
          )}

        </div>
      </div>
    </AuthWrapper>
  );
}