# Header Fixes

## Changes Made:

### 1. Reduced Header Height
- Changed logo text size from `text-3xl` to `text-2xl`
- Changed the "+" symbol from `text-4xl` to `text-3xl`
- This creates a more compact header while maintaining readability

### 2. Fixed Blue Ring on User Dropdown
- Added `focus:outline-none` to the dropdown trigger button in AccountSwitcher
- This removes the blue focus ring that appears after clicking to close the dropdown
- The dropdown still maintains accessibility through keyboard navigation

### 3. Moved Header Elements and Separator Up
- Reduced container top padding from `py-3` to `py-1` across all pages
- Reduced separator margins from `my-4` to `my-2`
- Reduced top margins after headers from `mt-4` to `mt-2` and `mt-6` to `mt-3`
- This creates tighter spacing at the top of all pages

### 4. Removed Separators from Group Pages
- Removed all `<Separator>` components between header and content on group-related pages
- Removed unused Separator imports from:
  - GroupDetail.tsx
  - GroupSettings.tsx
  - CreateGroup.tsx
  - Groups.tsx
- Creates cleaner visual flow from header to content

### 5. Added Spacing and Left-Aligned Buttons on Group Detail Page
- Added `mt-4` to the main content div on GroupDetail page to move content down slightly
- Left-aligned all buttons in the sidebar:
  - JoinRequestButton - Added `justify-start` to all button variants
  - GroupNutzapButton - Changed to use `justify-start` instead of `flex items-center`
  - Manage Group button - Added `justify-start` class
- Added `cn()` utility import where needed for proper class merging

## Files Modified:
- `src/components/ui/Header.tsx` - Reduced text sizes
- `src/components/auth/AccountSwitcher.tsx` - Added focus:outline-none to button
- All page components in `src/pages/` - Reduced padding and margins
- Group pages - Removed separators and imports
- `src/pages/GroupDetail.tsx` - Added mt-4 spacing and left-aligned manage button
- `src/components/groups/JoinRequestButton.tsx` - Left-aligned all button states
- `src/components/groups/GroupNutzapButton.tsx` - Left-aligned eCash button

## Result:
- Tighter, more compact header
- No more blue ring appearing on the user dropdown after clicking
- Less white space at the top of pages
- More content visible above the fold
- Cleaner visual flow on group pages without separator lines
- Better visual hierarchy on group detail page with consistent left-aligned buttons