# Triggered Matches History & Analytics

## Overview

This feature tracks all matches that trigger user filters and displays them in analytics and a dedicated history page. It enables users to:

1. See which filters triggered which matches
2. View when matches were triggered (time-based)
3. Track match status when triggered (score, elapsed time)
4. Review complete history of triggered matches
5. Analyze filter effectiveness

## Features

### 1. One Notification Per Filter + Match

**Logic:**
- Different filters can trigger the same match
- Each combination gets ONE notification (24-hour dedup window)
- If Filter A triggers Match 1, user gets notification
- If Filter B then triggers Match 1, user gets ANOTHER notification for Filter B

**Example:**
```
Match: Man City vs Liverpool
Filter A: Corners > 5 → Triggers → Notification sent
Filter B: Shots > 10 → Triggers → ANOTHER notification sent (new filter)
→ User receives 2 notifications for same match (different filters)
```

### 2. Recently Triggered Display (Live Page)

**Location:** Top of live matches page

**Shows:**
- Last 20 minutes of triggered matches
- Filter name that triggered it
- Match elapsed time when triggered
- Time since triggered (e.g., "3m ago")
- Link to full history page

**Updates:** Every 10 seconds

**Example Display:**
```
Recently Triggered (5)
[Man City vs Liverpool] - Filter: "Over 2.5 Goals" [45'] - 3m ago
[Arsenal vs Chelsea] - Filter: "High Possession" [20'] - 5m ago
[Barcelona vs Real Madrid] - Filter: "Corners Over 8" [60'] - 8m ago
```

### 3. Full History Page

**URL:** `/dashboard/history`

**Features:**
- Time-based filtering (Last 24h, 7d, 30d, All Time)
- Pagination (20 items per page, "Load More" button)
- Real-time stats:
  - Total triggered
  - Unique matches
  - Unique filters
  - Today's count

**Columns:**
- Match info (teams, league, score)
- Filter name that triggered it
- Match time when triggered
- Time since triggered with exact timestamp
- Match status (ongoing, finished, scheduled)

### 4. Database Schema

**Table:** `triggered_matches`

```sql
id                UUID PRIMARY KEY
user_id          TEXT (FK to users)
match_id         TEXT (from API)
filter_id        TEXT (FK to filters)
filter_name      TEXT (searchable/display)
home_team        TEXT
away_team        TEXT
league_name      TEXT
triggered_at     TIMESTAMP -- When the match triggered
match_time       INTEGER -- Elapsed minutes when triggered
score_home       INTEGER
score_away       INTEGER
match_status     TEXT -- 'ongoing', 'finished', 'scheduled'
created_at       TIMESTAMP -- When record was created
```

**Indexes:**
- `(user_id, created_at DESC)` - For efficient history queries
- `(match_id, filter_id)` - For "what triggered this match"
- `(user_id)` - For user-scoped queries

### 5. Background Scanner Integration

**When Match Triggers:**

1. Filter matches check in background scanner
2. For each matched filter:
   - Send Web Push notification
   - Send Telegram notification (if enabled)
   - Log to `notifications_log` table
   - **Log to `triggered_matches` table** ← NEW

3. Data captured:
   ```typescript
   await dbHelpers.logTriggeredMatch({
     user_id: currentUser.id,
     match_id: match.fixture.id.toString(),
     filter_id: filter.id,
     filter_name: filter.name,
     home_team: match.teams.home.name,
     away_team: match.teams.away.name,
     league_name: match.league.name,
     triggered_at: new Date().toISOString(),
     match_time: match.fixture.status.elapsed || null,
     score_home: match.goals.home || null,
     score_away: match.goals.away || null,
     match_status: match.fixture.status.short || 'ongoing',
   });
   ```

### 6. API Functions

**In `lib/supabase.ts`:**

```typescript
// Log a triggered match
dbHelpers.logTriggeredMatch(triggeredMatch: Partial<TriggeredMatch>)
  → Returns: { error: string | null }

// Get triggered matches (last 15-20 minutes + historical)
dbHelpers.getTriggeredMatches(userId: string, minutesBack: number = 20, limit: number = 50)
  → Returns: TriggeredMatch[]

// Get triggered matches history (full, paginated)
dbHelpers.getTriggeredMatchesHistory(userId: string, limit: number = 100, offset: number = 0)
  → Returns: TriggeredMatch[]

// Get all filters that triggered a specific match
dbHelpers.getMatchTriggeredBy(matchId: string, userId: string)
  → Returns: TriggeredMatch[]
```

### 7. Implementation Details

**Deduplication:**
- (match_id, filter_id) is unique per notification window (24h)
- Same match + different filter = different record
- Same match + same filter within 24h = skipped (already notified)

**Time Ranges:**
- "Last 24h" → Query `created_at >= NOW() - INTERVAL '1 day'`
- "Last 7d" → Query `created_at >= NOW() - INTERVAL '7 days'`
- "All Time" → No time filter, paginated results

**Performance:**
- Index on `(user_id, created_at DESC)` for fast retrieval
- Queries use limits (50-100 items per load)
- Pagination built-in for large datasets

### 8. User Experience Flow

```
User logs in
  ↓
Background Scanner starts
  ↓
Every 30 seconds: Scan matches for triggers
  ↓
Match triggers Filter A
  ↓
1. Send notification (Web Push + Telegram)
2. Log to notifications_log
3. Log to triggered_matches ← NEW
  ↓
User navigates to Live page
  ↓
See "Recently Triggered" section (updated every 10s)
  ↓
Click "View Full History"
  ↓
See /dashboard/history page with:
  - Time filters (24h, 7d, 30d, all)
  - Detailed list with match info
  - Stats (total, unique matches, unique filters, today)
  - Pagination for older records
```

### 9. Future Enhancements

- [ ] Export triggered matches as CSV
- [ ] Analytics dashboard (filters by effectiveness, matches by frequency)
- [ ] Email digest of daily triggered matches
- [ ] Triggered matches notifications on top of app (banner/toast)
- [ ] Search/filter history by team, league, filter name
- [ ] Betting integration (log if user placed bet on triggered match)
- [ ] Comparison: triggered vs final result

## Migration Steps

1. **Create Table:** Run `supabase/migrations/triggered_matches.sql`
2. **Update Supabase:** New `TriggeredMatch` interface in `lib/supabase.ts`
3. **Update Scanner:** Modified `lib/background-scanner.ts` to log triggered matches
4. **Add History Page:** New `/dashboard/history/page.tsx`
5. **Update Live Page:** Display recently triggered matches
6. **Test:**
   - Create filters with notifications enabled
   - Trigger matches and verify notifications
   - Check recently triggered display
   - Verify history page data
   - Test pagination and time filters

## Database Setup

```bash
# In Supabase dashboard, run the SQL migration:
psql -h your-db.supabase.co -U postgres < supabase/migrations/triggered_matches.sql

# Or manually in SQL editor:
# Copy entire content from supabase/migrations/triggered_matches.sql
# Run in SQL console
```

## Troubleshooting

**Q: Recently triggered section not showing?**
A: Check if triggered_matches table exists, and if logTriggeredMatch is being called in background-scanner.ts

**Q: History page shows "No triggered matches"?**
A: Verify RLS policies allow user to read their own triggered_matches. Check browser console for errors.

**Q: Time ranges not working?**
A: Verify `created_at` timestamps are being set correctly when logging triggered matches.

**Q: Pagination not showing "Load More"?**
A: Check if hasMore state is set correctly. Should show button if query returns exactly itemsPerPage items.
