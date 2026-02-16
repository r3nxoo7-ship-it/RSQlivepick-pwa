'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  Bell,
  Filter as FilterIcon,
  Zap,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';
import { getLiveMatches, type LiveMatch } from '@/lib/unified-api';

export default function DashboardPage() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  const [user, setUser] = useState<any>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalFilters: 0,
    activeFilters: 0,
    withNotifications: 0,
    liveMatches: 0,
    todayTriggers: 0,
    successRate: 0,
  });

  // ============================================
  // LOAD DATA (Optimizat cu useCallback)
  // ============================================
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);
      
      // Load filters from Supabase
      const userFilters = await dbHelpers.getUserFilters(currentUser.id);
      setFilters(userFilters);
      
      // Load live matches
      let matches: LiveMatch[] = [];
      try {
        matches = await getLiveMatches();
        setLiveMatches(matches);
      } catch (err) {
        console.error('Error loading matches:', err);
      }

      // Count only actually live matches (in progress), not upcoming/scheduled
      const actuallyLive = matches.filter(m => {
        const status = m.fixture?.status?.short;
        return status === 'LIVE' || status === '1H' || status === '2H' || status === 'HT';
      });

      const activeFilters = userFilters.filter(f => f.is_active);
      const withNotifications = userFilters.filter(f => f.is_active && f.notification_enabled);
      const totalTriggers = userFilters.reduce((sum, f) => sum + (f.trigger_count || 0), 0);

      setStats({
        totalFilters: userFilters.length,
        activeFilters: activeFilters.length,
        withNotifications: withNotifications.length,
        liveMatches: actuallyLive.length,
        todayTriggers: totalTriggers,
        successRate: 0,
      });
      
    } catch (err) {
      console.error('❌ Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ============================================
  // HELPERS
  // ============================================
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-display">Syncing R$Q LIVE...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-primary p-6 text-text-primary">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* HEADER */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold gradient-text mb-2">
                {getGreeting()}, {user?.full_name || user?.username || 'User'}! 👋
              </h1>
              <p className="text-text-secondary">Command center is operational.</p>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-xs text-text-muted uppercase tracking-widest mb-1">Server Status</div>
              <div className="flex items-center gap-2 text-accent-green font-bold">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                SYSTEM ACTIVE 2026
              </div>
            </div>
          </div>
          
          {/* STATS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Live Matches Card */}
            <motion.div
              whileHover={{ y: -5 }}
              onClick={() => router.push('/dashboard/live')}
              className="glass-card-hover p-6 cursor-pointer border-l-4 border-l-accent-green"
            >
              <div className="flex justify-between mb-4">
                <div className="p-3 rounded-xl bg-accent-green/10 text-accent-green">
                  <Activity size={24} />
                </div>
                <span className="status-live">LIVE</span>
              </div>
              <div className="stat-value">{stats.liveMatches}</div>
              <div className="stat-label">Matches Scanning</div>
            </motion.div>

            {/* Active Filters + Notifications Combined Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="glass-card-hover p-6 border-l-4 border-l-accent-cyan"
            >
              <div className="space-y-4">
                {/* Active Filters Section */}
                <div 
                  onClick={() => router.push('/dashboard/filters')}
                  className="cursor-pointer pb-4 border-b border-glass-medium"
                >
                  <div className="flex justify-between mb-3">
                    <div className="p-2 rounded-lg bg-accent-cyan/10 text-accent-cyan">
                      <FilterIcon size={20} />
                    </div>
                    <Zap size={16} className="text-accent-amber" />
                  </div>
                  <div className="stat-value text-lg">{stats.activeFilters}</div>
                  <div className="stat-label text-sm">Active Filters</div>
                </div>
                
                {/* Notifications Section */}
                <div 
                  onClick={() => router.push('/dashboard/notifications')}
                  className="cursor-pointer pt-2"
                >
                  <div className="flex justify-between mb-3">
                    <div className="p-2 rounded-lg bg-accent-red/10 text-accent-red">
                      <Bell size={20} />
                    </div>
                    <AlertCircle size={16} className="text-text-muted" />
                  </div>
                  <div className="stat-value text-lg">{stats.withNotifications}</div>
                  <div className="stat-label text-sm">Telegram Alerts</div>
                </div>
              </div>
            </motion.div>

            {/* Total Triggers Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="glass-card-hover p-6 border-l-4 border-l-accent-purple"
            >
              <div className="flex justify-between mb-4">
                <div className="p-3 rounded-xl bg-accent-purple/10 text-accent-purple">
                  <TrendingUp size={24} />
                </div>
                <CheckCircle size={18} className="text-accent-green" />
              </div>
              <div className="stat-value">{stats.todayTriggers}</div>
              <div className="stat-label">Total Triggers</div>
            </motion.div>

          </div>

          {/* QUICK ACTIONS / INFO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Zap className="text-accent-cyan" size={20} /> Recent Activity
              </h3>
              <div className="space-y-4">
                <p className="text-text-secondary italic text-sm text-center py-10">
                  Live matches are being processed in the background. Last 5 triggers will appear here...
                </p>
              </div>
              <button 
                onClick={() => router.push('/dashboard/analytics')}
                className="mt-6 w-full btn-secondary"
              >
                View Full History (30 min)
              </button>
            </div>

            {/* Quick Start Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-6 bg-gradient-to-br from-accent-cyan/5 to-transparent">
                <h3 className="text-sm font-bold mb-3">Create Filters</h3>
                <p className="text-xs text-text-secondary mb-4">Set up custom filters for instant notifications.</p>
                <button 
                  onClick={() => router.push('/dashboard/filters')}
                  className="btn-primary w-full text-sm py-2"
                >
                  Go to Filters
                </button>
              </div>

              <div className="glass-card p-6 bg-gradient-to-br from-accent-purple/5 to-transparent">
                <h3 className="text-sm font-bold mb-3">Notifications</h3>
                <p className="text-xs text-text-secondary mb-4">Configure Telegram & web notifications.</p>
                <button 
                  onClick={() => router.push('/dashboard/notifications')}
                  className="btn-primary w-full text-sm py-2"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AuthWrapper>
  );
}
