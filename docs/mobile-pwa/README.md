# Mobile/PWA Implementation - Phase 13.5

## Overview

SocietyLedger is now a Progressive Web App (PWA) with full mobile support, offline capabilities, and native-like features.

## Features Implemented

### 1. PWA Core
- **Web App Manifest** (`public/manifest.json`) - App metadata, icons, shortcuts, theme colors
- **Service Worker** (`public/sw.js`) - Caching strategies, offline support, push notifications
- **Offline Page** (`public/offline.html`) - Fallback page when offline

### 2. Mobile Components
- **BottomNav** - Mobile-optimized bottom navigation bar
- **InstallPrompt** - PWA install banner with dismiss/install options
- **UpdatePrompt** - New version available notification
- **OfflineIndicator** - Online/offline status indicator
- **PullToRefresh** - Pull-to-refresh wrapper component

### 3. PWA Hooks (`src/hooks/usePWA.ts`)
- `usePWA()` - Install prompt, update detection, online/offline status
- `usePushNotifications()` - Push notification permission and subscription
- `useOfflineSync()` - Offline data sync with IndexedDB

### 4. Caching Strategies
- **Network First** - API requests (fresh data with cache fallback)
- **Cache First** - Static assets (images, fonts, CSS, JS)
- **Stale While Revalidate** - Dynamic content
- **Offline Fallback** - HTML pages with offline page fallback

## File Structure

```
apps/web/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── offline.html           # Offline fallback page
│   └── icons/                 # App icons (need to be added)
│       ├── icon-72x72.png
│       ├── icon-96x96.png
│       ├── icon-128x128.png
│       ├── icon-144x144.png
│       ├── icon-152x152.png
│       ├── icon-192x192.png
│       ├── icon-384x384.png
│       └── icon-512x512.png
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Updated with PWA meta tags
│   │   └── globals.css        # Mobile-specific CSS utilities
│   ├── components/
│   │   ├── layout/
│   │   │   └── AuthenticatedLayout.tsx  # Integrated mobile components
│   │   └── mobile/
│   │       ├── index.ts
│   │       ├── BottomNav.tsx
│   │       ├── InstallPrompt.tsx
│   │       ├── UpdatePrompt.tsx
│   │       ├── OfflineIndicator.tsx
│   │       └── PullToRefresh.tsx
│   └── hooks/
│       └── usePWA.ts          # PWA hooks
└── next.config.js             # PWA headers configuration
```

## Usage

### Install Prompt
The install prompt automatically appears when the app is installable. Users can:
- Click "Install" to add to home screen
- Click "Not now" to dismiss (shows again after 7 days)

### Offline Support
When offline:
- Cached pages remain accessible
- API requests return cached data or offline error
- Offline indicator shows at the top
- Pending requests are queued for sync

### Push Notifications
```typescript
import { usePushNotifications } from '@/hooks/usePWA';

function MyComponent() {
  const { permission, requestPermission, subscribe } = usePushNotifications();
  
  const enableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      const subscription = await subscribe(VAPID_PUBLIC_KEY);
      // Send subscription to server
    }
  };
}
```

### Pull to Refresh
```typescript
import { PullToRefresh } from '@/components/mobile';

function MyPage() {
  const handleRefresh = async () => {
    await fetchData();
  };
  
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <YourContent />
    </PullToRefresh>
  );
}
```

## CSS Utilities

```css
/* Safe area padding for iOS */
.pb-safe    /* Bottom safe area */
.pt-safe    /* Top safe area */
.px-safe    /* Left/right safe area */

/* Bottom navigation spacing */
.mb-bottom-nav  /* Margin for bottom nav (auto-removed on desktop) */

/* Touch-friendly targets */
.touch-target   /* Min 44x44px */

/* Animations */
.animate-slide-up
.animate-slide-down
.animate-spin-slow
```

## Icon Requirements

Create icons in the following sizes for full PWA support:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Icons should be:
- PNG format with transparency
- Square aspect ratio
- Include safe zone for maskable icons (inner 80%)

## Browser Support

- Chrome/Edge 79+
- Firefox 44+
- Safari 11.1+ (limited PWA support)
- Samsung Internet 4+

## Known Limitations

1. iOS Safari has limited PWA support:
   - No push notifications
   - No background sync
   - Limited service worker caching

2. Service worker updates require page reload

3. Offline mode requires initial visit while online to cache assets
