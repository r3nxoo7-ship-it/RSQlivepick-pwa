'use client';

import { useState, useEffect } from 'react';
import MatchPredictionCard from '@/components/MatchPredictionCard';
import type { FullPredictions } from '@/lib/prediction-engine';
import { LiveMatch } from '@/lib/unified-api';

interface MatchPredictionsWrapperProps {
  match: LiveMatch;
}

export function MatchPredictionsSkeleton() {
  return (
    <div className="mt-3 pt-3 border-t border-glass-light/30 space-y-2">
      <div className="h-4 bg-glass-light/20 rounded animate-pulse" />
      <div className="h-4 bg-glass-light/20 rounded animate-pulse w-3/4" />
    </div>
  );
}

export default function MatchPredictionsWrapper({ match }: MatchPredictionsWrapperProps) {
  const [predictions, setPredictions] = useState<FullPredictions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match.fixture?.id) {
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();

    const fetchPredictions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/predictions/match/${match.fixture?.id}`, {
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }

        const data = await res.json();
        setPredictions(data);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Predictions fetch error:', err);
        setError('Failed to load predictions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPredictions();

    return () => {
      abortController.abort();
    };
  }, [match.fixture?.id]);

  // Don't render anything if we don't have predictions and aren't loading
  if (!predictions && !isLoading && error) {
    return null;
  }

  // Show loading skeleton
  if (isLoading) {
    return <MatchPredictionsSkeleton />;
  }

  // Show predictions if available
  if (predictions) {
    return (
      <div className="mt-3 pt-3 border-t border-glass-light/30">
        <MatchPredictionCard predictions={predictions} isLoading={false} error={error || undefined} />
      </div>
    );
  }

  return null;
}
