-- Add sofascore_stats JSONB column to espn_matches
-- Stores SofaScore-enriched live stats (xG, big chances, shots in box, pass accuracy,
-- interceptions, clearances, fouls) persisted by the background scanner so the data
-- survives scanner restarts and Vercel cold starts.
-- Written by: POST /api/espn/persist-sofascore-stats
-- Read by: convertESPNMatchToLiveMatch → LiveMatch.sofascore_stats

ALTER TABLE public.espn_matches
  ADD COLUMN IF NOT EXISTS sofascore_stats JSONB;

-- Optional: index for queries that filter/join on sofascore availability
CREATE INDEX IF NOT EXISTS idx_espn_matches_sofascore_stats
  ON public.espn_matches ((sofascore_stats IS NOT NULL));
