-- ============================================
-- ADD HALFTIME SCORES TO TRIGGERED MATCHES
-- ============================================
-- Stores halftime (HT) scores for better analytics

ALTER TABLE triggered_matches 
ADD COLUMN IF NOT EXISTS ht_score_home INTEGER DEFAULT NULL;

ALTER TABLE triggered_matches 
ADD COLUMN IF NOT EXISTS ht_score_away INTEGER DEFAULT NULL;

COMMENT ON COLUMN triggered_matches.ht_score_home IS 'Home team halftime score';
COMMENT ON COLUMN triggered_matches.ht_score_away IS 'Away team halftime score';
