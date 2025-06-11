# Group Categorization and Sorting Improvement

## Problem
The Groups page was showing all groups mixed together with unclear sorting. Users couldn't easily identify:
- Which groups they owned/moderated/were members of
- Why certain groups appeared at the top
- Groups were sorted by user relationship first, then by activity, making it confusing

## Solution
Implemented **clear categorization with section headers** and **activity-based sorting within each category**.

## Changes Made

### 1. Section-Based Layout
Groups are now organized into clear sections:

- **📌 Pinned Groups** - Groups the user has pinned
- **👥 Your Groups** - Groups where user is owner/moderator/member (combined)
- **⏱️ Pending Join Requests** - Groups with pending join requests  
- **📈 Other Groups** / **All Groups** - All other groups

### 2. Activity-First Sorting
Within each section, groups are sorted by:
1. **Activity level** (posts + participants count) - highest first
2. **Alphabetical** as tiebreaker

### 3. Visual Improvements
- Section headers with descriptive icons
- Maintained existing role badges (Owner/Moderator/Member)
- Maintained existing background highlighting for user groups
- Clear separation between different types of groups

## Technical Implementation

### Categorization Logic
```typescript
const categories = {
  pinned: [] as Group[],
  owned: [] as Group[],
  moderated: [] as Group[],
  member: [] as Group[],
  pending: [] as Group[],
  other: [] as Group[]
};
```

### Activity-Based Sorting
```typescript
const sortByActivity = (a: Group, b: Group) => {
  // Activity sorting for NIP-72 groups
  if (groupStats && a.type === 'nip72' && b.type === 'nip72') {
    const aActivity = aStats.posts + aStats.participants.size;
    const bActivity = bStats.posts + bStats.participants.size;
    return bActivity - aActivity; // Higher activity first
  }
  // Alphabetical fallback
  return aName.localeCompare(bName);
};
```

## User Experience Benefits

1. **Clear Visual Hierarchy** - Users immediately see their relationship to each group
2. **Activity-Driven Discovery** - Most active groups are prominently displayed
3. **Role Visibility** - Owner/Moderator/Member badges are clearly visible
4. **Logical Organization** - Related groups are grouped together
5. **Preserved Functionality** - All existing features (pinning, role detection, etc.) maintained

## Example Layout

```
📌 Pinned Groups
[Group cards sorted by activity]

👥 Your Groups  
[Owned/moderated/member groups sorted by activity]

⏱️ Pending Join Requests
[Groups with pending requests]

📈 Other Groups
[All other groups sorted by activity]
```

This makes it much clearer why certain groups appear where they do, while still prioritizing the most active and relevant groups for each user.