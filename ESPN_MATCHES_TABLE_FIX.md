# 🔴 CRITICAL FIX: Add ESPN Matches Table to Supabase

**Problem:** Your filters are working now (56 loaded ✅), but matches won't load because the `espn_matches` table doesn't exist in Supabase.

**Status:** 
- ✅ Filter API fixed (columns schema mismatch resolved)
- ✅ Filters loading correctly (56 user filters)
- ❌ Matches not loading (0 live, 0 upcoming, 0 scheduled)
- ❌ Background scanner blocked (waiting for matches)

---

## 🚀 Quick Fix (5 minutes)

### Step 1: Copy the ESPN Matches Schema

Go to [Supabase Dashboard](https://app.supabase.com) → Your Project → **SQL Editor** → **+ New Query**

**Copy & paste this entire SQL:**

```sql
-- ============================================
-- ESPN MATCHES TABLE - LIVE MATCH DATA SYNC
-- ============================================

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
  
  -- Synced from ESPN
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

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.espn_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public SELECT" ON public.espn_matches;
CREATE POLICY "Allow public SELECT" ON public.espn_matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role all" ON public.espn_matches;
CREATE POLICY "Service role all" ON public.espn_matches FOR ALL USING (true);

-- ============================================
-- TEAM HISTORY TABLE (for form tracking)
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

ALTER TABLE public.team_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public SELECT" ON public.team_history;
CREATE POLICY "Allow public SELECT" ON public.team_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role all" ON public.team_history;
CREATE POLICY "Service role all" ON public.team_history FOR ALL USING (true);
```

### Step 2: Run the Query
Click **RUN** (green play button) in the SQL Editor.

✅ You should see:
```
CREATE TABLE
CREATE INDEX
ALTER TABLE
CREATE POLICY
```

### Step 3: Verify Tables Exist
In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- ✅ espn_matches
- ✅ team_history
- (plus your existing: users, profiles, filters, etc.)

---

## ✨ What Happens After

Once the schema is created:

1. **Immediate:** Visit your [deployed site](https://rs-qlivepick-pwa.vercel.app/dashboard/live)
2. **Wait ~10 seconds:** The app will detect empty `espn_matches` table
3. **Auto-sync triggers:** `/api/espn/matches` endpoint fetches matches from ESPN
4. **Matches appear:** Dashboard shows today's, tomorrow's, and week's matches
5. **Background scanner starts:** Begins monitoring for filter matches
6. **Filters trigger:** When a live match meets filter conditions, you get notifications

---

## 🔧 Alternative: Manual Sync (if needed)

If matches don't appear after 30 seconds, manually trigger sync:

```bash
curl "https://rs-qlivepick-pwa.vercel.app/api/espn/matches"
```

This forces an immediate on-demand sync.

---

## 📋 Leagues Being Synced

The app currently syncs these soccer leagues:
- Premier League (eng.1) 🏴󠁧󠁢󠁥󠁮󠁧󠁿
- Bundesliga (ger.1) 🇩🇪
- Serie A (ita.1) 🇮🇹
- La Liga (esp.1) 🇪🇸
- Champions League (uefa.champions)
- Europa League (uefa.europa)
- Ligue 1 (fra.1) 🇫🇷
- And more...

**Total: 14 leagues**

---

## ✅ Checklist

After running the SQL:

- [ ] Tables created (`espn_matches`, `team_history`)
- [ ] RLS policies enabled (public read, service role all)
- [ ] Indexes created (date, status, league)
- [ ] Visit dashboard at `/dashboard/live`
- [ ] See matches load (today, tomorrow, week)
- [ ] Filters start matching live events
- [ ] Background scanner initializes

---

## 🐛 If Still Not Working

1. **Check console logs** (F12 → Console) for errors
2. **Verify ESPN API is online:** `curl https://site.api.espn.com/site/api/site/v2/sports/soccer/eng.1/scoreboard`
3. **Check Supabase logs:** Dashboard → Logs → check for SQL errors
4. **Verify environment variables:** `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

---

## 📖 Background

The `espn_matches` table is the core of the match data system:
1. **ESPN API** provides live/scheduled matches
2. **espn-sync.ts** fetches and deduplicates
3. **Database stores** in `espn_matches`
4. **Dashboard reads** from DB (not ESPN directly)
5. **Filters evaluate** match stats in real-time
6. **Notifications sent** when filters trigger

This architecture avoids hitting ESPN API every page load and keeps users' data independent of API rate limits.
