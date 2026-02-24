-- =====================================================
-- H2H Cache: stores head-to-head match history
-- Fetched once from TheSportsDB, cached forever.
-- Past match data is immutable after FT.
-- =====================================================

CREATE TABLE IF NOT EXISTS h2h_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Normalized: always store smaller team name first alphabetically
  -- key format: "Team A||Team B" (alphabetical order)
  cache_key TEXT NOT NULL UNIQUE,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  matches JSONB NOT NULL DEFAULT '[]',
  match_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'thesportsdb',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  -- When to next refresh (for new matches played since last fetch)
  refresh_after TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_h2h_cache_key ON h2h_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_h2h_refresh ON h2h_cache(refresh_after);

-- =====================================================
-- Team Form Cache: stores recent matches per team
-- Refreshed every 3 days (teams play weekly).
-- =====================================================

CREATE TABLE IF NOT EXISTS team_form_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Key: team name (normalized lowercase, trimmed)
  cache_key TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  tsdb_team_id TEXT,
  matches JSONB NOT NULL DEFAULT '[]',
  match_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'thesportsdb',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_after TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days')
);

CREATE INDEX IF NOT EXISTS idx_team_form_cache_key ON team_form_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_team_form_refresh ON team_form_cache(refresh_after);

-- =====================================================
-- Team name → TheSportsDB ID lookup table
-- Avoids repeated searchteams.php calls
-- =====================================================

CREATE TABLE IF NOT EXISTS tsdb_team_lookup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_name_key TEXT NOT NULL UNIQUE,  -- normalized: lowercase, trimmed
  team_name TEXT NOT NULL,
  tsdb_team_id TEXT NOT NULL,
  tsdb_team_name TEXT NOT NULL,
  league_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tsdb_team_lookup_key ON tsdb_team_lookup(team_name_key);
