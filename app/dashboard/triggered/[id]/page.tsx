'use client';

// ============================================
// R$Q - TRIGGERED MATCH DETAILS PAGE
// ============================================
// Shows detailed information about a triggered match
// Accessed from notification clicks and history

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Target,
  Trophy,
  BarChart3,
  Users,
  Zap,
  AlertCircle,
  Layers,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import AuthWrapper from '@/components/AuthWrapper';
import { getMatchStatistics, LiveMatch, getMatchById } from '@/lib/unified-api';
import Link from 'next/link';

export default function TriggeredMatchDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id as string;

  const [triggered, setTriggered] = useState<any>(null);
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load triggered match data from database
  useEffect(() => {
    const loadTriggeredMatch = async () => {
      try {
        const currentUser = authHelpers.getCurrentUser();
        if (!currentUser) {
          setError('Authentication required');
          return;
        }

        // Get triggered match from API (uses service role key to bypass RLS)
        const params = new URLSearchParams({ user_id: currentUser.id, id: matchId });
        const res = await fetch(`/api/triggered-matches/list?${params}`);
        const result = await res.json();

        if (!res.ok || !result.match) {
          setError('Triggered match not found');
          return;
        }

        const foundTriggered = result.match;
        setTriggered(foundTriggered);

        // Fetch live match data
        try {
          const matchData = await getMatchById(foundTriggered.match_id);
          setMatch(matchData);

          // Fetch detailed statistics
          const statsData = await getMatchStatistics(parseInt(foundTriggered.match_id));
          setStats(statsData);
        } catch (statsError) {
          console.error('Error fetching match data:', statsError);
          // Still continue - we have triggered match data
        }

        setError(null);
      } catch (err) {
        console.error('Error loading triggered match:', err);
        setError(err instanceof Error ? err.message : 'Failed to load match');
      } finally {
        setLoading(false);
      }
    };

    loadTriggeredMatch();
  }, [matchId]);

  if (loading) {
    return (
      <AuthWrapper>
        <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan mb-4"></div>
            <p className="text-text-secondary">Loading match details...</p>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  if (error || !triggered) {
    return (
      <AuthWrapper>
        <div className="min-h-screen p-4 sm:p-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center"
            >
              <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <p className="text-red-200">{error || 'Match not found'}</p>
              <button
                onClick={() => router.push('/dashboard/live')}
                className="mt-4 btn-secondary"
              >
                ← Back to Live Matches
              </button>
            </motion.div>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  const homeTeam = triggered.home_team;
  const awayTeam = triggered.away_team;
  const filterName = triggered.filter_name;
  const triggeredAt = new Date(triggered.triggered_at);
  const homeScore = triggered.score_home || 0;
  const awayScore = triggered.score_away || 0;

  // Get statistics for each team
  const homeStats = stats?.statistics?.[0];
  const awayStats = stats?.statistics?.[1];

  return (
    <AuthWrapper>
      <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-b from-background to-background-secondary">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ========== HEADER ========== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors p-2 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center flex-1">
              🎯 Triggered Match Details
            </h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </motion.div>

          {/* ========== TRIGGER INFO ========== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
          >
            {/* Filter that triggered */}
            <div className="p-4 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-text-secondary mb-1">Filter Activated</p>
                  <p className="font-semibold text-sm sm:text-base text-accent-cyan truncate">
                    {filterName}
                  </p>
                </div>
              </div>
            </div>

            {/* Trigger time */}
            <div className="p-4 rounded-lg bg-accent-blue/10 border border-accent-blue/30">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-text-secondary mb-1">Triggered At</p>
                  <p className="font-semibold text-sm sm:text-base text-accent-blue">
                    {triggeredAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {triggeredAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ========== MATCH SCORE CARD ========== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 sm:p-8 rounded-lg bg-gradient-to-br from-accent-cyan/10 to-accent-blue/10 border border-glass-light"
          >
            <p className="text-center text-sm sm:text-base text-text-secondary mb-4">
              {triggered.league_name} • {triggered.match_status?.toUpperCase()}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <img
                  src={match?.teams?.home?.logo || `https://via.placeholder.com/64?text=${homeTeam}`}
                  alt={homeTeam}
                  className="w-16 h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://via.placeholder.com/64?text=${homeTeam}`;
                  }}
                />
                <p className="font-semibold text-center line-clamp-2 text-sm sm:text-base">
                  {homeTeam}
                </p>
              </div>

              {/* Score */}
              <div className="flex items-center gap-6 sm:gap-8">
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-accent-cyan font-display">
                    {homeScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl text-text-secondary font-semibold">:</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-accent-blue font-display">
                    {awayScore}
                  </p>
                </div>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <img
                  src={match?.teams?.away?.logo || `https://via.placeholder.com/64?text=${awayTeam}`}
                  alt={awayTeam}
                  className="w-16 h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://via.placeholder.com/64?text=${awayTeam}`;
                  }}
                />
                <p className="font-semibold text-center line-clamp-2 text-sm sm:text-base">
                  {awayTeam}
                </p>
              </div>
            </div>
          </motion.div>

          {/* ========== MATCH STATISTICS ========== */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent-cyan" />
                Match Statistics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Possession */}
                {homeStats?.statistics && (
                  <StatCard
                    icon={PieChart}
                    title="Possession"
                    homeValue={homeStats.statistics.find((s: any) => s.type === 'Ball Possession')?.value}
                    awayValue={awayStats?.statistics?.find((s: any) => s.type === 'Ball Possession')?.value}
                    unit="%"
                  />
                )}

                {/* Shots */}
                {homeStats?.statistics && (
                  <StatCard
                    icon={TrendingUp}
                    title="Total Shots"
                    homeValue={homeStats.statistics.find((s: any) => s.type === 'Total Shots')?.value}
                    awayValue={awayStats?.statistics?.find((s: any) => s.type === 'Total Shots')?.value}
                  />
                )}

                {/* Shots on Target */}
                {homeStats?.statistics && (
                  <StatCard
                    icon={Target}
                    title="Shots on Target"
                    homeValue={homeStats.statistics.find((s: any) => s.type === 'Shots on Goal')?.value}
                    awayValue={awayStats?.statistics?.find((s: any) => s.type === 'Shots on Goal')?.value}
                  />
                )}

                {/* Corners */}
                {homeStats?.statistics && (
                  <StatCard
                    icon={Layers}
                    title="Corners"
                    homeValue={homeStats.statistics.find((s: any) => s.type === 'Corner Kicks')?.value}
                    awayValue={awayStats?.statistics?.find((s: any) => s.type === 'Corner Kicks')?.value}
                  />
                )}

                {/* Yellow Cards */}
                {homeStats?.statistics && (
                  <StatCard
                    icon={Layers}
                    title="Yellow Cards"
                    homeValue={homeStats.statistics.find((s: any) => s.type === 'Yellow Cards')?.value}
                    awayValue={awayStats?.statistics?.find((s: any) => s.type === 'Yellow Cards')?.value}
                    color="yellow"
                  />
                )}

                {/* Red Cards */}
                {homeStats?.statistics && (
                  <StatCard
                    icon={Layers}
                    title="Red Cards"
                    homeValue={homeStats.statistics.find((s: any) => s.type === 'Red Cards')?.value}
                    awayValue={awayStats?.statistics?.find((s: any) => s.type === 'Red Cards')?.value}
                    color="red"
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* ========== MATCH INFO ========== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 sm:p-6 rounded-lg bg-glass-dark border border-glass-light"
          >
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-accent-amber" />
              Match Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="League" value={triggered.league_name} />
              <InfoRow label="Status" value={triggered.match_status?.toUpperCase() || 'UNKNOWN'} />
              <InfoRow label="Match ID" value={triggered.match_id} isCopyable />
              <InfoRow label="Triggered At" value={triggeredAt.toLocaleString()} />
            </div>
          </motion.div>

          {/* ========== ACTION BUTTONS ========== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4"
          >
            <Link
              href="/dashboard/live"
              className="btn-secondary py-3 px-4 text-center"
            >
              ← Back to Live Matches
            </Link>
            <Link
              href="/dashboard/history"
              className="btn-primary py-3 px-4 text-center"
            >
              View All Triggered Matches
            </Link>
          </motion.div>
        </div>
      </div>
    </AuthWrapper>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  homeValue: any;
  awayValue: any;
  unit?: string;
  color?: 'cyan' | 'yellow' | 'red';
}

function StatCard({ icon: Icon, title, homeValue, awayValue, unit = '', color = 'cyan' }: StatCardProps) {
  const colorClasses = {
    cyan: 'accent-cyan',
    yellow: 'accent-amber',
    red: 'text-red-400',
  };

  const colorClass = colorClasses[color];

  return (
    <div className="p-4 rounded-lg bg-glass-dark border border-glass-light">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 text-${colorClass}`} />
        <p className="text-sm font-semibold text-text-secondary">{title}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 items-end">
        {/* Home value */}
        <div className="text-center">
          <p className={`text-2xl font-bold text-${colorClass}`}>
            {homeValue ?? '-'}
          </p>
        </div>

        {/* Divider */}
        <div className="flex justify-center">
          <p className="text-text-tertiary">vs</p>
        </div>

        {/* Away value */}
        <div className="text-center">
          <p className={`text-2xl font-bold text-${colorClass}`}>
            {awayValue ?? '-'}
          </p>
        </div>
      </div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  isCopyable?: boolean;
}

function InfoRow({ label, value, isCopyable = false }: InfoRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3 rounded-lg bg-background">
      <p className="text-xs sm:text-sm text-text-tertiary mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm sm:text-base font-semibold text-text-primary break-all">
          {value}
        </p>
        {isCopyable && (
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 rounded bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors flex-shrink-0"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
