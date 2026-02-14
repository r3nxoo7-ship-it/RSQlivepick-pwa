# 🔴 ESPN Matches Not Loading - Troubleshooting Guide

**Current Status:**
- ✅ Filters: 56 working
- ✅ ESPN matches table: Created
- ❌ ESPN matches: 0 loaded  
- ❌ Background scanner: Can't start (no matches to scan)

---

## 🚀 Quick Fix: Manual Sync Trigger

Open browser console (**F12 → Console**) and run:

```javascript
// Trigger manual ESPN sync
fetch('/api/espn/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(d => console.log('Sync result:', d))
.catch(e => console.error('Sync failed:', e));
```

Then **wait 5 seconds** and refresh the page. Matches should appear!

**Expected console output:**
```
Sync result: {
  "success": true,
  "matches": { "synced": 15, "duration_ms": 245 },
  ...
}
```

---

## 🔍 Diagnosis: Check What's Failing

### Step 1: Test ESPN API Directly
In console:
```javascript
// Test if ESPN API is accessible
fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard')
  .then(r => r.json())
  .then(d => {
    console.log('ESPN API working! Events found:', d.events?.length || 0);
  })
  .catch(e => console.error('ESPN API failed:', e));
```

**Expected:** Should log `Events found: X` (where X > 0)

### Step 2: Check Supabase Connection
In console:
```javascript
// Test if we can reach Supabase espn_matches table
fetch('/api/espn/matches')
  .then(r => r.json())
  .then(d => {
    console.log('Supabase connection:', d);
    console.log('Matches in DB:', d.live?.count || 0, 'live,', d.upcoming?.count || 0, 'upcoming');
  })
  .catch(e => console.error('Supabase connection failed:', e));
```

**Expected:** Should show table structure even if empty

### Step 3: Check Environment Variables
Missing env vars will cause silent failures. Ask in dev chat:
- ✅ Do you have `NEXT_PUBLIC_SUPABASE_URL` set?
- ✅ Do you have `SUPABASE_SERVICE_ROLE_KEY` set?
- ✅ Is the service role key correct in Supabase settings?

---

## 📋 Step-by-Step Debug

### If ESPN API test **FAILED**:
- ESPN public API might be down/rate-limited
- **Solution:** Wait 10 minutes and try again, OR use fallback API (API-Football)

### If Supabase test **FAILED**:
- Service role key might be invalid/expired
- Database connection broken
- **Solution:** 
  1. Go to Supabase → Settings → API
  2. Copy fresh `Service Role Key`
  3. Update `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=<paste>`
  4. Redeploy to Vercel

### If both **PASSED** but still no matches:
- Sync endpoint might be blocked
- Console logs might show the error
- **Solution:**
  1. Open browser DevTools (F12)
  2. Go to Network tab
  3. Click "Refresh" page
  4. Look for `/api/espn/sync` or `/api/espn/matches` requests
  5. Click them and check Response tab for error messages
  6. Share screenshot of errors

---

## ✅ Verification Checklist

After manual sync trigger:

```javascript
// 1. Check if espn_matches table has data
fetch('/api/espn/matches')
  .then(r => r.json())
  .then(d => console.log('Matches:', d.live?.count, 'live +', d.upcoming?.count, 'upcoming'));

// 2. Check if filters still load
fetch('/api/filters/get?user_id=bf764164-09e1-4a7f-905d-745a4eba4679')
  .then(r => r.json())
  .then(d => console.log('Filters:', d.data?.length));

// 3. Check if scanner can initialize
fetch('/api/espn/matches').then(() => console.log('Scanner should start now!'));
```

---

## 🎯 Expected Timeline

1. **Now:** Run manual sync trigger (1 API call)
2. **+5 seconds:** Refresh page
3. **+10 seconds:** Matches appear in tabs (Today, Tomorrow, etc.)
4. **+15 seconds:** Background scanner shows "Active" status
5. **+30 seconds:** First scan completes (Total Scans: 1)
6. **+60 seconds:** Second scan completes

---

## 🆘 If Nothing Works

**Copy-paste these test results into your response:**

```
1. ESPN API test result: [paste console output]
2. Supabase connection test: [paste console output]
3. Sync trigger result: [paste console output]  
4. Browser console errors: [screenshot or text]
5. Network tab errors: [screenshot or text]
```

Then I can identify exactly what's broken! 🔧
