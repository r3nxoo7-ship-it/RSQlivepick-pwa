# Background Scanner Implementation

## Problem Fixed

**Issue:** The autoscanner was turning off when users navigated away from the live tab. The purpose of the app is to permanently scan live matches, so the scanner needs to work always in the background.

## Solution

Implemented a persistent **Background Scanner Service** that runs independently from the UI and continues scanning regardless of which page the user is viewing.

### Architecture

1. **Background Scanner Service** (`lib/background-scanner.ts`)
   - Singleton service that manages continuous match scanning
   - Runs every 30 seconds to check all user filters against live matches
   - Sends notifications via Web Push and Telegram automatically
   - Persists state in sessionStorage for cross-tab communication
   - Deduplicates notifications (won't send same alert twice in 24 hours)

2. **Scanner Initializer** (`components/ScannerInitializer.tsx`)
   - Initializes the background scanner when app mounts
   - Runs only for authenticated users
   - Starts the scanner with 30-second interval

3. **Root Layout Integration** (`app/layout.tsx`)
   - Added `<ScannerInitializer />` to root layout
   - Ensures scanner starts immediately when user logs in
   - Scanner persists across all page navigations

4. **Live Page Updates** (`app/dashboard/live/page.tsx`)
   - Removed local scanner logic
   - Now displays background scanner status instead
   - Shows real-time scanner stats (scans, alerts, active filters)
   - Removed manual "Start/Stop Scanner" button - scanner runs automatically

### How It Works

```
App Loads
   ↓
ScannerInitializer component mounts
   ↓
Background Scanner Service starts (30s interval)
   ↓
Every 30 seconds:
  - Fetch live matches from API
  - Load user's active filters
  - Evaluate all filters against all matches
  - Send notifications for matches (Web Push + Telegram)
  - Update stats
   ↓
Scanner continues even if user navigates away from live page
```

### Key Features

✅ **Always Running** - Continues scanning in background regardless of page
✅ **Automatic Notifications** - Sends alerts via Web Push and Telegram
✅ **No Manual Toggle** - User doesn't need to start/stop scanner
✅ **Efficient** - Deduplicates notifications (24-hour window)
✅ **State Persisted** - Scanner continues after page refresh
✅ **Real-time Display** - Live page shows scanner status every 5 seconds

### Database Logging

All matched alerts are logged to the database with:
- User ID
- Match ID
- Filter ID
- Notification type: "background_scan"
- Message with team names and filter name
- Timestamp

### Performance

- Scan interval: 30 seconds (configurable)
- Notification dedup window: 24 hours
- Runs in JavaScript event loop (no Web Workers needed)
- Lazy-loads API module to avoid circular dependencies

### Testing

1. Start the app and log in
2. Create filters with notifications enabled
3. Navigate to different pages (filters, settings, etc.)
4. Scanner continues running - check browser console logs
5. When matches trigger filters, you'll receive notifications even if not on live page
