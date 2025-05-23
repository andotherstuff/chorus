# PWA Detection and Management - Usage Examples

This document shows how to use the centralized PWA utilities that have been refactored to eliminate code duplication.

## Basic PWA Detection

```tsx
import { usePWA } from '@/hooks/usePWA';

function MyComponent() {
  const { isRunningAsPwa, isInstallable, showInstallBanner } = usePWA();

  if (isRunningAsPwa) {
    return <div>Running as PWA! 🎉</div>;
  }

  return (
    <div>
      <p>Running in browser</p>
      {isInstallable && <button>Install App</button>}
    </div>
  );
}
```

## Manual PWA Detection (without React)

```ts
import { isPWAMode, detectPlatform, isMobileDevice } from '@/lib/pwa';

// Check if running as PWA
if (isPWAMode()) {
  console.log('Running as PWA');
}

// Detect platform for specific instructions
const platform = detectPlatform(); // 'ios' | 'android-chrome' | 'chrome' | etc.

// Check if mobile device
if (isMobileDevice()) {
  console.log('Mobile device detected');
}
```

## Install Banner Management

```tsx
import { usePWA } from '@/hooks/usePWA';

function InstallBanner() {
  const { showInstallBanner, promptInstall, dismissBanner } = usePWA();

  if (!showInstallBanner) {
    return null;
  }

  return (
    <div className="install-banner">
      <p>Install our app for a better experience!</p>
      <button onClick={promptInstall}>Install</button>
      <button onClick={dismissBanner}>Dismiss</button>
    </div>
  );
}
```

## Conditional UI Based on PWA Status

```tsx
import { usePWA } from '@/hooks/usePWA';

function Header() {
  const { isRunningAsPwa } = usePWA();

  return (
    <header>
      <h1>My App</h1>
      {/* Only show install button if not already running as PWA */}
      {!isRunningAsPwa && <PWAInstallButton />}
    </header>
  );
}
```

## Benefits of the Refactored Approach

1. **No Code Duplication**: All PWA detection logic is centralized
2. **Consistent Behavior**: All components use the same detection methods
3. **Better Maintainability**: Changes to PWA logic only need to be made in one place
4. **Type Safety**: TypeScript interfaces ensure proper usage
5. **Performance**: Shared state prevents multiple event listeners
6. **Flexibility**: Can be used with or without React hooks

## Migration from Old Code

### Before (duplicated logic):
```tsx
// This was repeated in multiple files
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
const isIOSStandalone = (window.navigator as any).standalone;
// ... more detection logic
```

### After (centralized):
```tsx
import { usePWA } from '@/hooks/usePWA';
// or
import { isPWAMode } from '@/lib/pwa';

const { isRunningAsPwa } = usePWA();
// or
const isRunningAsPwa = isPWAMode();
```