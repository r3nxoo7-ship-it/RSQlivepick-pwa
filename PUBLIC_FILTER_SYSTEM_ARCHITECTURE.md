# Public Filter System - Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FilterCard.tsx                  PublicFilterCard.tsx        │
│  ├─ Show version (v1.0, v2.0)    ├─ Show public filter      │
│  ├─ Show "Forked from" credit    ├─ Show creator/stats      │
│  ├─ Public/Private toggle        ├─ Import button           │
│  ├─ Edit restriction check       └─ Already imported state   │
│  └─ Action buttons               Community Library Page      │
│                                  ├─ Browse all public filters│
│  BottomNavBar.tsx               ├─ Statistics dashboard     │
│  └─ Library link                └─ Grid layout (responsive) │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   CLIENT-SIDE LOGIC LAYER                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  lib/supabase.ts (dbHelpers)                                │
│  ├─ getPublicFilters()          - Fetch all public filters │
│  ├─ importPublicFilter()        - Create v2.0 copy         │
│  ├─ toggleFilterPublic()        - Toggle visibility        │
│  ├─ createFilter()              - Create (now with is_public)
│  └─ updateFilter()              - Update (with edit check)  │
│                                                              │
│  Error Handling:                                            │
│  ├─ 400: Invalid parameters                                 │
│  ├─ 403: Permission denied (not public, not editable)       │
│  ├─ 404: Filter not found                                   │
│  └─ 409: Conflict (duplicate import)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET  /api/filters/public                                   │
│  ├─ Returns: Filter[] where is_public = true               │
│  └─ Auth: Public (no auth required)                        │
│                                                              │
│  POST /api/filters/import                                   │
│  ├─ Body: { source_filter_id, user_id }                   │
│  ├─ Action: Create forked v2.0 copy                        │
│  ├─ Checks: is_public, duplicate, format                   │
│  └─ Returns: New Filter with version:2, forked_from_id     │
│                                                              │
│  POST /api/filters/create (UPDATED)                        │
│  ├─ Now accepts: is_public field                           │
│  ├─ Sets: version:1, is_editable:true                      │
│  └─ Default: is_public:false                               │
│                                                              │
│  PATCH /api/filters/update (UPDATED)                       │
│  ├─ Check: is_editable field before allow                  │
│  ├─ Return 403: If is_editable = false                     │
│  └─ Allow: Public/private toggle                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  DATABASE SCHEMA LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  filters table (Supabase)                                   │
│  ├─ id: UUID (Primary key)                                 │
│  ├─ user_id: UUID (FK to users)                            │
│  ├─ name, description, conditions                          │
│  ├─ is_active, is_shared, notification_enabled             │
│  │                                                          │
│  ├─ NEW FIELDS:                                             │
│  ├─ is_public: BOOLEAN (default false)                     │
│  ├─ version: INTEGER (default 1)                           │
│  ├─ is_editable: BOOLEAN (default true)                    │
│  ├─ forked_from_id: UUID (nullable)                        │
│  ├─ forked_from_user: TEXT (nullable)                      │
│  │                                                          │
│  ├─ trigger_count, success_rate, last_triggered            │
│  ├─ created_at, updated_at                                 │
│  │                                                          │
│  ├─ Indexes:                                                │
│  ├─ idx_filters_is_public ON (is_public) WHERE is_public    │
│  └─ idx_filters_forked_from ON (forked_from_id)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Flow 1: Share a Filter (Make it Public)

```
User in FilterCard
  │
  └─→ Click Share button (lock icon)
      │
      └─→ onTogglePublic() called
          │
          └─→ updateFilter() in lib/supabase.ts
              │
              └─→ PATCH /api/filters/update
                  │
                  └─→ { filterId, updates: { is_public: true } }
                      │
                      └─→ Server validates is_editable
                          │
                          └─→ Update filters table
                              │
                              └─→ Set is_public = true
                                  │
                                  └─→ Return updated Filter
                                      │
                                      └─→ UI updates: Lock → Share icon
```

### Flow 2: Import a Public Filter

```
User in Library Page
  │
  └─→ Browse public filters
      │
      └─→ Click "Import Filter" on PublicFilterCard
          │
          └─→ handleImport() calls importPublicFilter()
              │
              └─→ importPublicFilter(sourceFilterId, userId)
                  │
                  └─→ POST /api/filters/import
                      │
                      └─→ Body: { source_filter_id, user_id }
                          │
                          ├─→ Fetch source filter from DB
                          │
                          ├─→ Check: is_public = true
                          │
                          ├─→ Check: Not already imported
                          │   (forked_from_id check)
                          │
                          └─→ Create new filter:
                              │
                              ├─ name: "{original_name} (v2.0)"
                              ├─ version: 2
                              ├─ is_editable: true
                              ├─ forked_from_id: source_filter_id
                              ├─ forked_from_user: original_creator
                              ├─ is_public: false (private by default)
                              ├─ trigger_count: 0 (reset stats)
                              ├─ success_rate: null (reset stats)
                              └─ Copy: conditions, color, template_id
                                  │
                                  └─→ Insert into filters table
                                      │
                                      └─→ Return new Filter
                                          │
                                          └─→ Show success message
                                              │
                                              └─→ Refresh library
                                                  │
                                                  └─→ Show "Already Imported"
```

### Flow 3: Edit a Forked Filter

```
User wants to edit imported filter
  │
  └─→ Click Edit button on FilterCard
      │
      └─→ Is is_editable true?
          │
          ├─→ YES: Allow edit
          │   │
          │   └─→ Open filter editor
          │       │
          │       └─→ User modifies conditions
          │           │
          │           └─→ updateFilter() called
          │               │
          │               └─→ PATCH /api/filters/update
          │                   │
          │                   └─→ Check is_editable = true ✓
          │                       │
          │                       └─→ Update conditions
          │                           │
          │                           └─→ Success
          │
          └─→ NO: Show error message
              │
              ├─→ "This filter cannot be edited"
              ├─→ "This is a read-only base filter"
              └─→ "Import it to create your editable version"
```

### Flow 4: Prevent Edit of Base Filter

```
User tries to edit someone else's original filter
  │
  └─→ Click Edit on FilterCard
      │
      └─→ onEdit() called
          │
          └─→ PATCH /api/filters/update
              │
              └─→ API checks is_editable
                  │
                  ├─→ is_editable = false (base filter)
                  │   │
                  │   └─→ Return 403 Forbidden
                  │       │
                  │       └─→ User sees error message
                  │           │
                  │           └─→ Suggest importing instead
                  │
                  └─→ is_editable = true (own filter or v2.0)
                      │
                      └─→ Allow update
```

## Version Evolution Example

```
Original Creator (raiz):
  └─ Corners Over 10 (v1.0)
     is_editable: true
     is_public: false → true (shared)
     │
     ├─ Import by maria
     │  └─ Corners Over 10 (v2.0)
     │     version: 2
     │     forked_from_id: raiz's v1.0
     │     forked_from_user: "raiz"
     │     is_editable: true
     │     is_public: false
     │     stats: 0 triggers (fresh)
     │     │
     │     └─ maria makes her v2.0 public
     │        is_public: true
     │        │
     │        ├─ Import by alex
     │        │  └─ Corners Over 10 (v3.0)
     │        │     version: 3
     │        │     forked_from_id: maria's v2.0
     │        │     forked_from_user: "maria"
     │        │
     │        └─ Import by bob
     │           └─ Corners Over 10 (v3.0)
     │              version: 3
     │              forked_from_id: maria's v2.0
     │              forked_from_user: "maria"
     │
     └─ Import by susan
        └─ Corners Over 10 (v2.0)
           version: 2
           forked_from_id: raiz's v1.0
           forked_from_user: "raiz"
           is_public: false

KEY POINTS:
- raiz's v1.0 unchanged and unaware of all copies
- Each v2.0 is independent (different UUIDs, stats, conditions)
- v3.0 creations link to v2.0 originals, not raiz's v1.0
- Credit chain preserved (forked_from_user tracks creator)
```

## State Management

### Filter Object States

```
Original Filter (v1.0):
{
  version: 1,
  is_editable: true,
  is_public: false (default),
  forked_from_id: null,
  forked_from_user: null,
  trigger_count: 145,
  success_rate: 68.5
}
    ↓ (User makes public)
{
  version: 1,
  is_editable: true,
  is_public: true,  ✓ Changed
  forked_from_id: null,
  forked_from_user: null,
  trigger_count: 145,
  success_rate: 68.5
}
    ↓ (Another user imports)
Forked Filter (v2.0):
{
  version: 2,       ✓ New
  is_editable: true,
  is_public: false,
  forked_from_id: "original-uuid",  ✓ New
  forked_from_user: "raiz",          ✓ New
  trigger_count: 0,           ✓ Reset
  success_rate: null,         ✓ Reset
  name: "Corners Over 10 (v2.0)"  ✓ New
}
```

## Validation Rules

### On Filter Creation
```typescript
if (conditions invalid) → Error 400
if (conditions incomplete && notification_enabled) → Error 400
if (name + conditions duplicate) → Error 409
else → Create filter with:
  version: 1
  is_editable: true
  is_public: false
  forked_from_id: null
```

### On Filter Import
```typescript
if (not authenticated) → Error 401
if (!source_filter.is_public) → Error 403
if (already_imported) → Error 409 (Conflict)
else → Create v2.0 with:
  version: 2
  is_editable: true
  is_public: false
  forked_from_id: source_filter.id
  forked_from_user: source_filter.user_id
  trigger_count: 0
  success_rate: null
```

### On Filter Update
```typescript
if (!filter.is_editable) → Error 403
else → Allow all updates
```

### On Filter Public Toggle
```typescript
if (!filter.is_editable) → Error 403
else → Update is_public field
```

## Performance Considerations

### Database Indexes
```sql
CREATE INDEX idx_filters_is_public 
  ON filters(is_public) WHERE is_public = true;
-- Fast lookup for /api/filters/public endpoint

CREATE INDEX idx_filters_forked_from 
  ON filters(forked_from_id);
-- Fast lookup for duplicate import check
```

### Query Optimization
- Public filters query filters only (is_public = true)
- Import check uses indexed column (forked_from_id)
- No full table scans needed

### Scalability
- Unlimited filters can be imported (just new rows)
- No circular dependencies possible
- Each user's stats independent (no aggregation needed)
- Version tracking is local (no global version counter)

## Security Model

### Authentication
- Public filter endpoint: No auth (publicly readable)
- Import endpoint: Requires user_id (can't spoof)
- Update endpoint: Validates is_editable before allowing

### Authorization
- Users can only edit their own filters
- Base filters (v1.0) protected by is_editable = false
- Public filters protected by is_public = false check
- Duplicate import prevented by forked_from_id check

### Data Integrity
- RLS policies still apply (user_id = auth.uid())
- Service role bypasses RLS but validates user_id in body
- Forked_from_id creates audit trail
- Stats are immutable (never overwritten)

## Monitoring & Analytics

### Metrics to Track
```
Per Filter:
- trigger_count: How many times it matched
- success_rate: Accuracy percentage
- import_count: How many users imported it (future)
- version: Track generation

System-wide:
- Total public filters
- Total imports (forks)
- Most imported filters
- Highest success rate filters
- Version distribution
```

### Query Examples
```sql
-- Find most imported filters
SELECT forked_from_id, COUNT(*) as import_count
FROM filters
WHERE forked_from_id IS NOT NULL
GROUP BY forked_from_id
ORDER BY import_count DESC;

-- Find best performing filters
SELECT id, name, success_rate
FROM filters
WHERE is_public = true
ORDER BY success_rate DESC
LIMIT 10;

-- Version distribution
SELECT version, COUNT(*) as count
FROM filters
GROUP BY version;
```

## Future Enhancements

### Planned Features
- Filter ratings/comments from importers
- Trending filters dashboard
- Update notifications (original filter updated)
- Filter collaboration (multiple authors)
- Merge/diff tool for comparing versions
- Creator dashboard (see stats of your shared filters)
- Advanced search with tags/categories
- Automatic filter recommendations

### Possible Extensions
- Scheduled updates (sync with original)
- Diff viewer (see what changed from v1 to v2)
- Fork history tree visualization
- Filter marketplace
- Batch import/export
