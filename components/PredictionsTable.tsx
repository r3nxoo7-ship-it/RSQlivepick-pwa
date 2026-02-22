'use client';

import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import type { LiveMatch } from '@/lib/unified-api';
import type { FullPredictions } from '@/lib/prediction-engine';

interface PredictionsTableProps {
  matches: LiveMatch[];
}

const MARKET_GROUPS = [
  {
    group: 'Goals',
    markets: [
      { key: 'fullMatch.over0_5', label: '+0.5' },
      { key: 'fullMatch.over1_5', label: '+1.5' },
      { key: 'fullMatch.over2_5', label: '+2.5' },
    ],
  },
  {
    group: '1st Half',
    markets: [
      { key: 'firstHalf.over0_5', label: '+0.5' },
      { key: 'firstHalf.over1_5', label: '+1.5' },
    ],
  },
  {
    group: 'BTTS',
    markets: [{ key: 'btts.yes', label: 'Yes' }],
  },
  {
    group: 'Corners',
    markets: [
      { key: 'corners.over8', label: '+8' },
      { key: 'corners.over9', label: '+9' },
    ],
  },
  {
    group: 'Cards',
    markets: [{ key: 'cards.over4_5', label: '+4.5' }],
  },
];

const ALL_MARKETS = MARKET_GROUPS.flatMap((g) => g.markets);

function getPredictionValue(
  predictions: FullPredictions['predictions'],
  key: string
): number | null {
  const parts = key.split('.');
  let current: any = predictions;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return null;
    current = current[part];
  }
  if (current && typeof current === 'object' && 'probability' in current) {
    return current.probability;
  }
  return null;
}

function getProbStyle(prob: number): string {
  if (prob >= 75) return 'bg-green-500/20 text-green-400 font-bold';
  if (prob >= 60) return 'bg-green-500/10 text-green-300';
  if (prob >= 50) return 'bg-amber-500/10 text-amber-400';
  if (prob >= 35) return 'bg-orange-500/10 text-orange-400';
  return 'bg-red-500/10 text-red-400';
}

export default function PredictionsTable({ matches }: PredictionsTableProps) {
  const [predictions, setPredictions] = useState<
    Map<number, FullPredictions>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    if (matches.length === 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let count = 0;

    async function fetchAll() {
      setLoading(true);
      const results = new Map<number, FullPredictions>();

      // Fetch in batches of 5 to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < matches.length; i += batchSize) {
        if (controller.signal.aborted) break;

        const batch = matches.slice(i, i + batchSize);
        const promises = batch.map(async (match) => {
          const fixtureId = match.fixture?.id;
          if (!fixtureId) return;

          try {
            const res = await fetch(`/api/predictions/match/${fixtureId}`, {
              signal: controller.signal,
            });
            if (res.ok) {
              const data = await res.json();
              results.set(fixtureId, data);
            } else {
              console.warn(`[Predictions] Failed for fixture ${fixtureId}: ${res.status}`);
            }
          } catch (err: any) {
            if (err?.name !== 'AbortError') {
              console.warn(`[Predictions] Error for fixture ${fixtureId}:`, err);
            }
          }
          count++;
          setLoadedCount(count);
        });

        await Promise.allSettled(promises);
        // Update progressively
        setPredictions(new Map(results));
      }

      setLoading(false);
    }

    fetchAll();

    return () => controller.abort();
  }, [matches]);

  if (matches.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <TrendingUp className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
        <p className="text-text-secondary text-sm">
          No matches scheduled for today. Check the Matches tab for upcoming games.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-glass-lighter flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-cyan" />
          Today&apos;s Predictions
        </h3>
        {loading && (
          <span className="text-xs text-text-muted">
            Loading {loadedCount}/{matches.length}...
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            {/* Group headers */}
            <tr className="border-b border-glass-lighter">
              <th className="sticky left-0 z-10 bg-[#0f1729] px-3 py-2 text-left text-xs text-text-muted font-normal" />
              {MARKET_GROUPS.map((g) => (
                <th
                  key={g.group}
                  colSpan={g.markets.length}
                  className="px-2 py-2 text-center text-[11px] font-bold text-accent-cyan uppercase tracking-wider border-l border-glass-medium"
                >
                  {g.group}
                </th>
              ))}
            </tr>
            {/* Market labels */}
            <tr className="border-b border-glass-medium bg-glass-light/30">
              <th className="sticky left-0 z-10 bg-[#0f1729] px-3 py-2 text-left text-xs text-text-muted font-semibold min-w-[170px]">
                Match
              </th>
              {MARKET_GROUPS.map((g) =>
                g.markets.map((m, idx) => (
                  <th
                    key={m.key}
                    className={`px-2 py-1.5 text-center text-[11px] text-text-secondary font-bold min-w-[48px] ${
                      idx === 0 ? 'border-l border-glass-medium' : ''
                    }`}
                  >
                    {m.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {matches.map((match, rowIdx) => {
              const fixtureId = match.fixture?.id;
              const pred = fixtureId ? predictions.get(fixtureId) : null;
              const isLoading = loading && !pred;
              const leagueName = match.league?.name || '';
              const kickoff = match.fixture?.date
                ? new Date(match.fixture.date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <tr
                  key={fixtureId || rowIdx}
                  className="border-b border-glass-lighter/50 hover:bg-glass-light/30 transition-colors"
                >
                  {/* Match info - sticky */}
                  <td className="sticky left-0 z-10 bg-[#0f1729] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-xs truncate">
                          {match.teams?.home?.name || '?'} vs{' '}
                          {match.teams?.away?.name || '?'}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">
                          {kickoff && <span className="text-accent-cyan">{kickoff}</span>}
                          {kickoff && leagueName && ' • '}
                          {leagueName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Market cells */}
                  {MARKET_GROUPS.map((g) =>
                    g.markets.map((m, idx) => {
                      const prob = pred
                        ? getPredictionValue(pred.predictions, m.key)
                        : null;

                      return (
                        <td
                          key={m.key}
                          className={`px-1.5 py-2 text-center ${
                            idx === 0 ? 'border-l border-glass-medium' : ''
                          }`}
                        >
                          {isLoading ? (
                            <div className="w-10 h-5 mx-auto rounded bg-glass-light animate-pulse" />
                          ) : prob !== null ? (
                            <span
                              className={`inline-block min-w-[38px] px-1 py-0.5 rounded text-[11px] font-bold tabular-nums ${getProbStyle(
                                prob
                              )}`}
                            >
                              {Math.round(prob)}
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs">-</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-glass-lighter flex items-center gap-4 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500/20" /> High (75+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/10" /> Mid (50-74)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/10" /> Low (&lt;50)
        </span>
        <span className="ml-auto italic">Based on team form &amp; recent results</span>
      </div>
    </div>
  );
}
