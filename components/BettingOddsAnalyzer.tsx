'use client';

/**
 * Betting Odds Analyzer Component
 * Self-contained: fetches real ESPN team form + H2H data, then
 * calculates probabilities using Poisson regression.
 *
 * Markets: Corners O7.5, Goals O1.5/O2.5, BTTS, 1st Half O0.5
 *
 * Color coding:
 * - Green (70%+): High probability
 * - Amber (50-70%): Moderate
 * - Red (<50%): Low probability
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';
import type { LiveMatch } from '@/lib/unified-api';

// ============================================
// TYPES
// ============================================

interface BettingPrediction {
  market: string;
  prediction: string;
  probability: number; // 0-100
  value: 'good' | 'moderate' | 'poor';
  icon: string;
  description: string;
  stats: string[];
}

interface TeamFormStats {
  avgGoalsScored: number;
  avgGoalsConceded: number;
  avgCorners: number;
  avgShotsOnTarget: number;
  avgYellowCards: number;
  cleanSheetPct: number;
  played: number;
}

// ============================================
// POISSON MATH
// ============================================

function poissonPDF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
}

function poissonCDF(n: number, lambda: number): number {
  let sum = 0;
  for (let k = 0; k <= n; k++) sum += poissonPDF(k, lambda);
  return sum;
}

// ============================================
// DATA FETCHING
// ============================================

function parseFormData(matches: any[], teamId: string): TeamFormStats {
  if (!matches || matches.length === 0) {
    return { avgGoalsScored: 1.3, avgGoalsConceded: 1.2, avgCorners: 4.5, avgShotsOnTarget: 3.5, avgYellowCards: 2, cleanSheetPct: 30, played: 0 };
  }

  let goalsFor = 0, goalsAgainst = 0, corners = 0, sot = 0, yellows = 0, cleanSheets = 0;
  let cornerMatches = 0, sotMatches = 0, yellowMatches = 0;

  for (const m of matches) {
    const isHome = String(m.home_team_id) === String(teamId);
    const gf = isHome ? (m.home_score || 0) : (m.away_score || 0);
    const ga = isHome ? (m.away_score || 0) : (m.home_score || 0);
    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets++;

    const c = isHome ? m.home_corners : m.away_corners;
    if (c != null && c > 0) { corners += c; cornerMatches++; }

    const s = isHome ? m.home_shots_on_target : m.away_shots_on_target;
    if (s != null && s > 0) { sot += s; sotMatches++; }

    const y = isHome ? m.home_yellow_cards : m.away_yellow_cards;
    if (y != null && y > 0) { yellows += y; yellowMatches++; }
  }

  const n = matches.length;
  return {
    avgGoalsScored: Math.round((goalsFor / n) * 100) / 100,
    avgGoalsConceded: Math.round((goalsAgainst / n) * 100) / 100,
    avgCorners: cornerMatches > 0 ? Math.round((corners / cornerMatches) * 10) / 10 : 4.5,
    avgShotsOnTarget: sotMatches > 0 ? Math.round((sot / sotMatches) * 10) / 10 : 3.5,
    avgYellowCards: yellowMatches > 0 ? Math.round((yellows / yellowMatches) * 10) / 10 : 2,
    cleanSheetPct: Math.round((cleanSheets / n) * 100),
    played: n,
  };
}

// ============================================
// PREDICTION CALCULATIONS (from real data)
// ============================================

function generatePredictions(
  match: LiveMatch,
  homeForm: TeamFormStats,
  awayForm: TeamFormStats,
  h2hMatches: any[]
): BettingPrediction[] {
  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';

  // --- Goals lambda (Poisson) ---
  // Attack strength * opponent defense weakness
  const leagueAvgGoals = 1.35; // typical top-league average
  const homeLambda = Math.max(0.3,
    (homeForm.avgGoalsScored / leagueAvgGoals) * (awayForm.avgGoalsConceded / leagueAvgGoals) * leagueAvgGoals * 1.1 // home advantage
  );
  const awayLambda = Math.max(0.3,
    (awayForm.avgGoalsScored / leagueAvgGoals) * (homeForm.avgGoalsConceded / leagueAvgGoals) * leagueAvgGoals * 0.9
  );

  // Convolve for total goals distribution
  const totalDist: Record<number, number> = {};
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const t = h + a;
      totalDist[t] = (totalDist[t] || 0) + poissonPDF(h, homeLambda) * poissonPDF(a, awayLambda);
    }
  }

  const goalsOver0_5 = Math.round((1 - (totalDist[0] || 0)) * 100);
  const goalsOver1_5 = Math.round((1 - (totalDist[0] || 0) - (totalDist[1] || 0)) * 100);
  const goalsOver2_5 = Math.round((1 - (totalDist[0] || 0) - (totalDist[1] || 0) - (totalDist[2] || 0)) * 100);

  // First half (42% of full match goals)
  const fhHomeLambda = homeLambda * 0.42;
  const fhAwayLambda = awayLambda * 0.42;
  const fhDist: Record<number, number> = {};
  for (let h = 0; h <= 3; h++) {
    for (let a = 0; a <= 3; a++) {
      const t = h + a;
      fhDist[t] = (fhDist[t] || 0) + poissonPDF(h, fhHomeLambda) * poissonPDF(a, fhAwayLambda);
    }
  }
  const fhOver0_5 = Math.round((1 - (fhDist[0] || 0)) * 100);

  // BTTS
  const homeScoresProb = 1 - poissonPDF(0, homeLambda);
  const awayScoresProb = 1 - poissonPDF(0, awayLambda);
  // Adjust with clean sheet data
  const homeCS = homeForm.cleanSheetPct / 100;
  const awayCS = awayForm.cleanSheetPct / 100;
  const bttsRaw = homeScoresProb * awayScoresProb;
  // Dampen by clean sheet tendency
  const bttsAdjusted = bttsRaw * (1 - (homeCS + awayCS) / 4);
  const bttsProb = Math.round(Math.max(10, Math.min(90, bttsAdjusted * 100)));

  // Corners (Poisson on combined average)
  const totalCornerLambda = homeForm.avgCorners + awayForm.avgCorners;
  const cornersOver7_5 = Math.round((1 - poissonCDF(7, totalCornerLambda)) * 100);

  // H2H stats
  let h2hGoals = 0, h2hCount = 0;
  for (const m of h2hMatches) {
    h2hGoals += (m.home_score || 0) + (m.away_score || 0);
    h2hCount++;
  }
  const h2hAvg = h2hCount > 0 ? (h2hGoals / h2hCount).toFixed(1) : 'N/A';

  const expectedGoals = (homeLambda + awayLambda).toFixed(1);

  const predictions: BettingPrediction[] = [];

  // Over 1.5 Goals
  predictions.push({
    market: 'Over 1.5 Goals',
    prediction: goalsOver1_5 >= 65 ? 'Likely' : goalsOver1_5 >= 50 ? 'Possible' : 'Unlikely',
    probability: goalsOver1_5,
    icon: '⚽',
    description: `Expected ${expectedGoals} total goals. ${homeName} scores ${homeForm.avgGoalsScored}/game, ${awayName} concedes ${awayForm.avgGoalsConceded}/game.`,
    stats: [
      `${homeName}: ${homeForm.avgGoalsScored} goals scored / ${homeForm.avgGoalsConceded} conceded per match (${homeForm.played} matches)`,
      `${awayName}: ${awayForm.avgGoalsScored} goals scored / ${awayForm.avgGoalsConceded} conceded per match (${awayForm.played} matches)`,
      h2hCount > 0 ? `H2H average: ${h2hAvg} goals/match (${h2hCount} meetings)` : 'No H2H data available',
    ],
    value: goalsOver1_5 >= 70 ? 'good' : goalsOver1_5 >= 50 ? 'moderate' : 'poor',
  });

  // Over 2.5 Goals
  predictions.push({
    market: 'Over 2.5 Goals',
    prediction: goalsOver2_5 >= 55 ? 'Possible' : 'Unlikely',
    probability: goalsOver2_5,
    icon: '⚽⚽',
    description: `Higher-scoring game needs both teams contributing. Expected: ${expectedGoals} goals.`,
    stats: [
      `${homeName} clean sheets: ${homeForm.cleanSheetPct}% | ${awayName} clean sheets: ${awayForm.cleanSheetPct}%`,
      `Combined attack: ${(homeForm.avgGoalsScored + awayForm.avgGoalsScored).toFixed(1)} goals/match`,
    ],
    value: goalsOver2_5 >= 65 ? 'good' : goalsOver2_5 >= 45 ? 'moderate' : 'poor',
  });

  // BTTS
  predictions.push({
    market: 'Both Teams to Score',
    prediction: bttsProb >= 55 ? 'Likely' : bttsProb >= 40 ? 'Possible' : 'Unlikely',
    probability: bttsProb,
    icon: '🎯',
    description: `${homeName} scores in ${Math.round(homeScoresProb * 100)}% of simulations, ${awayName} in ${Math.round(awayScoresProb * 100)}%.`,
    stats: [
      `${homeName}: ${homeForm.avgGoalsScored} goals/match, ${homeForm.cleanSheetPct}% clean sheets`,
      `${awayName}: ${awayForm.avgGoalsScored} goals/match, ${awayForm.cleanSheetPct}% clean sheets`,
    ],
    value: bttsProb >= 60 ? 'good' : bttsProb >= 45 ? 'moderate' : 'poor',
  });

  // Over 7.5 Corners
  predictions.push({
    market: 'Over 7.5 Corners',
    prediction: cornersOver7_5 >= 55 ? 'Likely' : cornersOver7_5 >= 40 ? 'Possible' : 'Unlikely',
    probability: cornersOver7_5,
    icon: '🏁',
    description: `Expected ${totalCornerLambda.toFixed(1)} total corners based on team averages.`,
    stats: [
      `${homeName}: ${homeForm.avgCorners} corners/match`,
      `${awayName}: ${awayForm.avgCorners} corners/match`,
      homeForm.avgCorners === 4.5 ? '⚠️ Corners from default (ESPN schedule has limited corner data)' : `Based on real match data`,
    ],
    value: cornersOver7_5 >= 60 ? 'good' : cornersOver7_5 >= 40 ? 'moderate' : 'poor',
  });

  // 1st Half Over 0.5
  predictions.push({
    market: '1st Half Over 0.5 Goals',
    prediction: fhOver0_5 >= 60 ? 'Likely' : 'Possible',
    probability: fhOver0_5,
    icon: '⏱️',
    description: `About 42% of goals happen in the first half. Expected 1H goals: ${(fhHomeLambda + fhAwayLambda).toFixed(1)}.`,
    stats: [
      `Full match expected: ${expectedGoals} goals`,
      `1st half expected: ${(fhHomeLambda + fhAwayLambda).toFixed(1)} goals`,
    ],
    value: fhOver0_5 >= 65 ? 'good' : fhOver0_5 >= 50 ? 'moderate' : 'poor',
  });

  // Sort by probability descending
  predictions.sort((a, b) => b.probability - a.probability);

  return predictions;
}

// ============================================
// UI COMPONENTS
// ============================================

function getPredictionColor(value: 'good' | 'moderate' | 'poor') {
  const colors = {
    good: {
      bg: 'bg-green-500/10 border-green-500/30 hover:bg-green-500/15',
      text: 'text-green-400',
      badge: 'bg-green-500/20 text-green-400',
    },
    moderate: {
      bg: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15',
      text: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-400',
    },
    poor: {
      bg: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
      text: 'text-red-400',
      badge: 'bg-red-500/20 text-red-400',
    },
  };
  return colors[value];
}

function BettingPredictionCard({
  prediction,
  expanded,
  onToggle,
}: {
  prediction: BettingPrediction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = getPredictionColor(prediction.value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border transition-all cursor-pointer ${colors.bg}`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{prediction.icon}</span>
            <h4 className="font-semibold text-sm text-white truncate">
              {prediction.market}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors.badge}`}>
              {prediction.value === 'good' ? 'LIKELY' : prediction.value === 'moderate' ? 'FAIR' : 'LOW'}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl font-bold text-white">
              {prediction.probability}%
            </div>
            <div className="text-xs text-text-muted">{prediction.prediction}</div>
          </div>

          {/* Probability bar */}
          <div className="w-full bg-glass-dark rounded-full h-2 overflow-hidden border border-glass-light/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prediction.probability}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full ${colors.text.replace('text-', 'bg-')}`}
            />
          </div>
        </div>

        <button className={`p-2 rounded-lg transition ${colors.text}`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-glass-light/10 text-xs text-text-muted space-y-2"
          >
            <p className="italic">{prediction.description}</p>
            <div>
              <p className="font-semibold text-text-secondary mb-1">Key Stats:</p>
              <ul className="space-y-1">
                {prediction.stats.map((stat, i) => (
                  <li key={i} className="text-text-muted">• {stat}</li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface BettingOddsAnalyzerProps {
  match: LiveMatch;
}

export default function BettingOddsAnalyzer({ match }: BettingOddsAnalyzerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<BettingPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInfo, setDataInfo] = useState('');

  useEffect(() => {
    if (!match?.teams?.home?.id || !match?.teams?.away?.id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchAndPredict() {
      setLoading(true);
      try {
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;

        // Fetch real team form + H2H from ESPN APIs in parallel
        const [homeFormRes, awayFormRes, h2hRes] = await Promise.all([
          fetch(`/api/espn/team-form?teamId=${homeId}&limit=10`, { signal: controller.signal }).catch(() => null),
          fetch(`/api/espn/team-form?teamId=${awayId}&limit=10`, { signal: controller.signal }).catch(() => null),
          fetch(`/api/espn/h2h?homeId=${homeId}&awayId=${awayId}&limit=10`, { signal: controller.signal }).catch(() => null),
        ]);

        const homeFormData = homeFormRes?.ok ? await homeFormRes.json() : { matches: [] };
        const awayFormData = awayFormRes?.ok ? await awayFormRes.json() : { matches: [] };
        const h2hData = h2hRes?.ok ? await h2hRes.json() : { matches: [] };

        const homeMatches = homeFormData.matches || [];
        const awayMatches = awayFormData.matches || [];
        const h2hMatches = h2hData.matches || [];

        const homeForm = parseFormData(homeMatches, String(homeId));
        const awayForm = parseFormData(awayMatches, String(awayId));

        const info = `${homeForm.played} + ${awayForm.played} form matches, ${h2hMatches.length} H2H`;
        setDataInfo(info);

        const preds = generatePredictions(match, homeForm, awayForm, h2hMatches);
        setPredictions(preds);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('BettingOddsAnalyzer fetch error:', err);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAndPredict();

    return () => controller.abort();
  }, [match?.teams?.home?.id, match?.teams?.away?.id, match]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-accent-cyan" />
          <h3 className="text-lg font-semibold">Betting Odds Insights</h3>
        </div>
        <div className="flex items-center gap-2 text-text-muted text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Fetching real team stats from ESPN...
        </div>
      </motion.div>
    );
  }

  if (predictions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 rounded-xl border border-glass-light/20">
        <div className="flex items-center gap-3 text-text-muted">
          <AlertCircle className="w-5 h-5" />
          <p>Could not load team stats for predictions</p>
        </div>
      </motion.div>
    );
  }

  const goodCount = predictions.filter(p => p.value === 'good').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 rounded-xl border border-glass-light/20"
    >
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-glass-light/20">
        <TrendingUp className="w-5 h-5 text-accent-cyan" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Betting Odds Insights</h3>
          <p className="text-xs text-text-muted">
            {goodCount} high-probability market{goodCount !== 1 ? 's' : ''} found
            {dataInfo && <span className="ml-1">({dataInfo})</span>}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {predictions.map((pred, idx) => (
          <BettingPredictionCard
            key={pred.market}
            prediction={pred}
            expanded={expandedIndex === idx}
            onToggle={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-glass-light/10 text-xs text-text-muted italic">
        <p>Based on real ESPN team form ({dataInfo || 'loading...'}). Poisson regression model.</p>
      </div>
    </motion.div>
  );
}
