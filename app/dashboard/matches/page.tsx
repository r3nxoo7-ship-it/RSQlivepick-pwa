'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, Activity } from 'lucide-react';
import { getLiveMatches, getLiveAndUpcomingMatches, LiveMatch } from '@/lib/unified-api';
import LiveMatchesDashboardV2 from '@/components/LiveMatchesDashboardV2';
import { dbHelpers, authHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';

export default function MatchesAnalyticsPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<LiveMatch[]>([]);
  const [scheduledMatches, setScheduledMatches] = useState<LiveMatch[]>([]);
  const [teamForm, setTeamForm] = useState<Record<string, any>>({});
  const [userFilters, setUserFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Use user ID as stable dependency to avoid infinite re-render loops
  // (getCurrentUser() returns a new object reference each call)
  const userId = authHelpers.getCurrentUser()?.id;

  const loadData = useCallback(async () => {
    try {
      if (!userId) {
        console.log('⏸️ Matches page: No user logged in');
        setLoading(false);
        return;
      }

      console.log('🔄 Matches page: Loading data...');

      // Try to get separated live and upcoming matches first
      const separated = await getLiveAndUpcomingMatches();
      if (separated.live.length > 0 || separated.upcoming.length > 0 || separated.scheduled.length > 0) {
        console.log(`📊 Got ${separated.live.length} live, ${separated.upcoming.length} upcoming, ${separated.scheduled.length} scheduled matches`);
        setLiveMatches(separated.live);
        setUpcomingMatches(separated.upcoming);
        setScheduledMatches(separated.scheduled);
        setTeamForm(separated.teamForm || {});
        setMatches([...separated.live, ...separated.upcoming]);
      } else {
        // Fallback to old format
        const allMatches = await getLiveMatches();
        console.log(`📊 Got ${allMatches?.length || 0} total matches (fallback)`);
        setMatches(allMatches || []);
        setLiveMatches([]);
        setUpcomingMatches([]);
      }

      // Load user filters
      const filters = await dbHelpers.getUserFilters(userId);
      console.log(`🔍 Got ${filters.length} user filters`);
      setUserFilters(filters);

      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
      console.log('✅ Matches page: Data loaded successfully');
    } catch (err) {
      console.error('❌ Matches page: Error loading data:', err);
      setLastUpdate('Error loading data');
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
    // Auto-refresh 
    const interval = setInterval(() => {
      loadData();
    }, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-background pt-20 md:pt-28 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-20 md:top-28 z-40 bg-background/80 backdrop-blur-md border-b border-glass-light/20 py-6"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-accent-cyan" />
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent">
                Live & Upcoming Matches
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition disabled:opacity-50 flex items-center gap-2 ${
                refreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              {refreshing ? 'Updating...' : 'Refresh'}
            </button>
          </div>
          <p className="text-text-secondary mt-1">
            Real-time match stats • Filter predictions • Today + 7-day schedule{lastUpdate && ` • Updated: ${lastUpdate}`}
          </p>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <LiveMatchesDashboardV2
          matches={matches}
          liveMatches={liveMatches}
          upcomingMatches={upcomingMatches}
          scheduledMatches={scheduledMatches}
          teamForm={teamForm}
          userFilters={userFilters}
          loading={loading}
        />
      </div>
    </div>
  );
}
