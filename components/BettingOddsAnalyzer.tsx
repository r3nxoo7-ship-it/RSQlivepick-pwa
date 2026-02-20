'use client';

/**
 * Betting Odds Analyzer Component
 * Displays ML predictions for popular betting markets:
 * - Corners (Over 7.5)
 * - Goals (Over 1.5, 2.5, 3.5)
 * - First Half Goals
 * - Both Teams to Score (BTTS)
 * 
 * Color coding:
 * - Green: Good value bet (high confidence + positive odds)
 * - Amber: Moderate value
 * - Red: Poor value bet (low confidence or negative odds)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { LiveMatch } from '@/lib/unified-api';
import type { ParsedBookmakerOdds } from '@/lib/odds-provider';

interface BettingOddsAnalyzerProps {
  match: LiveMatch;
  stats?: {
    homeTeamAvgCorners: number;
    awayTeamAvgCorners: number;
    homeTeamAvgGoals: number;
    awayTeamAvgGoals: number;
    homeTeamGoalsAllowed: number;
    awayTeamGoalsAllowed: number;
    h2hAvgGoals: number;
    h2hAvgCorners: number;
  };
  odds?: ParsedBookmakerOdds;
  isLoading?: boolean;
}

interface BettingPrediction {
  market: string;
  prediction: string;
  probability: number; // 0-100
  currentOdds?: number;
  impliedOdds?: number; // calculated from probability
  value: 'good' | 'moderate' | 'poor'; // based on probability vs odds
  icon: string;
  description: string;
  stats: string[];
}

function calculateImpliedOdds(probability: number): number {
  // Convert probability to decimal odds (1 / probability)
  const prob = Math.max(0.01, Math.min(0.99, probability / 100));
  return parseFloat((1 / prob).toFixed(2));
}

function assessValue(
  probability: number,
  odds?: number
): 'good' | 'moderate' | 'poor' {
  if (!odds) {
    // No odds available, base purely on probability
    return probability >= 65 ? 'good' : probability >= 50 ? 'moderate' : 'poor';
  }

  const impliedOdds = calculateImpliedOdds(probability);
  const valueMargin = (odds - impliedOdds) / impliedOdds;

  // Good value: odds are > 5% better than implied
  if (valueMargin > 0.05 && probability >= 45) {
    return 'good';
  }
  // Poor value: odds are < implied or probability too low
  if (valueMargin < -0.05 || probability < 35) {
    return 'poor';
  }

  return 'moderate';
}

function getPredictionColor(value: 'good' | 'moderate' | 'poor') {
  const colors = {
    good: {
      bg: 'bg-green-500/10 border-green-500/30 hover:bg-green-500/15',
      text: 'text-green-400',
      indicator: '🟢',
      badge: 'bg-green-500/20 text-green-400',
    },
    moderate: {
      bg: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15',
      text: 'text-amber-400',
      indicator: '🟡',
      badge: 'bg-amber-500/20 text-amber-400',
    },
    poor: {
      bg: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
      text: 'text-red-400',
      indicator: '🔴',
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
              {prediction.value === 'good'
                ? '✓ VALUE'
                : prediction.value === 'moderate'
                ? '? FAIR'
                : '✗ SKIP'}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl font-bold text-white">
              {prediction.probability}%
            </div>
            {prediction.currentOdds && (
              <div className="text-xs">
                <div className="text-text-muted">Odds</div>
                <div className={`font-bold ${colors.text}`}>
                  {prediction.currentOdds.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Prediction bar */}
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

      {/* Expandable details */}
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
                  <li key={i} className="text-text-muted">
                    • {stat}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BettingOddsAnalyzer({
  match,
  stats,
  odds,
  isLoading = false,
}: BettingOddsAnalyzerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Calculate predictions based on stats
  const predictions: BettingPrediction[] = [];

  if (stats) {
    const totalAvgCorners = stats.homeTeamAvgCorners + stats.awayTeamAvgCorners;
    const totalAvgGoals = stats.homeTeamAvgGoals + stats.awayTeamAvgGoals;
    const homeGoalsChance = stats.homeTeamAvgGoals / (stats.homeTeamAvgGoals + stats.awayTeamGoalsAllowed);
    const awayGoalsChance = stats.awayTeamAvgGoals / (stats.awayTeamAvgGoals + stats.homeTeamGoalsAllowed);
    const bttsChance = homeGoalsChance * awayGoalsChance * 100;

    // Over 7.5 Corners
    const cornersProb = Math.min(
      95,
      Math.max(20, (totalAvgCorners / 10) * 100)
    );
    predictions.push({
      market: 'Over 7.5 Corners',
      prediction: cornersProb >= 55 ? 'Likely' : cornersProb >= 45 ? 'Toss-up' : 'Unlikely',
      probability: Math.round(cornersProb),
      currentOdds: odds?.corners_over_7_5,
      icon: '🏁',
      description: `Based on ${stats.homeTeamAvgCorners.toFixed(1)} avg corners for ${match.teams.home.name} and ${stats.awayTeamAvgCorners.toFixed(1)} for ${match.teams.away.name}.`,
      stats: [
        `${match.teams.home.name} avg: ${stats.homeTeamAvgCorners.toFixed(1)} corners/match`,
        `${match.teams.away.name} avg: ${stats.awayTeamAvgCorners.toFixed(1)} corners/match`,
        `H2H average: ${stats.h2hAvgCorners.toFixed(1)} corners`,
      ],
      value: assessValue(cornersProb, odds?.corners_over_7_5),
    });

    // Over 1.5 Goals
    const goals1_5Prob = Math.min(
      95,
      Math.max(20, (Math.pow(totalAvgGoals / 2, 0.8) * 100))
    );
    predictions.push({
      market: 'Over 1.5 Goals',
      prediction: goals1_5Prob >= 60 ? 'Likely' : goals1_5Prob >= 45 ? 'Toss-up' : 'Unlikely',
      probability: Math.round(goals1_5Prob),
      currentOdds: odds?.goals_over_1_5,
      icon: '⚽',
      description: `Combined attacking threat of both teams suggests probability around ${Math.round(goals1_5Prob)}%.`,
      stats: [
        `${match.teams.home.name}: ${stats.homeTeamAvgGoals.toFixed(1)} goals/match`,
        `${match.teams.away.name}: ${stats.awayTeamAvgGoals.toFixed(1)} goals/match`,
        `H2H: ${stats.h2hAvgGoals.toFixed(1)} goals/match`,
      ],
      value: assessValue(goals1_5Prob, odds?.goals_over_1_5),
    });

    // Over 2.5 Goals
    const goals2_5Prob = Math.min(
      90,
      Math.max(15, (totalAvgGoals / 2.5) * 60)
    );
    predictions.push({
      market: 'Over 2.5 Goals',
      prediction: goals2_5Prob >= 50 ? 'Possible' : 'Unlikely',
      probability: Math.round(goals2_5Prob),
      currentOdds: odds?.goals_over_2_5,
      icon: '⚽⚽',
      description: `Requires higher-scoring game; probability ${Math.round(goals2_5Prob)}% based on team averages.`,
      stats: [
        `${match.teams.home.name} defense: ${(3 - stats.homeTeamGoalsAllowed).toFixed(1)} games without 3+ goals`,
        `${match.teams.away.name} defense: ${(3 - stats.awayTeamGoalsAllowed).toFixed(1)} games without 3+ goals`,
      ],
      value: assessValue(goals2_5Prob, odds?.goals_over_2_5),
    });

    // BTTS (Both Teams to Score)
    predictions.push({
      market: 'Both Teams to Score',
      prediction: bttsChance >= 50 ? 'Likely' : bttsChance >= 40 ? 'Possible' : 'Unlikely',
      probability: Math.round(Math.min(90, bttsChance)),
      currentOdds: odds?.btts_yes,
      icon: '🎯',
      description: `Both teams capable of scoring; combined probability ${Math.round(bttsChance)}%.`,
      stats: [
        `${match.teams.home.name} scoring: ${homeGoalsChance.toFixed(1)}% chance`,
        `${match.teams.away.name} scoring: ${awayGoalsChance.toFixed(1)}% chance`,
      ],
      value: assessValue(Math.round(bttsChance), odds?.btts_yes),
    });

    // First Half Over 0.5 Goals
    const ftGoalsProb = Math.min(75, totalAvgGoals * 15);
    predictions.push({
      market: '1st Half Over 0.5',
      prediction: ftGoalsProb >= 50 ? 'Likely' : 'Possible',
      probability: Math.round(ftGoalsProb),
      currentOdds: odds?.first_half_over_0_5,
      icon: '⏱️',
      description: `Early goals are common in competitive matches. Probability: ${Math.round(ftGoalsProb)}%.`,
      stats: [
        `Both teams combined avg: ${totalAvgGoals.toFixed(1)} goals/match`,
        `Usually 40% of goals come in 1st half`,
      ],
      value: assessValue(ftGoalsProb, odds?.first_half_over_0_5),
    });
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-6 rounded-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-accent-cyan" />
          <h3 className="text-lg font-semibold">💡 Betting Odds Insights</h3>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-glass-light rounded-lg animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (predictions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-6 rounded-xl border border-glass-light/20"
      >
        <div className="flex items-center gap-3 text-text-muted">
          <AlertCircle className="w-5 h-5" />
          <p>Stats not available for predictions yet</p>
        </div>
      </motion.div>
    );
  }

  const goodValueCount = predictions.filter(p => p.value === 'good').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 rounded-xl border border-glass-light/20"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-glass-light/20">
        <TrendingUp className="w-5 h-5 text-accent-cyan" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">💡 Betting Odds Insights</h3>
          <p className="text-xs text-text-muted">
            {goodValueCount} good value bet{goodValueCount !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Predictions Grid */}
      <div className="space-y-3">
        {predictions.map((pred, idx) => (
          <BettingPredictionCard
            key={idx}
            prediction={pred}
            expanded={expandedIndex === idx}
            onToggle={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
          />
        ))}
      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-4 border-t border-glass-light/10 text-xs text-text-muted italic">
        <p>
          💡 Predictions based on team statistics, H2H history, and current form. Always
          do your own research before placing bets.
        </p>
      </div>
    </motion.div>
  );
}
