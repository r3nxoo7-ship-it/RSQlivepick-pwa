-- Migration: Add auto_success column to triggered_matches
-- This column stores automatic goal-based evaluation:
--   For "over" templates (min 1-55): success if goals_added >= 2
--   For "over" templates (min 60+): success if goals_added >= 1
-- User feedback (user_feedback) always overrides auto_success when present.

ALTER TABLE public.triggered_matches
  ADD COLUMN IF NOT EXISTS auto_success BOOLEAN DEFAULT NULL;

-- Index for querying auto-evaluated matches efficiently
CREATE INDEX IF NOT EXISTS idx_triggered_matches_auto_success
  ON public.triggered_matches (user_id, auto_success)
  WHERE auto_success IS NOT NULL;

-- Composite index for cross-analysis queries (league + filter + success)
CREATE INDEX IF NOT EXISTS idx_triggered_matches_league_filter
  ON public.triggered_matches (user_id, filter_id, league_name);
