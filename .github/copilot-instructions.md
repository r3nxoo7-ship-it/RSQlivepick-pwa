# LivePick PWA - AI Copilot Instructions

## Architecture Overview

**LivePick** is a private football match scanner PWA with real-time notifications, built on Next.js with Supabase backend. The core value is intelligent filter-based match detection across 100+ conditions.

### Core Data Flow
```
Live Football API → Match Stats → Filter Engine → Notifications (Telegram/Web)
                                        ↓
                                   Supabase RLS
                                   User-scoped
```

### Key Components

- **Frontend (Next.js App Router):** Dashboard (`/dashboard`), Login, Filters UI
- **Filter Engine (`lib/filter-engine.ts`):** Matches live stats against user filters using multi-condition logic (AND operations on all conditions)
- **Filter Validation (`lib/filter-validation.ts`):** Prevents duplicates, validates ranges, ensures completeness before notification
- **Database Layer (`lib/supabase.ts`):** Handles auth + CRUD with RLS policies (users can only access their own data)
- **API Routes (`app/api/`):** Thin wrappers using server-side Supabase client with `SERVICE_ROLE_KEY` to bypass RLS for admin operations
- **Telegram Integration (`app/api/telegram/`):** Webhook handler for Telegram verification and notifications

## Critical Developer Workflows

### Building & Running
```bash
# Development (with hot reload)
npm run dev                   # http://localhost:3000

# Production build
npm build && npm start

# Generate PWA icons from manifest
npm run generate-icons
```

### Authentication Architecture
- **Client Side:** User object in `localStorage` (via `authHelpers.login/logout/getCurrentUser`)
- **Server Side:** Session validated via `rsq_session` cookie in middleware
- **Database:** Simple users table with bcrypt password hashing
- **Key Pattern:** Pass `user_id` in API request bodies (client gets from localStorage), server validates it matches request context

### API Filter Creation Flow
The `/api/filters/create` route demonstrates a **3-layer validation pattern** used throughout:
1. **Condition Validation:** Range checks (min ≤ max), realistic values, no contradictions
2. **Completeness Check:** For notifications, require at least one numeric value (min or max)
3. **Duplicate Prevention:** Check name + conditions match across user's existing filters

Always validate **before** writing to database. Return `400` for validation errors, `409` for conflicts.

### Supabase RLS Policy Pattern
Users can only access their own filters via RLS:
```sql
-- filters table RLS
WHERE user_id = auth.uid()
```
But API routes bypass RLS using `SUPABASE_SERVICE_ROLE_KEY`, so they must validate `user_id` in request body.

## Code Patterns & Conventions

### Filter Conditions Structure
```typescript
// FilterConditions is a JSON object with optional nested min/max/team
conditions: {
  corners?: { min?: number; max?: number; team?: 'home'|'away'|'total' },
  shots_on_target?: { min?: number; max?: number },
  goals?: { min?: number; max?: number; team?: 'home'|'away'|'total' },
  // ... 20+ more condition types in lib/supabase.ts
}
```

### Filter Matching Logic
- All conditions use **AND logic** (must match ALL)
- Each condition type checks min/max against match stats
- Returns `FilterMatchResult` with matched/failed conditions for debugging

### File Organization
- `lib/` - Core business logic (filters, auth, analytics, validation)
- `app/api/` - RESTful endpoints using server-side Supabase
- `app/dashboard/` - Protected pages (live, filters, settings, analytics, telegram)
- `components/` - Reusable UI (MatchCard, LiveIndicator, etc.)

### Error Handling Pattern
```typescript
// API routes use status codes consistently
401 - Invalid/missing user authentication
400 - Validation errors (details array included)
409 - Conflict (e.g., duplicate filter)
500 - Server errors
```

## Project-Specific Conventions

1. **TypeScript Interfaces:** All domain objects (Filter, User, FilterConditions) are explicitly typed in `lib/supabase.ts`
2. **Validation Functions:** Pure functions in `lib/filter-validation.ts` that return structured results (ValidationResult, DuplicateCheckResult)
3. **Templates Over Code:** 100+ filter templates in `lib/filter-templates.ts` provide preset conditions (corners ranges, goal patterns, etc.)
4. **Analytics on Filters:** Track `trigger_count`, `success_rate`, `last_triggered` for each filter; `lib/analytics.ts` provides stats calculations
5. **Consistent Error Messages:** All validation errors and warnings use English for global accessibility

## Integration Points

- **Football API:** `lib/api-football.ts` fetches live matches and stats via RapidAPI/direct API
- **Telegram Bot:** Supabase Edge Function (`supabase/functions/telegram-bot/`) handles incoming webhooks
- **Notifications:** Sent when filter matches (if enabled) via Telegram or web push
- **PWA Cache:** Service worker (next-pwa) caches static assets and fonts aggressively

## Important Files Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `lib/filter-engine.ts` | Core matching logic | `matchesFilter()`, `applyFiltersToMatches()` |
| `lib/filter-validation.ts` | Validation rules | `validateFilterConditions()`, `checkDuplicate()` |
| `lib/supabase.ts` | DB + Auth helpers | `supabase` client, all CRUD functions |
| `app/api/filters/create/route.ts` | Create filter with validation | 3-layer validation demo |
| `middleware.ts` | Route protection | Session cookie checks |
| `app/login/page.tsx` | Auth entry point | Login form + password reset |
| `lib/filter-templates.ts` | 100+ preset filters | `FILTER_TEMPLATES` array |
| `lib/analytics.ts` | Performance calculations | Filter stats aggregations |

## Common Tasks

**Add a new filter condition:** Edit `FilterConditions` interface in `lib/supabase.ts`, add validation rule in `lib/filter-validation.ts`, add matching logic in `lib/filter-engine.ts`.

**Fix filter matching logic:** Check `lib/filter-engine.ts` for AND/OR logic; verify stats parsing in `lib/api-football.ts` returns expected format.

**Debug Telegram notifications:** Check `supabase/functions/telegram-bot/` for webhook handling; verify `telegram_enabled` flag and filter `notification_enabled` before sending.

**Add API endpoint:** Create route in `app/api/` with server-side Supabase client (SERVICE_ROLE_KEY), validate `user_id` from request body, return appropriate status codes.
