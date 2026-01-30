# 🔔 Web Push Notifications - Setup Guide

## Problem: "Error fetching subscriptions"

When you click the **"Send Server Push Test"** button on `/dashboard/notifications`, you may see the error:

```
❌ Error fetching subscriptions
```

This error comes from the `/api/push/send` endpoint which tries to fetch subscriptions from the Supabase `push_subscriptions` table.

## Root Causes

The error typically occurs because:

1. **Table doesn't exist:** The `push_subscriptions` table has not been created in your Supabase database
2. **RLS policies blocking:** Row-level security (RLS) policies prevent queries (though service role should bypass this)
3. **Missing environment variables:** `SUPABASE_SERVICE_ROLE_KEY` not configured
4. **No subscriptions exist:** User hasn't subscribed to push notifications yet

## Solution

### Step 1: Create the Push Subscriptions Table

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Open: https://supabase.com/dashboard
-- Go to: SQL Editor → New Query
-- Paste this entire script and click RUN
```

File: `PUSH_SUBSCRIPTIONS_SETUP.sql`

This script will:
- ✅ Create `push_subscriptions` table with proper schema
- ✅ Add indexes for performance
- ✅ Enable RLS with user-scoped policies
- ✅ Allow service role to access subscriptions

### Step 2: Verify Supabase Configuration

Ensure your `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Get these from:**
1. Go to Supabase Dashboard
2. Click your project
3. Settings → API → Show relevant key

### Step 3: Subscribe to Push Notifications

1. Go to `/dashboard/notifications`
2. Click **"Subscribe (client)"** button
3. Browser will ask for permission - click **Allow**
4. Button should show **"Unsubscribe"** (success ✅)

### Step 4: Test the Server Push

1. Click **"Send Server Push Test"** button
2. You should see: `✅ Server push request enqueued/sent.`
3. A notification should appear in your browser (if browser is in focus) or in the notification center

## How It Works

### Component Flow

```
User clicks "Send Server Push Test"
    ↓
/api/push/send (POST)
    ↓
Query: SELECT * FROM push_subscriptions WHERE user_id = current_user
    ↓
For each subscription: webpush.sendNotification()
    ↓
Browser receives push → Service Worker → Displays notification
```

### Database Schema

```sql
push_subscriptions {
  id: UUID (primary key)
  user_id: UUID (foreign key → users)
  endpoint: TEXT (unique - push service URL)
  p256dh: TEXT (encryption key part 1)
  auth: TEXT (encryption key part 2)
  raw: JSONB (full subscription object)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### RLS Policies

- Users can **see/insert/delete** only their own subscriptions
- Service role key **bypasses RLS** (can query any subscriptions)

## Environment Variables Required

For local dev (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (for push encryption)
- `VAPID_PRIVATE_KEY` (for push signing)

For production (Vercel):
- Add all above keys to Vercel project settings
- Settings → Environment Variables
- Redeploy project

## Troubleshooting

### Error: "No subscriptions found"
✅ **This is OK!** It means the table exists but user hasn't subscribed yet.
- Click "Subscribe (client)" to create a subscription

### Error: "invalid payload"
❌ **API request issue** - check that you're sending `user_id` and `payload`

### Error: "Server error" (generic)
❌ **Check server logs** - run `npm run dev` and look at terminal output when you click the button

### Service Worker Not Showing Notifications
- Browser must have permission (`Allow` in permission prompt)
- App must be installed as PWA (use "Install" button from browser)
- Or browser must be running in the background

## Code References

### API Route
- **File:** `app/api/push/send/route.ts`
- **Method:** POST
- **Request Body:** `{ user_id: string, payload: { title, body } }`
- **Response:** `{ results: Array<{ endpoint, status, error? }> }`

### Client Functions
- **File:** `lib/notifications.ts`
- **subscribeToPush(userId)** - Register browser subscription
- **unsubscribeFromPush(userId)** - Unregister subscription
- **sendTestNotification()** - Client-side test (doesn't use server)
- **sendMatchNotification()** - For match alerts

### Service Worker
- **File:** `public/sw.js`
- **Handles:** Push events → Shows notifications
- **Listens to:** `self.addEventListener('push', ...)`

## Advanced Debugging

### Check Subscriptions in Supabase

```sql
-- See all subscriptions
SELECT id, user_id, endpoint, created_at FROM push_subscriptions;

-- See subscriptions for specific user
SELECT id, user_id, endpoint, created_at 
FROM push_subscriptions 
WHERE user_id = '...' (paste user UUID);

-- Count subscriptions
SELECT COUNT(*) FROM push_subscriptions;
```

### Enable Detailed Logging

Edit `/api/push/send/route.ts` and the `console.error()` will log:
```
message: Supabase error message
code: Error code (e.g., PGRST100)
hint: PostgreSQL hint
details: Additional details
```

Check your server logs (terminal where `npm run dev` runs) for these details.

---

## Quick Checklist

- [ ] Run `PUSH_SUBSCRIPTIONS_SETUP.sql` in Supabase
- [ ] Verify `.env.local` has service role key
- [ ] Restart dev server: `npm run dev`
- [ ] Go to `/dashboard/notifications`
- [ ] Click "Subscribe (client)" and allow permission
- [ ] Click "Send Server Push Test"
- [ ] ✅ Notification appears in browser!

---

## Production Deployment (Vercel)

1. **Add to Vercel Environment Variables:**
   - Go to Vercel → Project Settings → Environment Variables
   - Add all keys from `.env.local`
   - Include VAPID keys!

2. **Redeploy:**
   - Vercel will automatically redeploy when you push to GitHub
   - Or manually trigger: Vercel Dashboard → Deployments → Redeploy

3. **Test on Production:**
   - Go to your Vercel deployment URL
   - Subscribe and test push notifications

---

Created: 2025
Last Updated: $(date)
