'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Filter } from '@/lib/supabase';

interface TriggeredMatch {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  score_home: number | null;
  score_away: number | null;
  match_time: number | null;
  triggered_at: string;
}

interface FilterFeedbackProps {
  filters: Filter[];
  onFeedback?: (filterId: string, matchId: string, isPositive: boolean) => void;
}

export function FilterFeedbackCard({ filters, onFeedback }: FilterFeedbackProps) {
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [triggeredMatches, setTriggeredMatches] = useState<Record<string, TriggeredMatch[]>>({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});

  // Get active filters (with triggers in last 24 hours)
  const activeFilters = filters.filter(f => (f.trigger_count ?? 0) > 0);

  useEffect(() => {
    const fetchTriggeredMatches = async () => {
      setLoading(true);
      const matchesMap: Record<string, TriggeredMatch[]> = {};

      for (const filter of activeFilters) {
        try {
          const response = await fetch(`/api/triggered-matches/list?filter_id=${filter.id}&range=24h&limit=100`);
          if (response.ok) {
            const data = await response.json();
            matchesMap[filter.id] = data.triggers || [];
          }
        } catch (error) {
          console.error(`Failed to fetch triggered matches for filter ${filter.id}:`, error);
          matchesMap[filter.id] = [];
        }
      }

      setTriggeredMatches(matchesMap);
      setLoading(false);
    };

    if (activeFilters.length > 0) {
      fetchTriggeredMatches();
    } else {
      setLoading(false);
    }
  }, [activeFilters]);

  const toggleFilter = (filterId: string) => {
    const newExpanded = new Set(expandedFilters);
    if (newExpanded.has(filterId)) {
      newExpanded.delete(filterId);
    } else {
      newExpanded.add(filterId);
    }
    setExpandedFilters(newExpanded);
  };

  const handleFeedback = (matchId: string, isPositive: boolean) => {
    const feedbackKey = matchId;
    setFeedback(prev => ({
      ...prev,
      [feedbackKey]: isPositive,
    }));

    // Trigger callback if provided
    // Find which filter this match belongs to
    for (const filter of activeFilters) {
      const match = triggeredMatches[filter.id]?.find(m => m.id === matchId);
      if (match) {
        onFeedback?.(filter.id, matchId, isPositive);
        break;
      }
    }
  };

  if (activeFilters.length === 0) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 p-6 backdrop-blur-sm">
        <div className="text-center text-slate-400">
          <p className="text-sm">No active filters with recent triggers</p>
          <p className="text-xs text-slate-500 mt-1">Create and trigger filters to see feedback here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-white mb-4">📊 Filter Performance Feedback</h3>
      <p className="text-xs text-slate-400 mb-4">Rate recent triggered matches - 👍 if result was expected, 👎 if not</p>

      {loading ? (
        <div className="text-center py-4 text-slate-400 text-sm">Loading triggered matches...</div>
      ) : (
        <div className="space-y-3">
          {activeFilters.map(filter => {
            const matches = triggeredMatches[filter.id] || [];
            const isExpanded = expandedFilters.has(filter.id);

            return (
              <div key={filter.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                {/* Header - Click to expand */}
                <button
                  onClick={() => toggleFilter(filter.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">{filter.name}</p>
                      <p className="text-xs text-slate-400">{matches.length} matches last 24h</p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-emerald-400 flex-shrink-0 ml-2">
                    {Math.round(filter.success_rate ?? 0)}%
                  </div>
                </button>

                {/* Expandable Content */}
                {isExpanded && (
                  <div className="bg-slate-900/50 border-t border-slate-700/50 p-4 space-y-2 max-h-96 overflow-y-auto">
                    {matches.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">No triggered matches in last 24 hours</p>
                    ) : (
                      matches.map(match => {
                        const feedbackKey = match.id;
                        const userFeedback = feedback[feedbackKey];

                        // Get score at trigger time
                        const scoreHome = match.score_home ?? '?';
                        const scoreAway = match.score_away ?? '?';

                        return (
                          <div
                            key={match.id}
                            className="flex items-center justify-between gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              {/* Match info */}
                              <div className="text-sm text-white truncate">
                                {match.home_team} vs {match.away_team}
                              </div>

                              {/* Score at trigger time */}
                              <div className="flex gap-4 mt-1 text-xs text-slate-400">
                                <span>
                                  Score at trigger: <span className="text-emerald-400 font-medium">
                                    {scoreHome}-{scoreAway}
                                  </span>
                                </span>
                              </div>
                            </div>

                            {/* Feedback buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleFeedback(match.id, true)}
                                className={`p-2 rounded-lg transition-all ${
                                  userFeedback === true
                                    ? 'bg-emerald-500/80 text-white'
                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-emerald-400'
                                }`}
                                title="Prediction was correct at this score"
                              >
                                <ThumbsUp size={16} />
                              </button>
                              <button
                                onClick={() => handleFeedback(match.id, false)}
                                className={`p-2 rounded-lg transition-all ${
                                  userFeedback === false
                                    ? 'bg-red-500/80 text-white'
                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-red-400'
                                }`}
                                title="Prediction was incorrect at this score"
                              >
                                <ThumbsDown size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
