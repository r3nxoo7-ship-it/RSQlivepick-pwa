/**
 * Match Prediction Card Component
 * Displays ML-powered predictions for betting markets with color-coded confidence
 * 
 * UI Design:
 * - Single card per match showing top 5 key predictions
 * - Green (70%+) = High confidence / likely
 * - Amber (50-70%) = Moderate confidence / toss-up
 * - Red (<50%) = Low confidence / unlikely
 * - Tooltips showing reasoning and key stats
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, ChevronDown, Info, AlertCircle, 
  Target, Heart, Zap, Wind
} from 'lucide-react';
import type { FullPredictions } from '@/lib/prediction-engine';

interface MatchPredictionCardProps {
  predictions: FullPredictions;
  isLoading?: boolean;
  error?: string;
}

/**
 * Get color and icon based on probability
 */
function getConfidenceColor(probability: number): {
  bg: string;
  text: string;
  indicator: string;
  label: string;
} {
  if (probability >= 70) {
    return {
      bg: 'bg-green-500/10 border-green-500/30',
      text: 'text-green-400',
      indicator: '🟢',
      label: 'High',
    };
  } else if (probability >= 50) {
    return {
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      indicator: '🟡',
      label: 'Moderate',
    };
  } else {
    return {
      bg: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-400',
      indicator: '🔴',
      label: 'Low',
    };
  }
}

/**
 * Probability bar with gradient
 */
function ProbabilityBar({ probability, confidence }: { probability: number; confidence: number }) {
  const colors = getConfidenceColor(probability);
  const barWidth = Math.max(5, Math.min(95, probability));

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-text-secondary">{probability}%</span>
        <span className={`text-xs ${colors.text}`}>Confidence: {confidence}%</span>
      </div>
      <div className="w-full bg-glass-dark rounded-full h-2 overflow-hidden border border-glass-light/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${colors.text.replace('text-', 'bg-')}/50`}
        />
      </div>
    </div>
  );
}

/**
 * Individual prediction market display
 */
function PredictionMarket({
  market,
  probability,
  confidence,
  reasoning,
  icon: IconComponent,
}: {
  market: string;
  probability: number;
  confidence: number;
  reasoning: string;
  icon: React.ReactNode;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const colors = getConfidenceColor(probability);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border p-3 ${colors.bg} backdrop-blur-sm hover:border-accent-cyan/50 transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <div className={`mt-0.5 text-lg ${colors.text}`}>{IconComponent}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-sm text-white truncate">{market}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} border ${colors.text}`}>
                {colors.label}
              </span>
            </div>
            <ProbabilityBar probability={probability} confidence={confidence} />
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-text-muted hover:text-accent-cyan transition-colors p-1"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-glass-light/10 text-xs text-text-secondary space-y-1"
          >
            <p>{reasoning}</p>
            <div className="text-text-muted mt-2 italic">
              Click prediction card to analyze further
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Main Prediction Card Component
 */
export default function MatchPredictionCard({
  predictions,
  isLoading = false,
  error,
}: MatchPredictionCardProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-glass-light/20 bg-glass-dark/50 p-6 backdrop-blur-md">
        <div className="flex items-center gap-2 text-accent-cyan mb-4">
          <Zap className="w-5 h-5 animate-pulse" />
          <span>Analyzing match...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-glass-light/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle className="w-5 h-5" />
          <span>Prediction Error</span>
        </div>
        <p className="text-xs text-text-secondary">{error}</p>
      </div>
    );
  }

  // Prepare top predictions (prioritize high confidence and interesting odds)
  const allPredictions = [
    { ...predictions.predictions.firstHalf.over0_5, section: 'firstHalf' },
    { ...predictions.predictions.firstHalf.over1_5, section: 'firstHalf' },
    { ...predictions.predictions.fullMatch.over1_5, section: 'fullMatch' },
    { ...predictions.predictions.fullMatch.over2_5, section: 'fullMatch' },
    { ...predictions.predictions.btts.yes, section: 'btts' },
    { ...predictions.predictions.corners.over8, section: 'corners' },
    { ...predictions.predictions.cards.over4_5, section: 'cards' },
  ];

  // Sort by: first high confidence, then interesting odds (deviation from 50%)
  const sortedPredictions = allPredictions.sort((a, b) => {
    const aInterest = Math.abs(a.probability - 50) + a.confidence;
    const bInterest = Math.abs(b.probability - 50) + b.confidence;
    return bInterest - aInterest;
  });

  // Get top 5-6 predictions
  const topPredictions = sortedPredictions.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-accent-cyan/30 bg-glass-dark/80 backdrop-blur-md overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-accent-cyan/5 to-accent-blue/5 border-b border-glass-light/20 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6 text-accent-cyan" />
          <h3 className="text-lg font-bold text-white">
            📊 Match Predictions & Analysis
          </h3>
        </div>
        <p className="text-xs text-text-muted">
          ML-powered forecasts for {predictions.homeTeam} vs {predictions.awayTeam}
          • Generated: {new Date(predictions.predictionTimestamp).toLocaleTimeString()}
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-6 space-y-4">
        {/* Top Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-accent-cyan mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-accent-cyan">Best Value</div>
                <div className="text-text-secondary mt-1">
                  {predictions.bestValue[0]?.market} 
                  <span className="text-accent-cyan ml-1">
                    ({predictions.bestValue[0]?.probability}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Wind className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-accent-blue">Model Confidence</div>
                <div className="text-text-secondary mt-1">
                  Overall: <span className="text-accent-blue">{predictions.overallConfidence}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Predictions Grid */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Key Markets
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {topPredictions.slice(0, 4).map((pred: any) => (
              <PredictionMarket
                key={`${pred.market}-${pred.probability}`}
                market={pred.market}
                probability={pred.probability}
                confidence={pred.confidence}
                reasoning={pred.reasoning || ''}
                icon={
                  pred.market.toLowerCase().includes('goal') ? <Zap /> :
                  pred.market.toLowerCase().includes('btts') ? <Heart /> :
                  pred.market.toLowerCase().includes('corner') ? <Wind /> :
                  <Target />
                }
              />
            ))}
          </div>

          {/* Expand for more predictions */}
          {topPredictions.length > 4 && (
            <>
              <button
                onClick={() => setExpandedSection(expandedSection === 'more' ? null : 'more')}
                className="w-full py-2 px-3 rounded-lg border border-glass-light/20 hover:border-accent-cyan/50 transition-colors text-text-secondary hover:text-accent-cyan text-sm flex items-center justify-center gap-2 group"
              >
                <span>Show All Predictions ({topPredictions.length})</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform group-hover:text-accent-cyan ${
                    expandedSection === 'more' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {expandedSection === 'more' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"
                  >
                    {topPredictions.slice(4).map((pred: any) => (
                      <PredictionMarket
                        key={`${pred.market}-${pred.probability}`}
                        market={pred.market}
                        probability={pred.probability}
                        confidence={pred.confidence}
                        reasoning={pred.reasoning || ''}
                        icon={
                          pred.market.toLowerCase().includes('goal') ? <Zap /> :
                          pred.market.toLowerCase().includes('btts') ? <Heart /> :
                          pred.market.toLowerCase().includes('corner') ? <Wind /> :
                          <Target />
                        }
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Color Legend */}
        <div className="border-t border-glass-light/10 pt-4 mt-4">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Confidence Levels
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">🟢</span>
              <span className="text-text-secondary">70%+ Likely</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🟡</span>
              <span className="text-text-secondary">50-70% Likely</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔴</span>
              <span className="text-text-secondary">&lt;50% Likely</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Quality Indicator */}
      <div className="bg-black/20 border-t border-glass-light/10 px-4 py-2 md:px-6 text-xs text-text-muted">
        <p>
          ℹ️ Predictions based on: Team form • H2H history • Live odds • Statistical models
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Loading skeleton while predictions load
 */
export function MatchPredictionCardSkeleton() {
  return (
    <div className="rounded-lg border border-glass-light/20 bg-glass-dark/50 backdrop-blur-md overflow-hidden animate-pulse">
      <div className="bg-gradient-to-r from-accent-cyan/5 to-accent-blue/5 border-b border-glass-light/20 px-6 py-4">
        <div className="h-6 bg-glass-light/10 rounded w-1/3 mb-2" />
        <div className="h-4 bg-glass-light/5 rounded w-2/3" />
      </div>

      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 bg-glass-light/5 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
