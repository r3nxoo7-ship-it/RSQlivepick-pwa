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
  ChevronDown,
  Clock,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter, TriggeredMatch } from '@/lib/supabase';
import { getLiveMatches, type LiveMatch } from '@/lib/unified-api';

// Group triggers by match_id, dedup by filter_id
interface RecentMatchGroup {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  scoreHome: number | null;
  scoreAway: number | null;
  latestTriggerAt: string;
  triggers: TriggeredMatch[];
}

function groupRecentByMatch(matches: TriggeredMatch[]): RecentMatchGroup[] {
  const map = new Map<string, RecentMatchGroup>();
  for (const m of matches) {
    const key = m.match_id;
    if (!map.has(key)) {
      map.set(key, {
        matchId: key,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        scoreHome: m.score_home,
        scoreAway: m.score_away,
        latestTriggerAt: m.triggered_at,
        triggers: [],
      });
    }
    const group = map.get(key)!;
    // Dedup by filter_id
    if (!group.triggers.some(t => t.filter_id === m.filter_id)) {
      group.triggers.push(m);
    }
    // Keep latest score
    if (new Date(m.triggered_at) > new Date(group.latestTriggerAt)) {
      group.latestTriggerAt = m.triggered_at;
      if (m.score_home != null) group.scoreHome = m.score_home;
      if (m.score_away != null) group.scoreAway = m.score_away;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestTriggerAt).getTime() - new Date(a.latestTriggerAt).getTime()
  );
}

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
  const [recentTriggers, setRecentTriggers] = useState<TriggeredMatch[]>([]);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

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

      // Load recent triggered matches via API
      try {
        const params = new URLSearchParams({
          user_id: currentUser.id,
          range: '7d',
          limit: '5',
        });
        const trigRes = await fetch(`/api/triggered-matches/list?${params}`);
        const trigResult = await trigRes.json();
        setRecentTriggers(trigResult.matches || []);
      } catch (trigErr) {
        console.error('Error loading recent triggers:', trigErr);
      }
      
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
              <div className="space-y-3">
                {(() => {
                  const groups = groupRecentByMatch(recentTriggers);
                  if (groups.length === 0) {
                    return (
                      <p className="text-text-secondary italic text-sm text-center py-8">
                        No recent triggers. Triggers appear when live matches meet your filter conditions.
                      </p>
                    );
                  }
                  return groups.map((group) => {
                    const isExpanded = expandedMatch === group.matchId;
                    const timeSince = (() => {
                      const diffMs = Date.now() - new Date(group.latestTriggerAt).getTime();
                      const mins = Math.floor(diffMs / 60000);
                      const hours = Math.floor(diffMs / 3600000);
                      if (mins < 1) return 'Just now';
                      if (mins < 60) return `${mins}m ago`;
                      return `${hours}h ago`;
                    })();

                    return (
                      <div key={group.matchId} className="rounded-lg bg-glass-light/50 overflow-hidden">
                        {/* Match header - clickable to expand */}
                        <div
                          onClick={() => setExpandedMatch(isExpanded ? null : group.matchId)}
                          className="flex items-center gap-3 p-3 hover:bg-glass-light cursor-pointer transition-colors"
                        >
                          <Zap className="w-4 h-4 text-accent-cyan shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {group.homeTeam} vs {group.awayTeam}
                              {group.scoreHome != null && (
                                <span className="text-accent-green ml-2 font-bold">
                                  {group.scoreHome}-{group.scoreAway}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-text-muted">
                              {group.triggers.length} filter{group.triggers.length > 1 ? 's' : ''} triggered
                            </p>
                          </div>
                          <span className="text-xs text-text-muted shrink-0">{timeSince}</span>
                          <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Expanded: show filters with trigger context */}
                        {isExpanded && (
                          <div className="border-t border-glass-medium px-3 pb-3 space-y-2 pt-2">
                            {group.triggers.map((t) => (
                              <div
                                key={t.id}
                                onClick={() => router.push(`/dashboard/triggered/${t.id}`)}
                                className="flex items-center gap-2 p-2 rounded-md bg-glass-dark/50 hover:bg-glass-dark cursor-pointer transition-colors text-xs"
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() => router.push('/dashboard/history')}
                className="mt-6 w-full btn-secondary"
              >
                View Full History
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
