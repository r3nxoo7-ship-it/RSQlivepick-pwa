'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Filter } from '@/lib/supabase';

interface TriggeredMatch {
  id: string;
  match_id: string;
  filter_id: string;
  filter_name: string;
  home_team: string;
  away_team: string;
  score_home: number | null;
  score_away: number | null;
  match_time: number | null;
  match_status: string;
  triggered_at: string;
  created_at: string;
  user_feedback: boolean | null;
  feedback_at: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
}

interface FilterFeedbackProps {
  filters: Filter[];
  userId: string;
  onSuccessRateUpdated?: (filterId: string, newRate: number) => void;
}

export function FilterFeedbackCard({ filters, userId, onSuccessRateUpdated }: FilterFeedbackProps) {
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [triggeredMatches, setTriggeredMatches] = useState<Record<string, TriggeredMatch[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingFeedback, setSavingFeedback] = useState<Set<string>>(new Set());

  // Memoize active filter IDs to prevent infinite re-render loop
  const activeFilterIds = useMemo(
    () => filters.filter(f => (f.trigger_count ?? 0) > 0).map(f => f.id),
    [filters]
  );

  const activeFilters = useMemo(
    () => filters.filter(f => activeFilterIds.includes(f.id)),
    [filters, activeFilterIds]
  );

  useEffect(() => {
    if (activeFilterIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchTriggeredMatches = async () => {
      setLoading(true);
      const matchesMap: Record<string, TriggeredMatch[]> = {};

      const promises = activeFilterIds.map(async (filterId) => {
        try {
          const response = await fetch(
            `/api/triggered-matches/list?filter_id=${filterId}&range=7d&limit=30`
          );
          if (response.ok) {
            const data = await response.json();
            matchesMap[filterId] = data.triggers || data.matches || [];
          }
        } catch (error) {
          console.error(`Failed to fetch triggered matches for filter ${filterId}:`, error);
          matchesMap[filterId] = [];
        }
      });

      await Promise.all(promises);

      if (!cancelled) {
        setTriggeredMatches(matchesMap);
        setLoading(false);
      }
    };

    fetchTriggeredMatches();

    return () => { cancelled = true; };
  }, [activeFilterIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFilter = (filterId: string) => {
    setExpandedFilters(prev => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  };

  const handleFeedback = useCallback(async (filterId: string, triggeredMatchId: string, isPositive: boolean) => {
    // Optimistic UI update
    setTriggeredMatches(prev => {
      const updated = { ...prev };
      if (updated[filterId]) {
        updated[filterId] = updated[filterId].map(m =>
          m.id === triggeredMatchId
            ? { ...m, user_feedback: isPositive, feedback_at: new Date().toISOString() }
            : m
        );
      }
      return updated;
    });

    setSavingFeedback(prev => new Set(prev).add(triggeredMatchId));

    try {
      const response = await fetch('/api/triggered-matches/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggered_match_id: triggeredMatchId,
          user_id: userId,
          feedback: isPositive,
        }),
      });

      if (response.ok) {
        // Notify parent so it can refresh the filter's success_rate
        onSuccessRateUpdated?.(filterId, -1); // -1 = signal to re-fetch
      } else {
        console.error('[Feedback] Save failed:', await response.text());
        // Revert optimistic update
        setTriggeredMatches(prev => {
          const reverted = { ...prev };
          if (reverted[filterId]) {
            reverted[filterId] = reverted[filterId].map(m =>
              m.id === triggeredMatchId ? { ...m, user_feedback: null, feedback_at: null } : m
            );
          }
          return reverted;
        });
      }
    } catch (error) {
      console.error('[Feedback] Network error:', error);
    } finally {
      setSavingFeedback(prev => {
        const next = new Set(prev);
        next.delete(triggeredMatchId);
        return next;
      });
    }
  }, [userId, onSuccessRateUpdated]);

  if (activeFilters.length === 0) {
    return null; // Don't render empty card
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="glass-card p-6">
          <div className="text-center py-4 text-text-muted text-sm animate-pulse">
            Loading triggered matches...
          </div>
        </div>
      ) : (
        activeFilters.map(filter => {
          const matches = triggeredMatches[filter.id] || [];
          const isExpanded = expandedFilters.has(filter.id);

          // Count feedback stats
          const rated = matches.filter(m => m.user_feedback !== null && m.user_feedback !== undefined);
          const positive = rated.filter(m => m.user_feedback === true).length;
          const negative = rated.filter(m => m.user_feedback === false).length;
          const unrated = matches.length - rated.length;

          if (matches.length === 0) return null;

          return (
            <div key={filter.id} className="glass-card overflow-hidden">
              {/* Filter header */}
              <button
                type="button"
                onClick={() => toggleFilter(filter.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-glass-light/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ChevronDown
                    size={16}
                    className={`text-text-muted flex-shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{filter.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-text-muted">
                        {matches.length} trigger{matches.length !== 1 ? 's' : ''}
                      </span>
                      {rated.length > 0 && (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5 text-accent-green">
                            <ThumbsUp size={10} /> {positive}
                          </span>
                          <span className="flex items-center gap-0.5 text-accent-red">
                            <ThumbsDown size={10} /> {negative}
                          </span>
                        </span>
                      )}
                      {unrated > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber">
                          {unrated} unrated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Success rate badge */}
                <div className={`text-sm font-bold flex-shrink-0 ml-2 px-2 py-1 rounded ${
                  (filter.success_rate ?? 0) >= 60
                    ? 'text-accent-green bg-accent-green/10'
                    : (filter.success_rate ?? 0) >= 40
                      ? 'text-accent-amber bg-accent-amber/10'
                      : 'text-accent-red bg-accent-red/10'
                }`}>
                  {Math.round(filter.success_rate ?? 0)}%
                </div>
              </button>

              {/* Expanded: match list */}
              {isExpanded && (
                <div className="border-t border-glass-medium">
                  <div className="max-h-96 overflow-y-auto divide-y divide-glass-lighter/50">
                    {matches.map(match => {
                      const isSaving = savingFeedback.has(match.id);
                      const isFinished = match.match_status === 'finished';

                      return (
                        <div
                          key={match.id}
                          className="px-4 py-3 flex items-center gap-3 hover:bg-glass-light/30 transition-colors"
                        >
                          {/* Match info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {match.home_team} vs {match.away_team}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-text-muted">
                              {/* Trigger score */}
                              <span>
                                At trigger: <span className="text-accent-cyan font-medium">
                                  {match.score_home ?? '?'}-{match.score_away ?? '?'}
                                </span>
                                {match.match_time ? ` (${match.match_time}')` : ''}
                              </span>
                              {/* Final score if available */}
                              {isFinished && match.final_score_home !== null && (
                                <span>
                                  Final: <span className="text-white font-medium">
                                    {match.final_score_home}-{match.final_score_away}
                                  </span>
                                </span>
                              )}
                              {/* Status */}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                isFinished
                                  ? 'bg-accent-green/10 text-accent-green'
                                  : 'bg-accent-amber/10 text-accent-amber'
                              }`}>
                                {isFinished ? 'FT' : 'Live'}
                              </span>
                            </div>
                          </div>

                          {/* Feedback buttons */}
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleFeedback(filter.id, match.id, true)}
                              className={`p-2 rounded-lg transition-all ${
                                isSaving ? 'opacity-50 cursor-wait' :
                                match.user_feedback === true
                                  ? 'bg-accent-green/25 text-accent-green ring-1 ring-accent-green/40'
                                  : 'bg-glass-light text-text-muted hover:bg-glass-medium hover:text-accent-green'
                              }`}
                              title="Good trigger - filter worked as expected"
                            >
                              <ThumbsUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleFeedback(filter.id, match.id, false)}
                              className={`p-2 rounded-lg transition-all ${
                                isSaving ? 'opacity-50 cursor-wait' :
                                match.user_feedback === false
                                  ? 'bg-accent-red/25 text-accent-red ring-1 ring-accent-red/40'
                                  : 'bg-glass-light text-text-muted hover:bg-glass-medium hover:text-accent-red'
                              }`}
                              title="Bad trigger - filter did not work as expected"
                            >
                              <ThumbsDown size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
