# LivePick PWA - AI Copilot Instructions

## Architecture Overview

**LivePick** is a private football match scanner PWA with real-time notifications, built on Next.js with Supabase backend. The core value is intelligent filter-based match detection across 100+ conditions.

### Core Data Flow
```
Football API → Match Stats → Filter Engine → Match Scoring → Notifications (Telegram/Web Push)
                                  ↓
                          Live Matcher (real-time)
                          Supabase RLS (user-scoped)
```

### Key Components

- **Filter Engine** (`lib/filter-engine.ts`): AND-logic matching of live stats vs filters; returns `FilterMatchResult` with matched/failed conditions
- **Background Scanner** (`lib/background-scanner.ts`): Singleton service for persistent match scanning every 30s, runs across all pages, sends notifications automatically
- **Live Matcher** (`lib/live-filter-matcher.ts`): Real-time batch evaluation of all user filters against a match; includes team history context and predictability scoring
- **Filter Validation** (`lib/filter-validation.ts`): 3-layer pattern (condition validation, completeness checks, duplicate prevention)
- **Unified API** (`lib/unified-api.ts`): Abstraction layer for live matches/stats fetching and status checks
- **Supabase Client** (`lib/supabase.ts`): Auth, CRUD helpers with RLS policies; Filter interface has 30+ condition types
- **Notifications** (`lib/notifications.ts`, `lib/telegram.ts`): Web push + Telegram integration with permission/subscription handling
- **Odds Provider** (`lib/odds-provider.ts`): Fetches match odds for informed filtering (supports multiple bookmaker formats)
- **Scanner Initializer** (`components/ScannerInitializer.tsx`): Root component that initializes background scanner on app mount

## Critical Developer Workflows

### Building & Running
```bash
npm run dev              # http://localhost:3000 (hot reload)
npm run build            # Production build
npm start                # Start production server
npm run generate-icons   # PWA icon generation from manifest
```

### Authentication Flow (Custom + RLS)
1. **Client:** User logs in, credentials sent to `/api/register` or via `authHelpers` (stored in localStorage + `rsq_session` cookie)
2. **Server Middleware:** Validates `rsq_session` cookie for protected routes; redirects to `/login` if missing
3. **Database:** Users table with bcrypt hashing; filters table has RLS (`WHERE user_id = auth.uid()`)
4. **API Pattern:** Pass `user_id` in request body (client extracts from localStorage); server uses SERVICE_ROLE_KEY for admin bypass, but must validate `user_id` matches request context

### Filter Lifecycle (Validation Pattern)
1. **Receive conditions** → Validate min/max ranges, realistic values, no contradictions
2. **Check completeness** → For notifications, require at least one numeric value
3. **Check duplicates** → Query user's filters for name + condition matches
4. **Write to DB** → Return 400/409 for errors, 201 for success

Example: `/api/filters/create` route implements this 3-layer validation.

### Background Scanner (Always-On Scanning)
- **Service:** `lib/background-scanner.ts` provides `BackgroundScannerService` singleton
- **Initialization:** `ScannerInitializer` component in root layout starts scanner on app mount
- **Behavior:** Runs every 30 seconds continuously, regardless of which page user views
- **Notifications:** Sends Web Push and Telegram alerts automatically when matches trigger filters
- **Deduplication:** Won't send same alert twice within 24 hours
- **Database Logging:** All matches logged with notification type "background_scan"
- **State:** Uses sessionStorage for cross-tab awareness; survives page refresh

### Real-Time Match Evaluation
- `getMatchingFiltersForMatch()` in `lib/live-filter-matcher.ts` evaluates all user filters against a single match
- `evaluateFilterForMatch()` calculates match predictability and historical context
- Notifications sent only if filter.notification_enabled AND filter.telegram_enabled (or web push enabled)

## Code Patterns & Conventions

### Filter Conditions (30+ types, nested min/max/team)
```typescript
conditions: {
  corners?: { min?: number; max?: number; team?: 'home'|'away'|'total' },
  shots_on_target?: { min?: number; max?: number },
  goals?: { min?: number; max?: number; team?: 'home'|'away'|'total' },
  yellow_cards?: { min?: number; max?: number },
  red_cards?: { min?: number; max?: number },
  possession?: { min?: number; max?: number }, // percentage
  // See lib/supabase.ts for complete FilterConditions interface
}
```

### Filter Matching Logic
- **AND Logic:** ALL conditions must match for filter to trigger
- **Output:** `FilterMatchResult` includes `matchedConditions[]` and `failedConditions[]` for debugging
- **Batch Evaluation:** `getMatchingFiltersForMatch()` returns array of `FilterMatchDetails` with predictability scores

### File Organization
- `lib/` — Core business logic (filters, matching, API abstraction, validation, notifications, odds)
- `app/api/` — RESTful endpoints with service-role auth validation
- `app/dashboard/` — Protected UI (live matches, filters, settings, telegram config)
- `components/` — Reusable UI (MatchCard, FilterCard, LiveIndicator)
- `supabase/functions/` — Edge functions (Telegram bot webhooks)

### API Status Codes
```
401 - Auth required or user_id mismatch
400 - Validation failed (errors array in response)
409 - Conflict (duplicate filter, etc.)
500 - Server error
```

## Project-Specific Conventions

1. **Interfaces in supabase.ts:** Filter, User, FilterConditions defined with full TypeScript types
2. **Validation returns structured results:** `ValidationResult { isValid, errors[], warnings[] }`, `DuplicateCheckResult { isDuplicate, existingFilter }`
3. **Template-First Design:** 100+ templates in `lib/filter-templates.ts` (corners ranges, goal patterns, specific leagues, etc.)
4. **Filter Analytics:** Track `trigger_count`, `success_rate`, `last_triggered`, `version` (for fork tracking)
5. **Odds Integration:** `lib/odds-provider.ts` provides decimal/US odds formatting and implied probability calculations
6. **Predictability Scoring:** `calculateMatchPredictability()` in `lib/live-filter-matcher.ts` uses team history context

## Integration Points

- **API-Football:** Fetches live matches + detailed stats via RapidAPI (see `lib/api-football.ts`)
- **Unified API Layer:** `lib/unified-api.ts` abstracts direct API calls; check `checkAPIStatus()` for debugging
- **Telegram:** `lib/telegram.ts` sends notifications; verify `isTelegramConfigured()` before sending
- **Web Push:** `lib/notifications.ts` handles subscription/permission management with VAPID keys
- **Odds Data:** `lib/odds-provider.ts` fetches from multiple bookmakers; caches results in `matchOdds` map
- **PWA:** Service worker via `next-pwa` caches static assets aggressively; manifest.json defines VAPID keys and app metadata

## Important Files Reference

| File | Purpose | Key Functions |
|------|---------|----------------|
| `lib/filter-engine.ts` | Core AND-logic matching | `matchesFilter(match, filter)` → `FilterMatchResult` |
| `lib/background-scanner.ts` | Always-on background scanning | `getBackgroundScanner()`, `BackgroundScannerService.start/stop/getState()` |
| `components/ScannerInitializer.tsx` | Scanner initialization | Mounts in root layout, starts scanner for logged-in users |
| `lib/live-filter-matcher.ts` | Real-time batch evaluation | `getMatchingFiltersForMatch()`, `evaluateFilterForMatch()`, `calculateMatchPredictability()` |
| `lib/filter-validation.ts` | Range/completeness/duplicate checks | `validateFilterConditions()`, `checkDuplicate()` |
| `lib/supabase.ts` | DB client + CRUD + interfaces | Filter, User, FilterConditions interfaces + DB helpers |
| `lib/unified-api.ts` | Abstracted API layer | `getLiveMatches()`, `getMatchStatistics()`, `checkAPIStatus()` |
| `lib/notifications.ts` | Web push management | `subscribeToPush()`, `sendMatchNotification()`, `requestNotificationPermission()` |
| `lib/telegram.ts` | Telegram bot integration | `sendTelegramMatchNotification()`, `verifyTelegramChatId()`, `formatMatchForTelegram()` |
| `lib/odds-provider.ts` | Odds fetching + formatting | `getOddsForMatch()`, `formatOdds()`, `getImpliedProbability()` |
| `lib/filter-templates.ts` | 100+ preset conditions | `FILTER_TEMPLATES` array with ready-made filter objects |
| `middleware.ts` | Route protection | Cookie validation for protected routes |

## Common Tasks

**Add new filter condition:** (1) Edit `FilterConditions` interface in `lib/supabase.ts` (2) Add validation rules in `lib/filter-validation.ts` (3) Add matching logic in `lib/filter-engine.ts` (4) Optional: add odds/predictability context in `lib/live-filter-matcher.ts`

**Debug match scoring:** Check `calculateMatchPredictability()` in `lib/live-filter-matcher.ts`; verify `TeamHistoryData` context is populated correctly

**Fix notification delivery:** (1) Verify `notification_enabled` on filter (2) Check `isTelegramConfigured()` returns true (3) Validate chat_id exists (4) See `supabase/functions/telegram-bot/` for webhook parsing

**Add API endpoint:** Create route in `app/api/` with server-side Supabase client (SERVICE_ROLE_KEY); validate `user_id` from request body; return consistent status codes

**Optimize filter matching:** Profile `getMatchingFiltersForMatch()` performance; consider caching filter conditions or using indexed DB queries for large filter sets
