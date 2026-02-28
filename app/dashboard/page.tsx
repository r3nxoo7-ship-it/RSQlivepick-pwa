'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  TrendingUp,
  Bell,
  Filter as FilterIcon,
  Zap,
  ChevronDown,
  Clock,
  Radio,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import PredictionsTable from '@/components/PredictionsTable';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter, TriggeredMatch } from '@/lib/supabase';
import type { LiveMatch } from '@/lib/unified-api';

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
    if (!group.triggers.some(t => t.filter_id === m.filter_id)) {
      group.triggers.push(m);
    }
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

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [todayMatches, setTodayMatches] = useState<LiveMatch[]>([]);

  const [stats, setStats] = useState({
    activeFilters: 0,
    withNotifications: 0,
    liveMatches: 0,
    totalMatches: 0,
    todayTriggers: 0,
  });
  const [recentTriggers, setRecentTriggers] = useState<TriggeredMatch[]>([]);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      // Load filters
      const userFilters = await dbHelpers.getUserFilters(currentUser.id);

      // Load matches - try separated first for today's upcoming
      let allMatches: LiveMatch[] = [];
      try {
        const separatedRes = await fetch('/api/matches/live-and-upcoming');
        if (separatedRes.ok) {
          const separated = await separatedRes.json();
          if (separated.upcoming.length > 0 || separated.live.length > 0) {
            allMatches = [...separated.live, ...separated.upcoming];
          } else {
            const liveRes = await fetch('/api/matches/live');
            if (liveRes.ok) {
              const { matches } = await liveRes.json();
              allMatches = matches;
            }
          }
        }
      } catch {
        try {
          const liveRes = await fetch('/api/matches/live');
          if (liveRes.ok) {
            const { matches } = await liveRes.json();
            allMatches = matches;
          }
        } catch { /* ignore */ }
      }

      // Filter to today's matches only for predictions table
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayOnly = allMatches.filter(m => {
        const matchDate = m.fixture?.date ? new Date(m.fixture.date) : null;
        return matchDate && matchDate >= today && matchDate < tomorrow;
      });
      setTodayMatches(todayOnly);

      // Count actually live matches
      const actuallyLive = allMatches.filter(m => {
        const status = m.fixture?.status?.short;
        return status === 'LIVE' || status === '1H' || status === '2H' || status === 'HT';
      });

      const activeFilters = userFilters.filter(f => f.is_active);
      const withNotifications = userFilters.filter(f => f.is_active && f.notification_enabled);
      const totalTriggers = userFilters.reduce((sum, f) => sum + (f.trigger_count || 0), 0);

      setStats({
        activeFilters: activeFilters.length,
        withNotifications: withNotifications.length,
        liveMatches: actuallyLive.length,
        totalMatches: allMatches.length,
        todayTriggers: totalTriggers,
      });

      // Load recent triggered matches
      try {
        const params = new URLSearchParams({
          user_id: currentUser.id,
          range: '7d',
          limit: '5',
        });
        const trigRes = await fetch(`/api/triggered-matches/list?${params}`);
        const trigResult = await trigRes.json();
        setRecentTriggers(trigResult.matches || []);
      } catch {
        // ignore
      }

    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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
          <p className="text-text-secondary font-display">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const recentGroups = groupRecentByMatch(recentTriggers);

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-primary p-4 sm:p-6 text-text-primary">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* HEADER */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold gradient-text mb-1">
                {getGreeting()}, {user?.full_name || user?.username || 'User'}!
              </h1>
              <p className="text-text-secondary text-sm">Your betting command center</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-accent-green text-xs font-bold">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              ONLINE
            </div>
          </div>

          {/* COMPACT STATS ROW */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/dashboard/live')}
              className="glass-card p-3 text-center hover:border-accent-green/40 transition-colors group"
            >
              <Radio className="w-4 h-4 text-accent-green mx-auto mb-1 group-hover:animate-pulse" />
              <div className="text-xl sm:text-2xl font-bold text-accent-green">{stats.liveMatches}</div>
              <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">Live</div>
            </button>

            <button
              onClick={() => router.push('/dashboard/live')}
              className="glass-card p-3 text-center hover:border-accent-cyan/40 transition-colors"
            >
              <Activity className="w-4 h-4 text-accent-cyan mx-auto mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-accent-cyan">{stats.totalMatches}</div>
              <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">Scanning</div>
            </button>

            <button
              onClick={() => router.push('/dashboard/filters')}
              className="glass-card p-3 text-center hover:border-accent-amber/40 transition-colors"
            >
              <FilterIcon className="w-4 h-4 text-accent-amber mx-auto mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-accent-amber">{stats.activeFilters}</div>
              <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">Filters</div>
            </button>

            <button
              onClick={() => router.push('/dashboard/notifications')}
              className="glass-card p-3 text-center hover:border-accent-purple/40 transition-colors"
            >
              <Bell className="w-4 h-4 text-accent-purple mx-auto mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-accent-purple">{stats.withNotifications}</div>
              <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">Alerts</div>
            </button>

            <button
              onClick={() => router.push('/dashboard/history')}
              className="glass-card p-3 text-center hover:border-accent-blue/40 transition-colors col-span-3 sm:col-span-1"
            >
              <TrendingUp className="w-4 h-4 text-accent-blue mx-auto mb-1" />
              <div className="text-xl sm:text-2xl font-bold text-accent-blue">{stats.todayTriggers}</div>
              <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">Triggers</div>
            </button>
          </div>

          {/* TODAY'S PREDICTIONS TABLE */}
          <PredictionsTable matches={todayMatches} />

          {/* RECENT ACTIVITY */}
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
              <Zap className="text-accent-cyan w-5 h-5" /> Recent Activity
            </h3>
            <div className="space-y-2">
              {recentGroups.length === 0 ? (
                <p className="text-text-secondary italic text-sm text-center py-6">
                  No recent triggers. Triggers appear when live matches meet your filter conditions.
                </p>
              ) : (
                recentGroups.map((group) => {
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
                })
              )}
            </div>
            {recentGroups.length > 0 && (
              <button
                onClick={() => router.push('/dashboard/history')}
                className="mt-4 w-full btn-secondary text-sm"
              >
                View Full History
              </button>
            )}
          </div>

        </div>
      </div>
    </AuthWrapper>
  );
}
