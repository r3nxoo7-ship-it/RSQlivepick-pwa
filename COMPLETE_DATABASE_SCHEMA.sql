-- ============================================
-- LIVEPICK PWA - COMPLETE DATABASE SCHEMA
-- ============================================
-- Complete Supabase database setup with all tables, indexes, and RLS policies
-- Run this in Supabase SQL Editor to set up the entire database

-- ============================================
-- 1. USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes for users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users (is_admin);

-- RLS Policies for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all SELECT" ON public.users;
CREATE POLICY "Allow all SELECT"
ON public.users
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow self UPDATE" ON public.users;
CREATE POLICY "Allow self UPDATE"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow self INSERT" ON public.users;
CREATE POLICY "Allow self INSERT"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT,
  telegram_chat_id BIGINT,
  telegram_username TEXT,
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  telegram_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON public.profiles (telegram_chat_id);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- ============================================
-- 3. FILTERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  notification_enabled BOOLEAN NOT NULL DEFAULT false,
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  last_triggered TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  color TEXT,
  template_id TEXT,
  forked_from_id UUID REFERENCES public.filters(id) ON DELETE SET NULL,
  forked_from_user TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_editable BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT filters_color_check CHECK (color IN ('cyan', 'green', 'amber', 'purple', 'blue', 'red', 'gray'))
);

-- Indexes for filters
CREATE INDEX IF NOT EXISTS idx_filters_user_id ON public.filters (user_id);
CREATE INDEX IF NOT EXISTS idx_filters_user_created ON public.filters (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_filters_is_active ON public.filters (is_active);
CREATE INDEX IF NOT EXISTS idx_filters_is_public ON public.filters (is_public);
CREATE INDEX IF NOT EXISTS idx_filters_forked_from ON public.filters (forked_from_id);

-- RLS Policies for filters
ALTER TABLE public.filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own filters" ON public.filters;
CREATE POLICY "Users can view own filters"
ON public.filters
FOR SELECT
USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can create own filters" ON public.filters;
CREATE POLICY "Users can create own filters"
ON public.filters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own filters" ON public.filters;
CREATE POLICY "Users can update own filters"
ON public.filters
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own filters" ON public.filters;
CREATE POLICY "Users can delete own filters"
ON public.filters
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 4. TRIGGERED_MATCHES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.triggered_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  filter_id UUID NOT NULL REFERENCES public.filters(id) ON DELETE CASCADE,
  filter_name TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league_name TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  match_time INTEGER,
  score_home INTEGER,
  score_away INTEGER,
  match_status TEXT DEFAULT 'ongoing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT triggered_matches_status_check CHECK (match_status IN ('ongoing', 'finished', 'scheduled'))
);

-- Indexes for triggered_matches
CREATE INDEX IF NOT EXISTS idx_triggered_matches_user_id ON public.triggered_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_user_created ON public.triggered_matches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_match_id ON public.triggered_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_filter_id ON public.triggered_matches(filter_id);
CREATE INDEX IF NOT EXISTS idx_triggered_matches_match_filter ON public.triggered_matches(match_id, filter_id);

-- RLS Policies for triggered_matches
ALTER TABLE public.triggered_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own triggered matches" ON public.triggered_matches;
CREATE POLICY "Users can view own triggered matches"
ON public.triggered_matches
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own triggered matches" ON public.triggered_matches;
CREATE POLICY "Users can create own triggered matches"
ON public.triggered_matches
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. MATCHES_HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.matches_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_id UUID NOT NULL REFERENCES public.filters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  league_name TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_time TEXT NOT NULL,
  score_home INTEGER,
  score_away INTEGER,
  statistics JSONB,
  picked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  match_date TEXT NOT NULL,
  bet_placed BOOLEAN NOT NULL DEFAULT false,
  bet_result TEXT,
  bet_odds NUMERIC(10,2),
  notes TEXT,

  CONSTRAINT matches_history_bet_result_check CHECK (bet_result IN ('WIN', 'LOSS', 'DRAW'))
);

-- Indexes for matches_history
CREATE INDEX IF NOT EXISTS idx_matches_history_user_id ON public.matches_history (user_id);
CREATE INDEX IF NOT EXISTS idx_matches_history_user_picked ON public.matches_history (user_id, picked_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_history_match_id ON public.matches_history (match_id);
CREATE INDEX IF NOT EXISTS idx_matches_history_filter_id ON public.matches_history (filter_id);

-- RLS Policies for matches_history
ALTER TABLE public.matches_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own match history" ON public.matches_history;
CREATE POLICY "Users can view own match history"
ON public.matches_history
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own match history" ON public.matches_history;
CREATE POLICY "Users can create own match history"
ON public.matches_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own match history" ON public.matches_history;
CREATE POLICY "Users can delete own match history"
ON public.matches_history
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 6. NOTIFICATIONS_LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  filter_id UUID REFERENCES public.filters(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered BOOLEAN NOT NULL DEFAULT false,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT notifications_log_type_check CHECK (notification_type IN ('push', 'telegram', 'email'))
);

-- Indexes for notifications_log
CREATE INDEX IF NOT EXISTS idx_notifications_log_user_id ON public.notifications_log (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_user_sent ON public.notifications_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_log_match_id ON public.notifications_log (match_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_filter_id ON public.notifications_log (filter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_delivered ON public.notifications_log (delivered);
CREATE INDEX IF NOT EXISTS idx_notifications_log_read ON public.notifications_log (read);

-- RLS Policies for notifications_log
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification logs" ON public.notifications_log;
CREATE POLICY "Users can view own notification logs"
ON public.notifications_log
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications_log;
CREATE POLICY "Service can insert notifications"
ON public.notifications_log
FOR INSERT
WITH CHECK (true); -- Service role bypasses RLS anyway

-- ============================================
-- 7. PUSH_SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- RLS Policies for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can create own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('users', 'profiles', 'filters', 'triggered_matches', 'matches_history', 'notifications_log', 'push_subscriptions')
ORDER BY table_name;

-- Check RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'profiles', 'filters', 'triggered_matches', 'matches_history', 'notifications_log', 'push_subscriptions')
ORDER BY tablename;

-- Count all policies
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ LivePick PWA Database Schema Setup Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created: 7';
  RAISE NOTICE '  - users';
  RAISE NOTICE '  - profiles';
  RAISE NOTICE '  - filters';
  RAISE NOTICE '  - triggered_matches';
  RAISE NOTICE '  - matches_history';
  RAISE NOTICE '  - notifications_log';
  RAISE NOTICE '  - push_subscriptions';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Policies: Enabled on all tables';
  RAISE NOTICE 'Indexes: Created for optimal performance';
  RAISE NOTICE 'Foreign Keys: Configured with CASCADE delete';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create admin user: node scripts/setup-admin.js';
  RAISE NOTICE '2. Test login at http://localhost:3002/login';
  RAISE NOTICE '3. Configure VAPID keys for push notifications';
  RAISE NOTICE '';
END $$;
