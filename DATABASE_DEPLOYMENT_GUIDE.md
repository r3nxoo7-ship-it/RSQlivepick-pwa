# LivePick PWA - Complete Database Deployment Guide

## 📋 Overview

This guide will help you set up the complete Supabase database for the LivePick PWA project with all tables, indexes, RLS policies, and relationships.

---

## 🚀 Quick Start (Fresh Setup)

### Step 1: Run the Complete Schema Script

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy the entire contents of `COMPLETE_DATABASE_SCHEMA.sql`
5. Paste into the SQL Editor
6. Click **Run**

✅ This will create all 7 tables with proper indexes and RLS policies

### Step 2: Verify Setup

Run the verification queries at the end of the schema script to ensure:
- All 7 tables exist
- RLS is enabled on all tables
- All policies are created

### Step 3: Create Admin User

```bash
node scripts/setup-admin.js
```

Follow the prompts to create your first admin user.

### Step 4: Test Your Setup

1. **Test Login:**
   ```
   http://localhost:3002/login
   ```
   - Use your admin credentials
   - Should redirect to dashboard ✅

2. **Test Filter Creation:**
   ```
   http://localhost:3002/dashboard/filters/new
   ```
   - Create a test filter
   - Should save successfully ✅

3. **Test Live Matches:**
   ```
   http://localhost:3002/dashboard/live
   ```
   - Should load live matches
   - Background scanner should start ✅

---

## 📊 Database Schema Summary

| Table | Purpose | Foreign Keys | RLS Enabled |
|-------|---------|--------------|-------------|
| **users** | Authentication & user accounts | None | ✅ |
| **profiles** | Extended user settings | users(id) | ✅ |
| **filters** | Match filter conditions | users(id), filters(id) | ✅ |
| **triggered_matches** | Filter trigger history | users(id), filters(id) | ✅ |
| **matches_history** | User match picks | users(id), filters(id) | ✅ |
| **notifications_log** | Notification tracking | users(id), filters(id) | ✅ |
| **push_subscriptions** | Web push credentials | users(id) | ✅ |

---

## 🔐 RLS Policies Explained

### **Pattern:** Users see only their own data

```sql
-- Example: triggered_matches table
CREATE POLICY "Users can view own triggered matches"
ON triggered_matches
FOR SELECT
USING (auth.uid() = user_id);
```

### **Exception:** Users table SELECT policy

```sql
-- Special case: needed for login WITHOUT authentication
CREATE POLICY "Allow all SELECT"
ON users
FOR SELECT
USING (true);
```

**Why?** Login needs to query users table before authentication exists. This is safe because:
- Passwords are bcrypt hashed
- Password verification happens server-side
- Only password_hash is returned (not the actual password)

---

## 🔍 Database Relationships Diagram

```
users (id)
├─── profiles (id)
│    └── Telegram settings
│
├─── filters (user_id)
│    ├── conditions (JSONB)
│    ├── notification settings
│    └── forked_from_id → filters(id) [self-reference]
│
├─── triggered_matches (user_id)
│    ├── match_id (external API reference)
│    └── filter_id → filters(id)
│
├─── matches_history (user_id)
│    ├── match_id (external API reference)
│    └── filter_id → filters(id)
│
├─── notifications_log (user_id)
│    └── filter_id → filters(id)
│
└─── push_subscriptions (user_id)
     └── endpoint (unique)
```

---

## 🏗️ Table-by-Table Breakdown

### 1. USERS TABLE

**Purpose:** Authentication and user management

**Key Columns:**
- `id` (UUID, PK)
- `username` (TEXT, UNIQUE, case-insensitive)
- `password_hash` (TEXT, bcrypt hashed)
- `is_admin` (BOOLEAN)
- `is_active` (BOOLEAN)

**Indexes:**
- UNIQUE: LOWER(username) - case-insensitive login
- Regular: is_active, is_admin

**RLS Policies:**
- SELECT: Allow all (needed for login)
- UPDATE: Allow self only
- INSERT: Allow self only

---

### 2. PROFILES TABLE

**Purpose:** Extended user profile and Telegram integration

**Key Columns:**
- `id` (UUID, PK, FK → users.id)
- `telegram_chat_id` (BIGINT)
- `telegram_username` (TEXT)
- `telegram_enabled` (BOOLEAN)
- `telegram_verified_at` (TIMESTAMP)

**Indexes:**
- Primary: id
- Regular: telegram_chat_id

**RLS Policies:**
- SELECT: Users view own profile
- INSERT: Users create own profile
- UPDATE: Users update own profile

**Notes:**
- Created on first profile update (upsert pattern)
- CASCADE delete when user is deleted

---

### 3. FILTERS TABLE

**Purpose:** User-defined match filtering conditions

**Key Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id)
- `conditions` (JSONB) - complex filter logic
- `is_active` (BOOLEAN)
- `is_public` (BOOLEAN) - community sharing
- `notification_enabled` (BOOLEAN)
- `forked_from_id` (UUID, FK → filters.id) - filter versioning
- `version` (INTEGER) - v1.0, v2.0, etc.

**Indexes:**
- user_id, created_at DESC - fetch user's filters
- is_public - community filter discovery
- forked_from_id - track filter ancestry

**RLS Policies:**
- SELECT: Users view own OR public filters
- INSERT: Users create own filters
- UPDATE: Users update own filters
- DELETE: Users delete own filters

**Validation:**
- Duplicate detection: name + conditions uniqueness per user
- Min ≤ Max in all conditions
- Notifications require complete conditions

---

### 4. TRIGGERED_MATCHES TABLE

**Purpose:** History of filter matches (for notifications & analytics)

**Key Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id)
- `match_id` (TEXT) - external API reference
- `filter_id` (UUID, FK → filters.id)
- `triggered_at` (TIMESTAMP) - when filter matched
- `match_time` (INTEGER) - elapsed minutes
- `match_status` (TEXT) - 'ongoing', 'finished', 'scheduled'

**Indexes:**
- user_id, created_at DESC - recent triggers
- match_id - lookup by match
- filter_id - lookup by filter
- (match_id, filter_id) - deduplication

**RLS Policies:**
- SELECT: Users view own triggers
- INSERT: Users create own triggers

**Notes:**
- Logged by background scanner every 30 seconds
- 24-hour deduplication window per match+filter
- Captures match state at trigger time

---

### 5. MATCHES_HISTORY TABLE

**Purpose:** User's match picks and betting history

**Key Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id)
- `filter_id` (UUID, FK → filters.id)
- `match_id` (TEXT) - external API reference
- `bet_placed` (BOOLEAN)
- `bet_result` (TEXT) - 'WIN', 'LOSS', 'DRAW'
- `bet_odds` (NUMERIC)
- `statistics` (JSONB) - match stats from API

**Indexes:**
- user_id, picked_at DESC - recent picks
- match_id - lookup by match
- filter_id - lookup by filter

**RLS Policies:**
- SELECT: Users view own history
- INSERT: Users add to history
- DELETE: Users remove from history

**Notes:**
- Tracks betting performance
- Stores match statistics for analysis
- Used for user analytics dashboard

---

### 6. NOTIFICATIONS_LOG TABLE

**Purpose:** Track all notifications sent to users

**Key Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id)
- `match_id` (TEXT) - external API reference
- `filter_id` (UUID, FK → filters.id, ON DELETE SET NULL)
- `notification_type` (TEXT) - 'push', 'telegram', 'email'
- `delivered` (BOOLEAN)
- `read` (BOOLEAN)
- `error_message` (TEXT)
- `retry_count` (INTEGER)

**Indexes:**
- user_id, sent_at DESC - recent notifications
- delivered - find failed deliveries
- read - find unread notifications

**RLS Policies:**
- SELECT: Users view own notifications
- INSERT: Service role (bypasses RLS)

**Notes:**
- 24-hour deduplication window
- Logs both Web Push and Telegram
- Tracks delivery and read status

---

### 7. PUSH_SUBSCRIPTIONS TABLE

**Purpose:** Store Web Push subscription credentials

**Key Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id)
- `endpoint` (TEXT, UNIQUE) - push service URL
- `p256dh` (TEXT) - VAPID public key
- `auth` (TEXT) - VAPID auth secret
- `raw` (JSONB) - full subscription object

**Indexes:**
- UNIQUE: endpoint - prevent duplicate subscriptions
- user_id - lookup user's subscriptions

**RLS Policies:**
- SELECT: Users view own subscriptions
- INSERT: Users create own subscriptions
- DELETE: Users delete own subscriptions

**Notes:**
- One subscription per device/browser
- Service role bypasses RLS for sending notifications
- VAPID keys required in .env

---

## ⚡ Performance Optimization

### **Indexes Created:**

1. **Primary Keys:** All tables have UUID primary keys
2. **Foreign Keys:** All FK columns have indexes
3. **User Queries:** (user_id, created_at DESC) for pagination
4. **Unique Constraints:** username, endpoint
5. **Status Fields:** is_active, is_public, delivered, read

### **Query Performance Tips:**

```sql
-- ✅ GOOD: Uses index (user_id, created_at DESC)
SELECT * FROM triggered_matches
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 20;

-- ❌ BAD: No index on match_time alone
SELECT * FROM triggered_matches
WHERE match_time > 45
ORDER BY match_time DESC;

-- ✅ GOOD: Uses index (user_id, created_at DESC) + filter
SELECT * FROM triggered_matches
WHERE user_id = 'user-uuid'
  AND match_time > 45
ORDER BY created_at DESC;
```

---

## 🔧 Common Issues & Solutions

### Issue 1: "RLS policy violation" errors

**Cause:** RLS policies block unauthorized access

**Solution:**
1. Check if user is authenticated: `auth.uid()` must exist
2. Verify user_id matches auth.uid()
3. For service operations, use SERVICE_ROLE_KEY

```typescript
// Client operations (uses anon key + RLS)
const { data } = await supabase
  .from('filters')
  .select('*')
  .eq('user_id', user.id);

// Service operations (bypasses RLS)
const { data } = await supabaseAdmin
  .from('notifications_log')
  .insert({ ... });
```

---

### Issue 2: Duplicate filter detection not working

**Cause:** Filters validation only checks in application layer

**Solution:**
- Validation happens in `/api/filters/create`
- Returns 409 Conflict if duplicate found
- Checks: name + conditions + user_id

---

### Issue 3: Foreign key constraint errors

**Cause:** Referencing non-existent parent records

**Common Scenarios:**
1. Creating filter with invalid user_id
2. Creating triggered_match with deleted filter_id
3. Inserting notification with wrong user_id

**Solution:**
- Always validate parent records exist first
- Use CASCADE DELETE to auto-clean child records
- Check user authentication before operations

---

## 🧪 Testing Your Database

### Test 1: Create User & Login

```sql
-- Verify user exists
SELECT id, username, is_active, is_admin
FROM users
WHERE username = 'admin';

-- Check password hash format
SELECT
  username,
  LENGTH(password_hash) as hash_length,
  password_hash LIKE '$2a$%' as is_bcrypt
FROM users;
```

### Test 2: Filter Operations

```sql
-- Create test filter (via app or API)
-- Then verify it exists

SELECT
  id,
  name,
  is_active,
  notification_enabled,
  conditions
FROM filters
WHERE user_id = 'your-user-id';

-- Check conditions structure
SELECT
  name,
  jsonb_pretty(conditions) as formatted_conditions
FROM filters
WHERE user_id = 'your-user-id';
```

### Test 3: Triggered Matches

```sql
-- Check triggered matches for user
SELECT
  tm.filter_name,
  tm.home_team,
  tm.away_team,
  tm.match_time,
  tm.triggered_at,
  f.name as filter_name_from_filters
FROM triggered_matches tm
JOIN filters f ON tm.filter_id = f.id
WHERE tm.user_id = 'your-user-id'
ORDER BY tm.created_at DESC
LIMIT 10;
```

### Test 4: RLS Policies

```sql
-- Test RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'filters', 'triggered_matches');

-- Test policies exist
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 🚨 Troubleshooting Checklist

### Setup Issues

- [ ] All SQL scripts ran without errors
- [ ] All 7 tables exist in Supabase
- [ ] RLS is enabled on all tables
- [ ] All policies are created (check with pg_policies)
- [ ] All indexes are created
- [ ] Foreign key constraints are working

### Authentication Issues

- [ ] Admin user created successfully
- [ ] Admin has is_admin=true and is_active=true
- [ ] Password hash is valid bcrypt format ($2a$...)
- [ ] Username is stored in lowercase
- [ ] RLS policies allow login (SELECT on users)

### Filter Issues

- [ ] Filters table has correct structure
- [ ] conditions column is JSONB type
- [ ] Foreign key to users works
- [ ] RLS policies allow user to CRUD own filters
- [ ] Duplicate detection works (try creating identical filter)

### Notification Issues

- [ ] push_subscriptions table exists
- [ ] VAPID keys configured in .env
- [ ] notifications_log table exists
- [ ] Service role key configured
- [ ] Deduplication logic prevents spam

### Performance Issues

- [ ] All indexes created successfully
- [ ] Query plans use indexes (check with EXPLAIN)
- [ ] No sequential scans on large tables
- [ ] Pagination uses (user_id, created_at DESC) index

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `COMPLETE_DATABASE_SCHEMA.sql` | Complete schema setup (run this!) |
| `lib/supabase.ts` | TypeScript interfaces & helpers |
| `RLS_POLICIES_FIX.sql` | RLS policy reference |
| `PUSH_SUBSCRIPTIONS_SETUP.sql` | Push subscription setup |
| `triggered_matches.sql` | Triggered matches reference |

---

## 🎯 Next Steps After Setup

1. **Configure Environment:**
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Configure Web Push:**
   ```bash
   # Generate VAPID keys
   npx web-push generate-vapid-keys

   # Add to .env.local
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   ```

3. **Configure Telegram (Optional):**
   ```bash
   # Create bot with @BotFather
   # Add to .env.local
   TELEGRAM_BOT_TOKEN=your_bot_token
   ```

4. **Test Everything:**
   - Login as admin ✅
   - Create a filter ✅
   - View live matches ✅
   - Check background scanner ✅
   - Test notifications ✅

---

## ✅ Success Criteria

Your database is properly set up when:

- ✅ All 7 tables exist
- ✅ RLS enabled on all tables
- ✅ All indexes created
- ✅ Foreign keys work with CASCADE
- ✅ Admin user can login
- ✅ Filters can be created
- ✅ Background scanner logs triggered matches
- ✅ Notifications can be sent
- ✅ No RLS policy violations

---

**Database Setup Complete!** 🎉

For issues or questions, check:
- Supabase logs for SQL errors
- Browser console for RLS policy violations
- Server logs for API errors
- `lib/supabase.ts` for database helpers

