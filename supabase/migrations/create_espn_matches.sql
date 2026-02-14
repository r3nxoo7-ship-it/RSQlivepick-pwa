-- ============================================
-- ESPN MATCHES TABLE - LIVE MATCH DATA SYNC
-- ============================================
-- This table stores ESPN-synced football match data
-- Synced from ESPN API when matches are scheduled/live/completed
-- CLEAN SCHEMA - NO foreign key issues
-- @dialect postgres

CREATE TABLE IF NOT EXISTS public.espn_matches (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  sport TEXT NOT NULL DEFAULT 'soccer',
  league TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  
  -- Teams
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  
  -- Current Score
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  
  -- Goals (if available in API)
  home_goals INTEGER,
  away_goals INTEGER,
  
  -- Match Stats
  home_corners INTEGER,
  away_corners INTEGER,
  home_shots_on_target INTEGER,
  away_shots_on_target INTEGER,
  home_total_shots INTEGER,
  away_total_shots INTEGER,
  home_possession NUMERIC,
  away_possession NUMERIC,
  home_yellow_cards INTEGER,
  away_yellow_cards INTEGER,
  home_red_cards INTEGER,
  away_red_cards INTEGER,
  home_fouls INTEGER,
  away_fouls INTEGER,
  home_offsides INTEGER,
  away_offsides INTEGER,
  
  -- Match Meta
  period TEXT,
  minute INTEGER,
  venue_id TEXT,
  venue_name TEXT,
  venue_city TEXT,
  broadcast TEXT,
  
  -- Synced from ESPN
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Metadata
  raw_data JSONB,
  
  CONSTRAINT espn_matches_valid_teams CHECK (home_team_id != away_team_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_espn_matches_date ON public.espn_matches (date DESC);
CREATE INDEX IF NOT EXISTS idx_espn_matches_status ON public.espn_matches (status);
CREATE INDEX IF NOT EXISTS idx_espn_matches_league ON public.espn_matches (league);
CREATE INDEX IF NOT EXISTS idx_espn_matches_sport ON public.espn_matches (sport);
CREATE INDEX IF NOT EXISTS idx_espn_matches_date_status ON public.espn_matches (date DESC, status);
CREATE INDEX IF NOT EXISTS idx_espn_matches_home_team ON public.espn_matches (home_team_id);
CREATE INDEX IF NOT EXISTS idx_espn_matches_away_team ON public.espn_matches (away_team_id);

-- RLS Policy - everyone can SELECT (public read)
ALTER TABLE public.espn_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public SELECT" ON public.espn_matches;
CREATE POLICY "Allow public SELECT"
ON public.espn_matches
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role INSERT/UPDATE/DELETE" ON public.espn_matches;
CREATE POLICY "Service role INSERT/UPDATE/DELETE"
ON public.espn_matches
FOR ALL
USING (true); -- Service role bypasses RLS anyway

-- ============================================
-- TEAM HISTORY TABLE - RECENT MATCH RESULTS
-- ============================================
-- Stores completed matches for team form calculation

CREATE TABLE IF NOT EXISTS public.team_history (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'soccer',
  league TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  opponent_id TEXT,
  opponent_name TEXT,
  goals_for INTEGER,
  goals_against INTEGER,
  result TEXT CHECK (result IN ('W', 'D', 'L')),
  is_home BOOLEAN NOT NULL,
  
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT team_history_result_valid CHECK (result IS NOT NULL)
);

-- Indexes for team history
CREATE INDEX IF NOT EXISTS idx_team_history_team ON public.team_history (team_id);
CREATE INDEX IF NOT EXISTS idx_team_history_date ON public.team_history (date DESC);
CREATE INDEX IF NOT EXISTS idx_team_history_team_date ON public.team_history (team_id, date DESC);

-- RLS Policy - everyone can SELECT (public read)
ALTER TABLE public.team_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public SELECT" ON public.team_history;
CREATE POLICY "Allow public SELECT"
ON public.team_history
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role INSERT/UPDATE/DELETE" ON public.team_history;
CREATE POLICY "Service role INSERT/UPDATE/DELETE"
ON public.team_history
FOR ALL
USING (true);

-- ============================================
-- SUCCESS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ESPN Matches Schema Created Successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - espn_matches (live/scheduled match data)';
  RAISE NOTICE '  - team_history (team form/recent results)';
  RAISE NOTICE '';
  RAISE NOTICE 'The app will now:';
  RAISE NOTICE '1. Fetch sync data from ESPN API';
  RAISE NOTICE '2. Store in espn_matches table';
  RAISE NOTICE '3. Display matches on dashboard';
  RAISE NOTICE '';
END $$;
