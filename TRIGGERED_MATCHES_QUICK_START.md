# Quick Setup: Triggered Matches Feature

## What to Do NOW

### Step 1: Create Database Table (5 minutes)

```sql
-- In Supabase SQL Editor, run this:
-- File: supabase/migrations/triggered_matches.sql
-- Copy-paste all content and execute
```

**Or use Supabase CLI:**
```bash
supabase migration up
```

### Step 2: Deploy Code

- All code changes already committed to git
- Push to your branch/main
- No npm install needed (uses existing packages)

### Step 3: Test the Feature

1. **Start app:**
   ```bash
   npm run dev
   ```

2. **Create a filter** with notifications enabled
   - Go to /dashboard/filters
   - Create filter with specific conditions
   - Enable notifications

3. **Monitor live matches:**
   - Go to /dashboard/live
   - Look for "Recently Triggered" section (updates every 10s)
   - Should show matches that triggered your filters

4. **Check history:**
   - Click "View Full History" link
   - Or navigate to `/dashboard/history`
   - Filter by time range (24h, 7d, 30d, all)
   - Should see your triggered matches

### Step 4: Verify Notifications

When a match triggers:
- ✅ Web Push notification appears
- ✅ Telegram notification sent (if configured)
- ✅ Recently triggered section updates
- ✅ History page shows new entry

## What Changed

### New Pages
- `/dashboard/history` - Full triggered matches history

### New Database Table
- `triggered_matches` - Stores match+filter triggers with timestamps

### Updated Components
- Live page - Shows recently triggered matches
- Background scanner - Logs triggered matches automatically

### New Functions
- `dbHelpers.logTriggeredMatch()` - Log a trigger
- `dbHelpers.getTriggeredMatches()` - Get recent (20 min)
- `dbHelpers.getTriggeredMatchesHistory()` - Get all (paginated)
- `dbHelpers.getMatchTriggeredBy()` - Get triggers for a match

## Key Features

| Feature | Where | How Often |
|---------|-------|-----------|
| Notifications | Both Web + Telegram | When trigger detected |
| Recently Triggered | Live page | Updates every 10s |
| History Page | /dashboard/history | On-demand + pagination |
| Analytics Stats | History page | Real-time |
| Time Filtering | History page | User selects |

## Database Schema Quick View

```
triggered_matches
├── id (UUID) - Primary key
├── user_id (TEXT) - User reference
├── match_id (TEXT) - Match reference
├── filter_id (TEXT) - Filter reference
├── filter_name (TEXT) - Display name ✨ NEW
├── home_team (TEXT)
├── away_team (TEXT)
├── league_name (TEXT)
├── triggered_at (TIMESTAMP) - When it triggered ✨ NEW
├── match_time (INTEGER) - Elapsed minutes ✨ NEW
├── score_home/away (INTEGER)
├── match_status (TEXT) - ongoing/finished/scheduled ✨ NEW
└── created_at (TIMESTAMP) - When logged
```

**✨ = New fields that capture trigger context**

## Notification Behavior

| Scenario | Result |
|----------|--------|
| Match triggers Filter A | 1 notification |
| Same match triggers Filter B | 1 MORE notification (total 2) |
| Same match + Filter A again (< 24h) | No notification (deduplicated) |
| Same match + Filter A again (> 24h) | 1 notification (new 24h window) |

## Troubleshooting

**Q: Recently triggered not showing?**
- Check RLS policies allow reading `triggered_matches`
- Verify background scanner is running (check console logs)
- Ensure filter has `notification_enabled = true`

**Q: History page shows error?**
- Run migration: `supabase migration up`
- Check table exists: `SELECT * FROM triggered_matches LIMIT 1`
- Verify RLS policies created

**Q: Notifications not sending?**
- Check filter has both `notification_enabled` AND `telegram_enabled`
- Verify notification permissions granted
- Check background scanner state (should be `isRunning: true`)

**Q: Time filters not working?**
- Verify timestamps have timezone info
- Check created_at is being set
- Test query in Supabase SQL editor

## Files to Review

| File | Purpose |
|------|---------|
| `app/dashboard/history/page.tsx` | History page UI |
| `lib/supabase.ts` | TriggeredMatch interface + CRUD |
| `lib/background-scanner.ts` | Logging triggered matches |
| `app/dashboard/live/page.tsx` | Recently triggered display |
| `supabase/migrations/triggered_matches.sql` | DB schema |

## Success Indicators

✅ Triggered matches table exists in Supabase
✅ Can see "Recently Triggered" on live page
✅ Can navigate to history page
✅ Time filters work and update stats
✅ Pagination shows "Load More" for more than 20 items
✅ Notifications still work as before

## Commands Cheat Sheet

```bash
# Check migration status
supabase migration list

# Run migration
supabase migration up

# Run locally
npm run dev

# Commit changes
git add . && git commit -m "message"

# Push to repo
git push origin main
```

## Next Steps (Optional Enhancements)

1. **Email Digest**
   - Daily email of triggered matches
   - Attach filter effectiveness stats

2. **Analytics Dashboard**
   - Chart: Triggered matches over time
   - Chart: Top performing filters
   - Chart: Matches by team/league

3. **CSV Export**
   - Export full history
   - Useful for spreadsheet analysis

4. **Advanced Filtering**
   - Search by team name
   - Search by filter name
   - Filter by league

## Support Documentation

- **Full Feature Doc:** `TRIGGERED_MATCHES_FEATURE.md`
- **Implementation Doc:** `TRIGGERED_MATCHES_IMPLEMENTATION.md`
- **Background Scanner:** `BACKGROUND_SCANNER_FIX.md`

---

**Ready to deploy?** Follow the 4 steps above and you're done! 🚀
