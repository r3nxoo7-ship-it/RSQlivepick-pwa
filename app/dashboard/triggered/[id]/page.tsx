'use client';

// ============================================
// R$Q - TRIGGERED MATCH DETAILS PAGE
// ============================================
// Shows detailed information about a triggered match
// Accessed from notification clicks and history

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Trophy,
  BarChart3,
  Zap,
  AlertCircle,
  ArrowRightLeft,
  Goal,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import AuthWrapper from '@/components/AuthWrapper';
import { LiveMatch, getMatchById } from '@/lib/unified-api';
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
  const [activeStatsTab, setActiveStatsTab] = useState<'full' | '1st' | '2nd'>('full');
  const [incidents, setIncidents] = useState<any[]>([]);

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

        // Fetch live match data and ESPN statistics
        try {
          const matchData = await getMatchById(foundTriggered.match_id);
          setMatch(matchData);
        } catch (matchError) {
          console.error('Error fetching match data:', matchError);
        }

        // Fetch stats from ESPN summary endpoint
        try {
          const leagueMap: Record<string, string> = {
            'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Serie A': 'ita.1',
            'Bundesliga': 'ger.1', 'Ligue 1': 'fra.1', 'MLS': 'usa.1',
            'Champions League': 'uefa.champions', 'Europa League': 'uefa.europa',
            'Turkish Super Lig': 'tur.1', 'Super Lig': 'tur.1',
            'Eredivisie': 'ned.1', 'Primeira Liga': 'por.1', 'Scottish Premiership': 'sco.1',
            'Polish Ekstraklasa': 'pol.1', 'Ekstraklasa': 'pol.1',
            'Romanian Liga 1': 'rou.1', 'Liga 1': 'rou.1',
            'Slovenian PrvaLiga': 'svn.1', 'PrvaLiga': 'svn.1',
            'Croatian HNL': 'hrv.1', 'HNL': 'hrv.1', 'Croatian First League': 'hrv.1',
            'Bulgarian First League': 'bul.1', 'Bulgarian League': 'bul.1',
            'Czech First League': 'cze.1', 'Czech League': 'cze.1',
            'Finnish Veikkausliiga': 'fin.1', 'Veikkausliiga': 'fin.1',
            'Icelandic Besta deild': 'isl.1', 'Besta deild': 'isl.1',
            'Bosnian Premier League': 'bih.1',
            'Macedonian First League': 'mkd.1',
            'Albanian Superliga': 'alb.1', 'Superliga': 'alb.1',
            'Turkish Cup': 'tur.cup',
            'Polish Cup': 'pol.cup',
            'FA Cup': 'eng.fa',
            'EFL Cup': 'eng.league_cup', 'Carabao Cup': 'eng.league_cup',
            'Scottish Cup': 'sco.fa',
            'Scottish League Cup': 'sco.league_cup',
            'KNVB Beker': 'ned.cup', 'KNVB Cup': 'ned.cup',
            'Belgian Cup': 'bel.cup',
            'Taça de Portugal': 'por.cup', 'Portuguese Cup': 'por.cup',
          };
          const leagueCode = leagueMap[foundTriggered.league_name || ''] || '';
          const leagueParam = leagueCode ? `&league=${leagueCode}` : '';
          const statsRes = await fetch(`/api/espn/match-stats?eventId=${foundTriggered.match_id}${leagueParam}`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.stats) setStats(statsData.stats);
          }
        } catch (statsError) {
          console.error('Error fetching match stats:', statsError);
        }

        // Fetch match incidents timeline from SofaScore
        try {
          const incidentsRes = await fetch(`/api/sofascore/match-incidents?eventId=${foundTriggered.match_id}`);
          if (incidentsRes.ok) {
            const incidentsData = await incidentsRes.json();
            if (incidentsData.incidents && incidentsData.incidents.length > 0) {
              setIncidents(incidentsData.incidents);
            }
          }
        } catch (incidentsError) {
          console.error('Error fetching match incidents:', incidentsError);
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
  // Use final/current match scores from live API, not triggered scores
  const homeScore = match?.score?.fulltime?.home ?? triggered.score_home ?? 0;
  const awayScore = match?.score?.fulltime?.away ?? triggered.score_away ?? 0;
  // Show triggered scores for context
  const triggeredHomeScore = triggered.score_home ?? 0;
  const triggeredAwayScore = triggered.score_away ?? 0;
  const scoreChanged = homeScore !== triggeredHomeScore || awayScore !== triggeredAwayScore;
  // Halftime scores from stats (ESPN/SofaScore) or match data
  const htHome = stats?.homeHalfScore ?? match?.score?.halftime?.home;
  const htAway = stats?.awayHalfScore ?? match?.score?.halftime?.away;
  const hasHalfTime = htHome != null && htAway != null;
  // 2nd half scores (derived)
  const shHome = hasHalfTime ? homeScore - (htHome ?? 0) : null;
  const shAway = hasHalfTime ? awayScore - (htAway ?? 0) : null;
  // Match minute when triggered
  const triggeredMinute = triggered.match_time;

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
              Triggered Match Details
            </h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </motion.div>

          {/* ========== TRIGGER INFO ========== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
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

            {/* When triggered — score + minute */}
            <div className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/30">
              <div className="flex items-start gap-3">
                <Trophy className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-text-secondary mb-1">Score When Triggered</p>
                  <p className="font-semibold text-lg text-white">
                    {triggeredHomeScore} - {triggeredAwayScore}
                  </p>
                  {triggeredMinute != null && (
                    <p className="text-xs text-accent-green font-semibold mt-0.5">
                      at {triggeredMinute}&apos; minute
                    </p>
                  )}
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
              {triggered.league_name} {'\u2022'} {triggered.match_status?.toUpperCase()}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-3 flex-1">
                {match?.teams?.home?.logo && (
                  <Image
                    src={match.teams.home.logo}
                    alt={homeTeam}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                )}
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
                {match?.teams?.away?.logo && (
                  <Image
                    src={match.teams.away.logo}
                    alt={awayTeam}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                )}
                <p className="font-semibold text-center line-clamp-2 text-sm sm:text-base">
                  {awayTeam}
                </p>
              </div>
            </div>

            {/* Score Change Indicator */}
            {scoreChanged && (
              <div className="mt-4 pt-4 border-t border-glass-light/30 text-center text-sm text-text-secondary">
                <p>Triggered at score: <span className="font-semibold text-accent-cyan">{triggeredHomeScore}</span>-<span className="font-semibold text-accent-blue">{triggeredAwayScore}</span>
                  {triggeredMinute != null && <span className="text-text-muted"> ({triggeredMinute}&apos;)</span>}
                </p>
              </div>
            )}

            {/* Halftime / 2nd Half Score Breakdown */}
            {hasHalfTime && (
              <div className="mt-4 pt-4 border-t border-glass-light/30">
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted mb-1">1st Half</p>
                    <p className="font-bold">
                      <span className="text-accent-cyan">{htHome}</span>
                      <span className="text-text-muted mx-1">-</span>
                      <span className="text-accent-blue">{htAway}</span>
                    </p>
                  </div>
                  {shHome != null && shAway != null && shHome >= 0 && shAway >= 0 && (
                    <div className="text-center">
                      <p className="text-[10px] text-text-muted mb-1">2nd Half</p>
                      <p className="font-bold">
                        <span className="text-accent-cyan">{shHome}</span>
                        <span className="text-text-muted mx-1">-</span>
                        <span className="text-accent-blue">{shAway}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* ========== MATCH STATISTICS (ESPN) ========== */}
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

            {/* Stats Tab Selector */}
            <div className="flex gap-1 bg-glass-light/50 rounded-lg p-1">
              <button
                onClick={() => setActiveStatsTab('full')}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition ${
                  activeStatsTab === 'full'
                    ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Full Match
              </button>
              <button
                onClick={() => setActiveStatsTab('1st')}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition ${
                  activeStatsTab === '1st'
                    ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                1st Half
              </button>
              <button
                onClick={() => setActiveStatsTab('2nd')}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition ${
                  activeStatsTab === '2nd'
                    ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                2nd Half
              </button>
            </div>

            {stats ? (
              <div className="space-y-3 p-4 rounded-lg bg-glass-dark border border-glass-light">
                {activeStatsTab === 'full' && (
                  <>
                    <TriggeredStatRow label="Goals" home={homeScore} away={awayScore} />
                    {stats.homePoss > 0 && (
                      <TriggeredStatRow label="Possession" home={stats.homePoss} away={stats.awayPoss} unit="%" />
                    )}
                    {(stats.homeShots > 0 || stats.awayShots > 0) && (
                      <TriggeredStatRow label="Total Shots" home={stats.homeShots} away={stats.awayShots} />
                    )}
                    {(stats.homeSoT > 0 || stats.awaySoT > 0) && (
                      <TriggeredStatRow label="Shots on Target" home={stats.homeSoT} away={stats.awaySoT} />
                    )}
                    {(stats.homeShots > 0 || stats.awayShots > 0) && (stats.homeShots - stats.homeSoT > 0 || stats.awayShots - stats.awaySoT > 0) && (
                      <TriggeredStatRow label="Shots off Target" home={Math.max(0, stats.homeShots - stats.homeSoT)} away={Math.max(0, stats.awayShots - stats.awaySoT)} />
                    )}
                    {(stats.homeCorners > 0 || stats.awayCorners > 0) && (
                      <TriggeredStatRow label="Corners" home={stats.homeCorners} away={stats.awayCorners} />
                    )}
                    {(stats.homeOffsides > 0 || stats.awayOffsides > 0) && (
                      <TriggeredStatRow label="Offsides" home={stats.homeOffsides} away={stats.awayOffsides} />
                    )}
                    {(stats.homeFouls > 0 || stats.awayFouls > 0) && (
                      <TriggeredStatRow label="Fouls" home={stats.homeFouls} away={stats.awayFouls} />
                    )}
                    {(stats.homeYellow > 0 || stats.awayYellow > 0) && (
                      <TriggeredStatRow label="Yellow Cards" home={stats.homeYellow} away={stats.awayYellow} />
                    )}
                    {(stats.homeRed > 0 || stats.awayRed > 0) && (
                      <TriggeredStatRow label="Red Cards" home={stats.homeRed} away={stats.awayRed} />
                    )}
                    {(stats.homeAttacks > 0 || stats.awayAttacks > 0) && (
                      <TriggeredStatRow label="Attacks" home={stats.homeAttacks} away={stats.awayAttacks} />
                    )}
                    {(stats.homeDangerousAttacks > 0 || stats.awayDangerousAttacks > 0) && (
                      <TriggeredStatRow label="Dangerous Attacks" home={stats.homeDangerousAttacks} away={stats.awayDangerousAttacks} />
                    )}
                  </>
                )}

                {activeStatsTab === '1st' && hasHalfTime && (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <TriggeredStatRow label="1st Half Goals" home={htHome} away={htAway} />
                    </div>
                    <p className="text-sm text-text-muted">
                      Detailed 1st half statistics are not available.
                    </p>
                    <p className="text-xs text-text-muted mt-2">
                      Full match statistics shown in &quot;Full Match&quot; tab.
                    </p>
                  </div>
                )}

                {activeStatsTab === '1st' && !hasHalfTime && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-text-muted">
                      1st half data not available for this match.
                    </p>
                  </div>
                )}

                {activeStatsTab === '2nd' && hasHalfTime && shHome != null && shAway != null && shHome >= 0 && shAway >= 0 && (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <TriggeredStatRow label="2nd Half Goals" home={shHome} away={shAway} />
                    </div>
                    <p className="text-sm text-text-muted">
                      Detailed 2nd half statistics are not available.
                    </p>
                    <p className="text-xs text-text-muted mt-2">
                      Full match statistics shown in &quot;Full Match&quot; tab.
                    </p>
                  </div>
                )}

                {activeStatsTab === '2nd' && (!hasHalfTime || shHome == null || shAway == null || shHome < 0 || shAway < 0) && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-text-muted">
                      2nd half data not available for this match.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-glass-dark border border-glass-light text-center">
                <p className="text-sm text-text-muted">Statistics not available for this match</p>
              </div>
            )}
          </motion.div>

          {/* ========== MATCH TIMELINE / INCIDENTS ========== */}
          {incidents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-4"
            >
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent-purple" />
                Match Timeline
              </h2>

              <div className="p-4 rounded-lg bg-glass-dark border border-glass-light">
                <div className="space-y-2">
                  {incidents
                    .filter((inc: any) => {
                      // Only show relevant event types
                      const type = inc.incidentType || '';
                      return ['goal', 'yellowCard', 'card', 'redCard', 'yellowRedCard', 'substitution', 'penalty', 'penaltyMiss', 'ownGoal'].includes(type);
                    })
                    .sort((a: any, b: any) => (a.time || 0) - (b.time || 0))
                    .map((inc: any, idx: number) => {
                      const minute = inc.time || 0;
                      const type = inc.incidentType || '';
                      const isHome = inc.isHome;
                      const playerName = inc.player?.name || inc.playerIn?.name || 'Unknown';
                      const playerOut = inc.playerOut?.name;

                      // Determine icon and color based on event type
                      let icon = '•';
                      let colorClass = 'text-text-muted';
                      let bgClass = 'bg-glass-light';

                      if (type === 'goal' || type === 'penalty') {
                        icon = '⚽';
                        colorClass = 'text-accent-green';
                        bgClass = 'bg-accent-green/10';
                      } else if (type === 'ownGoal') {
                        icon = '⚽';
                        colorClass = 'text-accent-red';
                        bgClass = 'bg-accent-red/10';
                      } else if (type === 'yellowCard' || type === 'card') {
                        icon = '🟨';
                        colorClass = 'text-accent-amber';
                        bgClass = 'bg-accent-amber/10';
                      } else if (type === 'redCard' || type === 'yellowRedCard') {
                        icon = '🟥';
                        colorClass = 'text-accent-red';
                        bgClass = 'bg-accent-red/10';
                      } else if (type === 'substitution') {
                        icon = '🔄';
                        colorClass = 'text-accent-blue';
                        bgClass = 'bg-accent-blue/10';
                      } else if (type === 'penaltyMiss') {
                        icon = '❌';
                        colorClass = 'text-accent-red';
                        bgClass = 'bg-accent-red/10';
                      }

                      // Format event description
                      let description = playerName;
                      if (type === 'substitution' && playerOut) {
                        description = `${playerName} → ${playerOut}`;
                      } else if (type === 'ownGoal') {
                        description = `${playerName} (OG)`;
                      } else if (type === 'penaltyMiss') {
                        description = `${playerName} (Penalty miss)`;
                      }

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-2.5 rounded-lg ${bgClass} transition-all hover:scale-[1.01]`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-bold text-accent-cyan w-8 shrink-0 text-center">
                              {minute}&apos;
                            </span>
                            <span className="text-lg">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${colorClass} truncate`}>
                                {description}
                              </p>
                              {isHome !== undefined && (
                                <p className="text-xs text-text-muted">
                                  {isHome ? homeTeam : awayTeam}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
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
              {triggeredMinute != null && (
                <InfoRow label="Match Minute" value={`${triggeredMinute}'`} />
              )}
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

function TriggeredStatRow({ label, home, away, unit = '' }: { label: string; home: number; away: number; unit?: string }) {
  const total = home + away;
  const homePercent = total === 0 ? 50 : Math.round((home / total) * 100);
  const awayPercent = 100 - homePercent;
  const homeLeads = home > away;
  const awayLeads = away > home;

  return (
    <div className="space-y-1">
      <div className="text-center text-xs text-text-muted">{label}</div>
      <div className="flex items-center gap-3">
        <div className={`w-10 text-right text-base font-bold ${homeLeads ? 'text-accent-cyan' : 'text-text-secondary'}`}>
          {home}{unit}
        </div>
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden flex">
          <div
            className={`h-full shrink-0 transition-all duration-500 rounded-l-full ${homeLeads ? 'bg-accent-cyan' : 'bg-accent-cyan/40'}`}
            style={{ width: `${homePercent}%` }}
          />
          <div
            className={`h-full shrink-0 transition-all duration-500 rounded-r-full ${awayLeads ? 'bg-accent-blue' : 'bg-accent-blue/40'}`}
            style={{ width: `${awayPercent}%` }}
          />
        </div>
        <div className={`w-10 text-left text-base font-bold ${awayLeads ? 'text-accent-blue' : 'text-text-secondary'}`}>
          {away}{unit}
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
