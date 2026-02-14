# 🔴 CRITICAL FIX: Add ESPN Matches Tables to Supabase

**If you got the error:** `ERROR: 42P01: relation "filter_templates" does not exist`

**Solution:** Use the clean SQL below (no foreign key references to non-existent tables)

---

## Step 1: Run This Clean SQL

Go to [Supabase Dashboard](https://app.supabase.com) → Your Project → **SQL Editor** → **+ New Query**

**Copy & paste this entire SQL (use this, not the other version):**

```sql
-- ============================================
-- ESPN MATCHES TABLE - LIVE MATCH DATA SYNC
-- ============================================
-- Clean schema with NO foreign key issues
-- Run this in Supabase SQL Editor

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
  
  -- Goals
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
  
  -- Synced metadata (NO foreign key to non-existent filter_templates)
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  raw_data JSONB,
  
  CONSTRAINT espn_matches_valid_teams CHECK (home_team_id != away_team_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_espn_matches_date ON public.espn_matches (date DESC);
CREATE INDEX IF NOT EXISTS idx_espn_matches_status ON public.espn_matches (status);
CREATE INDEX IF NOT EXISTS idx_espn_matches_league ON public.espn_matches (league);
CREATE INDEX IF NOT EXISTS idx_espn_matches_sport ON public.espn_matches (sport);
CREATE INDEX IF NOT EXISTS idx_espn_matches_date_status ON public.espn_matches (date DESC, status);
CREATE INDEX IF NOT EXISTS idx_espn_matches_home_team ON public.espn_matches (home_team_id);
CREATE INDEX IF NOT EXISTS idx_espn_matches_away_team ON public.espn_matches (away_team_id);

-- ============================================
-- TEAM HISTORY TABLE (for team form)
-- ============================================

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
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_history_team ON public.team_history (team_id);
CREATE INDEX IF NOT EXISTS idx_team_history_date ON public.team_history (date DESC);
CREATE INDEX IF NOT EXISTS idx_team_history_team_date ON public.team_history (team_id, date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.espn_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public SELECT" ON public.espn_matches;
CREATE POLICY "Allow public SELECT" ON public.espn_matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role all" ON public.espn_matches;
CREATE POLICY "Service role all" ON public.espn_matches 
  FOR ALL USING (true);

ALTER TABLE public.team_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public SELECT" ON public.team_history;
CREATE POLICY "Allow public SELECT" ON public.team_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role all" ON public.team_history;
CREATE POLICY "Service role all" ON public.team_history 
  FOR ALL USING (true);

-- ============================================
-- SUCCESS
-- ============================================

SELECT 'Tables created successfully!' as status;
```

### Step 2: Run It ✨

Click the **RUN** button (green play icon).

You should see:
```
✅ Tables created successfully!
```

### Step 3: Verify

Run this in a new query:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('espn_matches', 'team_history')
ORDER BY table_name;
```

Expected result:
```
espn_matches
team_history
```

---

## What Happens Next

1. **Refresh** your [LivePick app](https://rs-qlivepick-pwa.vercel.app/dashboard/live)
2. **Wait ~10 seconds** - the app detects the empty tables
3. **Auto-sync triggers** - ESPN data fetches automatically
4. **Matches appear!** - Today, tomorrow, and week's matches display
5. **Filters activate** - Start matching live events

---

## ✅ You're Ready!

Your system now has:
- ✅ `filters` table (working with 56 user filters)
- ✅ `espn_matches` table (for live/scheduled matches)
- ✅ `team_history` table (for team form tracking)
- ✅ All RLS policies configured
- ✅ All indexes optimized

Filters → Matches → Notifications are now fully connected! 🎯
