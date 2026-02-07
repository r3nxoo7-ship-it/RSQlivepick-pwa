'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, Activity } from 'lucide-react';
import { getLiveMatches, LiveMatch } from '@/lib/api-football';
import LiveMatchesDashboard from '@/components/LiveMatchesDashboard';
import { dbHelpers, authHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';

export default function MatchesAnalyticsPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [userFilters, setUserFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const user = authHelpers.getCurrentUser();

  const loadData = useCallback(async () => {
    try {
      if (!user) {
        console.log('⏸️ Matches page: No user logged in');
        setLoading(false);
        return;
      }

      console.log('🔄 Matches page: Loading data...');

      // Load live matches
      const liveMatches = await getLiveMatches();
      console.log(`📊 Matches page: Got ${liveMatches?.length || 0} live matches`);
      setMatches(liveMatches || []);

      // Load user filters
      const filters = await dbHelpers.getUserFilters(user.id);
      console.log(`🔍 Matches page: Got ${filters.length} user filters`);
      setUserFilters(filters);

      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
      console.log('✅ Matches page: Data loaded successfully');
    } catch (err) {
      console.error('❌ Matches page: Error loading data:', err);
      setLastUpdate(`Error at ${new Date().toLocaleTimeString()}`);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadData();
    }, 30000);
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
                Live Matches Analytics
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
            Real-time match stats • Filter predictions • Dynamic diagnostics • Updated: {lastUpdate}
          </p>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <LiveMatchesDashboard matches={matches} userFilters={userFilters} loading={loading} />
      </div>
    </div>
  );
}
