-- ============================================
-- BACKFILL FILTER TRIGGER COUNTS - FIXED
-- ============================================
-- Fixed version with correct type casting

-- Option 1: Cast filter_id (text) to UUID
UPDATE filters f
SET
  trigger_count = (
    SELECT COUNT(*)
    FROM triggered_matches tm
    WHERE tm.filter_id::uuid = f.id
  ),
  last_triggered = (
    SELECT MAX(triggered_at)
    FROM triggered_matches tm
    WHERE tm.filter_id::uuid = f.id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM triggered_matches tm
  WHERE tm.filter_id::uuid = f.id
);

-- Verify the update worked
SELECT
  id,
  name,
  trigger_count,
  last_triggered,
  updated_at
FROM filters
WHERE trigger_count > 0
ORDER BY trigger_count DESC
LIMIT 10;

-- ============================================
-- ALTERNATIVE: If above fails, try this
-- ============================================
-- This casts f.id (uuid) to text instead

/*
UPDATE filters f
SET
  trigger_count = (
    SELECT COUNT(*)
    FROM triggered_matches tm
    WHERE tm.filter_id = f.id::text
  ),
  last_triggered = (
    SELECT MAX(triggered_at)
    FROM triggered_matches tm
    WHERE tm.filter_id = f.id::text
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM triggered_matches tm
  WHERE tm.filter_id = f.id::text
);
*/

-- ============================================
-- CHECK COLUMN TYPES FIRST
-- ============================================
-- Run this to see actual column types:

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('filters', 'triggered_matches')
  AND column_name IN ('id', 'filter_id')
ORDER BY table_name, column_name;
