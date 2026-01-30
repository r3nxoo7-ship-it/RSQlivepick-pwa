-- ============================================
-- Push Subscriptions Table Setup
-- ============================================
-- Run this in your Supabase SQL Editor to create the push_subscriptions table
-- with proper RLS policies

-- STEP 1: Create the push_subscriptions table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- STEP 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
ON public.push_subscriptions(endpoint);

-- STEP 3: Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS Policies
-- Policy 1: Users can only see their own subscriptions
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own subscriptions
DROP POLICY IF EXISTS "Users can create own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can create own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can delete their own subscriptions
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- STEP 5: Grant permissions to service role (for /api/push/send to work)
-- NOTE: Service role key bypasses RLS by default, so this should work automatically.
-- If it still fails, ensure SUPABASE_SERVICE_ROLE_KEY is correctly configured in .env.local

-- Test that the table exists and is accessible
SELECT COUNT(*) as subscription_count FROM public.push_subscriptions;
