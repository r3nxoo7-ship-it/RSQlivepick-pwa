-- ============================================
-- TRIGGERED MATCHES TABLE
-- ============================================
-- Stores records of when filters trigger matches
-- Used for history, analytics, and user notifications

CREATE TABLE IF NOT EXISTS triggered_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  filter_id TEXT NOT NULL,
  filter_name TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league_name TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  match_time INTEGER, -- Elapsed minutes when triggered
  score_home INTEGER,
  score_away INTEGER,
  match_status TEXT DEFAULT 'ongoing', -- 'ongoing', 'finished', 'scheduled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for common queries
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_triggered_matches_user_id ON triggered_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_user_created ON triggered_matches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_match_id ON triggered_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_filter_id ON triggered_matches(filter_id);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_match_filter ON triggered_matches(match_id, filter_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE triggered_matches ENABLE ROW LEVEL SECURITY;

-- Users can only see their own triggered matches
CREATE POLICY "Users can view own triggered matches" 
  ON triggered_matches 
  FOR SELECT 
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create own triggered matches"
  ON triggered_matches
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- ============================================
-- QUERY EXAMPLES
-- ============================================

-- Get triggered matches for user in last 20 minutes
-- SELECT * FROM triggered_matches 
-- WHERE user_id = 'user_id' 
-- AND created_at >= NOW() - INTERVAL '20 minutes'
-- ORDER BY created_at DESC;

-- Get all triggered matches for a specific game
-- SELECT * FROM triggered_matches 
-- WHERE match_id = 'match_id' AND user_id = 'user_id'
-- ORDER BY created_at DESC;

-- Count triggered matches by filter
-- SELECT filter_name, COUNT(*) as count 
-- FROM triggered_matches 
-- WHERE user_id = 'user_id'
-- GROUP BY filter_id, filter_name
-- ORDER BY count DESC;

-- Get triggered matches with date grouping
-- SELECT DATE(triggered_at) as date, COUNT(*) as count
-- FROM triggered_matches
-- WHERE user_id = 'user_id'
-- GROUP BY DATE(triggered_at)
-- ORDER BY date DESC;
