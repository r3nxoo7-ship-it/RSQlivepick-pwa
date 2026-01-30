# Public Filter Sharing System - v2.0 Versioning

## Overview

LivePick now supports a **public/private filter system** with **v2.0 versioning** for forking. Users can share their filters with the community, and others can import them as editable copies without modifying the original filter.

## Key Features

### 1. Public/Private Toggle

Every filter has:
- **`is_public: boolean`** - Controls visibility to other users
- **Private (default)**: Only you can see/edit
- **Public**: Anyone can import and create their own v2.0 copy

### 2. Version System (v2.0)

Filters now track:
- **`version: number`** - Filter version (1 = original, 2+ = forked copies)
- **`forked_from_id?: string`** - ID of original filter
- **`forked_from_user?: string`** - Creator's username
- **`is_editable: boolean`** - Controls if filter can be edited

#### Version Flow

```
Original Filter (v1.0) - is_editable: true
    ↓ (User imports)
Forked Copy (v2.0) - is_editable: true
    ├─ Independent of original
    ├─ User can edit conditions
    ├─ User can change public/private
    └─ Stats (trigger_count, success_rate) reset to zero
```

### 3. Import Protection

- **No duplicates**: Can't import same filter twice
- **Independent copies**: User's v2.0 has isolated stats
- **One-way link**: Original doesn't know about forks
- **Base filters immutable**: Original creator's filters can't be edited by others

## Database Schema Updates

### Filter Table New Fields

```typescript
interface Filter {
  // ... existing fields
  
  // Public/Private
  is_public: boolean;              // false = private (default)
  
  // Versioning & Forking
  version: number;                 // 1 = original, 2+ = forked
  is_editable: boolean;            // true = can edit, false = read-only
  forked_from_id?: string;         // Link to original filter
  forked_from_user?: string;       // Original creator username
}
```

### Migration Required

If upgrading from previous version, add columns to `filters` table:

```sql
ALTER TABLE filters ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE filters ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE filters ADD COLUMN is_editable BOOLEAN DEFAULT TRUE;
ALTER TABLE filters ADD COLUMN forked_from_id UUID;
ALTER TABLE filters ADD COLUMN forked_from_user TEXT;
```

## API Endpoints

### 1. Get Public Filters

**GET** `/api/filters/public`

Returns all public filters available for import.

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Big Scorers v1.0",
      "description": "Goals over 2.5",
      "is_public": true,
      "version": 1,
      "trigger_count": 145,
      "success_rate": 68.5,
      "forked_from_user": "raiz"
    }
  ]
}
```

### 2. Import Public Filter

**POST** `/api/filters/import`

Create a v2.0 copy of a public filter for current user.

```json
{
  "source_filter_id": "original-uuid",
  "user_id": "current-user-id"
}
```

Response:
```json
{
  "data": {
    "id": "new-uuid",
    "name": "Big Scorers v2.0",
    "version": 2,
    "forked_from_id": "original-uuid",
    "forked_from_user": "raiz",
    "is_editable": true,
    "is_active": false,
    "trigger_count": 0,
    "success_rate": null
  }
}
```

**Error Codes:**
- `400` - Invalid parameters
- `403` - Filter is not public
- `404` - Source filter not found
- `409` - Already imported this filter

### 3. Create Filter

**POST** `/api/filters/create`

Now includes `is_public` field:

```json
{
  "user_id": "uuid",
  "name": "My Filter",
  "conditions": { ... },
  "is_public": false,        // NEW: default false
  "notification_enabled": true
}
```

### 4. Update Filter

**PATCH** `/api/filters/update`

Includes edit restrictions:

```json
{
  "filterId": "uuid",
  "updates": {
    "is_public": true,       // Toggle public/private
    "name": "New Name"
  }
}
```

**Error:** `403` if `is_editable: false` (base filter)

### 5. Toggle Filter Visibility

**PATCH** `/api/filters/update`

```json
{
  "filterId": "uuid",
  "updates": {
    "is_public": true        // Make public
  }
}
```

## Client-Side Functions

### `lib/supabase.ts`

```typescript
// Get all public filters
const filters = await dbHelpers.getPublicFilters();

// Import a public filter (creates v2.0)
const { data, error } = await dbHelpers.importPublicFilter(
  sourceFilterId,
  userId
);

// Toggle filter public/private
const { data, error } = await dbHelpers.toggleFilterPublic(
  filterId,
  isPublic  // true = public, false = private
);
```

## UI Components

### FilterCard (Updated)

Now shows:
- **Version badge** for forked filters (v2.0, v3.0, etc.)
- **"Forked from" credit** showing original creator
- **Public/Private toggle** button (lock/share icon)
- **Edit restrictions** disabled if not editable

```tsx
<FilterCard
  filter={filter}
  onEdit={handleEdit}
  onTogglePublic={handleToggle}
  showPublicToggle={true}
  // ... other props
/>
```

### PublicFilterCard (New)

Displays public filters from community with import button:

```tsx
<PublicFilterCard
  filter={publicFilter}
  onImport={handleImport}
  isLoading={importing}
  alreadyImported={userHasImported}
/>
```

### Community Library Page

**URL:** `/dashboard/library`

- Browse all public filters
- See filter stats (trigger count, success rate)
- Import with one click
- View creator/version info

**Components:** 
- `app/dashboard/library/page.tsx` (Main page)
- `components/PublicFilterCard.tsx` (Filter card display)

## User Workflows

### Share Your Filter

1. Create and test filter in `/dashboard/filters`
2. Click **Share** button (lock icon) on FilterCard
3. Filter becomes `is_public: true`
4. Other users can find it in `/dashboard/library`

### Import Community Filter

1. Navigate to `/dashboard/library`
2. Browse public filters from community
3. Click **Import Filter** button
4. Filter appears in your library as **v2.0**
5. Edit, enable notifications, customize as needed
6. Original filter remains unchanged

### Edit Your Forked Filter

- All v2.0+ filters are editable by default
- You can change conditions, name, description
- Stats are independent (reset for your copy)
- Original filter is never affected

### Prevent Base Filter Edits

- Original creator's filters have `is_editable: true`
- Other users trying to edit: **Error 403 - This filter cannot be edited**
- Users must import to create their own editable copy

## Security & Permissions

### Edit Restrictions

Only the filter's owner can edit unless it's a forked copy:

```typescript
// Update API checks:
if (filter.is_editable === false) {
  return NextResponse.json({
    error: 'This filter cannot be edited',
    message: 'This is a read-only base filter. Import it to create your own editable version.'
  }, { status: 403 });
}
```

### Import Prevention

Can't import same filter twice:

```typescript
// Duplicate check looks for forked_from_id match
const existing = userFilters.find(f => f.forked_from_id === sourceFilterId);
if (existing) {
  return NextResponse.json({
    error: 'You already have this filter imported',
    message: 'Filter "Big Scorers v2.0" is already in your library'
  }, { status: 409 });
}
```

### Visibility Protection

- Private filters (`is_public: false`) not returned from `/api/filters/public`
- Only public filters can be imported
- Import fails with 403 if filter is private

## Examples

### Scenario 1: Share a Tested Filter

```
1. User "raiz" creates "Big Scorers" filter with 70% success rate
2. Tests it for 2 weeks, triggers 145 times
3. Clicks Share button → is_public: true
4. Filter appears in community library for all users
5. Other users see: "Big Scorers v1.0" by "raiz" • 68.5% success
6. They click Import → creates "Big Scorers v2.0" in their library
7. Their v2.0 has 0 triggers (independent stats)
8. They can modify conditions without affecting raiz's original
```

### Scenario 2: Import and Customize

```
1. User "alex" finds "Over 2.5 Goals" in library (by "pro-analyst")
2. Clicks Import → creates "Over 2.5 Goals v2.0"
3. Modifies conditions to only apply to top leagues
4. Enables notifications
5. Original filter unchanged; alex has independent v2.0
6. Later can make it public (their v2.0)
7. Others can import alex's version → creates v3.0
```

### Scenario 3: Version Evolution

```
Original (v1.0) - "Corners Over 10" by john
├─ Import → "Corners Over 10 v2.0" by maria
├─ Import → "Corners Over 10 v2.0" by alex
│           ├─ Modify to "Corners Over 8 v2.0"
│           └─ Make Public
│               └─ Import → "Corners Over 8 v3.0" by bob
└─ Import → "Corners Over 10 v2.0" by susan
```

## Migration Guide

### For Existing Filters

1. All existing filters get:
   - `is_public: false` (private by default)
   - `version: 1` (original version)
   - `is_editable: true` (owner can edit)
   - `forked_from_id: null` (not forked)

2. No changes to existing filter logic
3. All existing filters remain private and editable
4. Owners can opt-in to sharing

### SQL Migration

```sql
-- Add new columns
ALTER TABLE filters ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE filters ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE filters ADD COLUMN is_editable BOOLEAN DEFAULT TRUE;
ALTER TABLE filters ADD COLUMN forked_from_id UUID;
ALTER TABLE filters ADD COLUMN forked_from_user TEXT;

-- Create index for public filters query
CREATE INDEX idx_filters_is_public ON filters(is_public) WHERE is_public = true;
CREATE INDEX idx_filters_forked_from ON filters(forked_from_id);
```

## Notes

- **No need to credit creator**: System automatically records `forked_from_user`
- **Stats are independent**: Each user's copy has their own trigger count/success rate
- **Version auto-increments**: Each fork increases version number
- **Original immutable**: Original creator can only edit their own filters, not forks
- **One-way**: Forks don't update original; improvements are isolated
- **Scalable**: Can have unlimited forks of same filter (each is independent)

## Future Enhancements

- [ ] Filter comments/ratings from importers
- [ ] "Trending filters" based on imports
- [ ] Filter update notifications ("Original creator updated this filter")
- [ ] Filter merge/diff views
- [ ] Filter improvement suggestions
- [ ] Creator dashboard (see who imported my filters)
