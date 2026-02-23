-- ============================================
-- ADD FEEDBACK COLUMNS TO TRIGGERED_MATCHES
-- ============================================
-- Enables persistent user feedback (thumbs up/down) on triggered matches
-- and stores the final match score separately from the trigger-time score

-- User feedback: true = good trigger, false = bad trigger, NULL = not rated
ALTER TABLE triggered_matches ADD COLUMN IF NOT EXISTS user_feedback BOOLEAN DEFAULT NULL;

-- Timestamp when feedback was given
ALTER TABLE triggered_matches ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Final score (separate from trigger-time score)
ALTER TABLE triggered_matches ADD COLUMN IF NOT EXISTS final_score_home INTEGER DEFAULT NULL;
ALTER TABLE triggered_matches ADD COLUMN IF NOT EXISTS final_score_away INTEGER DEFAULT NULL;
