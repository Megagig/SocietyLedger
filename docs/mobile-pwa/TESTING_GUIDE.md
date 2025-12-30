# PWA Testing Guide

## Prerequisites

1. Build the application: `npm run build`
2. Serve with HTTPS (required for service workers in production)
3. Use Chrome DevTools for PWA debugging

## Testing Checklist

### 1. PWA Installation

#### Desktop (Chrome)
- [ ] Visit the app in Chrome
- [ ] Look for install icon in address bar
- [ ] Click install and verify app opens in standalone window
- [ ] Check app appears in system applications

#### Mobile (Android Chrome)
- [ ] Visit the app on mobile
- [ ] Wait for install banner or use "Add to Home Screen"
- [ ] Verify app icon on home screen
- [ ] Open app and verify standalone mode (no browser UI)

#### iOS Safari
- [ ] Visit the app in Safari
- [ ] Tap Share → "Add to Home Screen"
- [ ] Verify app icon and splash screen
- [ ] Open app and verify standalone mode

### 2. Service Worker

#### Registration
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs));
```
- [ ] Service worker is registered
- [ ] Scope is correct (`/`)
- [ ] Status is "activated"

#### Caching
- [ ] Open DevTools → Application → Cache Storage
- [ ] Verify caches exist: `societyledger-static-v1`, `societyledger-dynamic-v1`
- [ ] Check cached assets include manifest, icons, main pages

### 3. Offline Mode

#### Testing Steps
1. Load the app while online
2. Navigate to a few pages (to cache them)
3. Open DevTools → Network → Check "Offline"
4. Refresh the page

#### Expected Behavior
- [ ] Cached pages load correctly
- [ ] Offline indicator appears at top
- [ ] Uncached pages show offline fallback
- [ ] API requests show offline error message

#### Reconnection
1. Uncheck "Offline" in DevTools
2. Verify:
- [ ] "Back online!" message appears
- [ ] Pending sync option shows if applicable
- [ ] App resumes normal operation

### 4. Mobile Components

#### Bottom Navigation
- [ ] Visible only on mobile (< 1024px)
- [ ] All nav items work correctly
- [ ] Active state shows on current page
- [ ] Menu button opens sidebar

#### Install Prompt
- [ ] Appears on installable browsers
- [ ] "Install" button triggers native prompt
- [ ] "Not now" dismisses for 7 days
- [ ] Doesn't appear after installation

#### Update Prompt
- [ ] Appears when new service worker is available
- [ ] "Update now" reloads with new version

#### Offline Indicator
- [ ] Shows when offline
- [ ] Shows "Back online!" when reconnected
- [ ] Auto-hides after 3 seconds

### 5. Push Notifications (if implemented)

#### Permission Request
```javascript
// In browser console
Notification.requestPermission().then(p => console.log(p));
```
- [ ] Permission prompt appears
- [ ] Granted/denied state is saved

#### Receiving Notifications
- [ ] Test notification appears
- [ ] Click opens correct URL
- [ ] Badge/icon display correctly

### 6. Lighthouse Audit

Run Lighthouse PWA audit in Chrome DevTools:

1. Open DevTools → Lighthouse
2. Select "Progressive Web App" category
3. Run audit

#### Target Scores
- [ ] PWA score: 90+
- [ ] Installable: Yes
- [ ] PWA Optimized: All checks pass

### 7. Responsive Design

Test on various screen sizes:

#### Mobile Portrait (375x667)
- [ ] Bottom nav visible
- [ ] Content readable
- [ ] Touch targets adequate (44x44px min)

#### Mobile Landscape (667x375)
- [ ] Layout adjusts correctly
- [ ] No horizontal scroll

#### Tablet (768x1024)
- [ ] Sidebar may be visible
- [ ] Bottom nav hidden on larger tablets

#### Desktop (1440x900)
- [ ] Sidebar visible
- [ ] Bottom nav hidden
- [ ] Full layout displayed

### 8. Performance

#### Metrics to Check
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 5s
- [ ] Largest Contentful Paint < 2.5s

#### Tools
- Chrome DevTools Performance tab
- Lighthouse Performance audit
- WebPageTest.org

## Common Issues & Solutions

### Service Worker Not Updating
```javascript
// Force update in console
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.update());
});
```

### Cache Not Clearing
```javascript
// Clear all caches
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

### Install Prompt Not Showing
- Ensure HTTPS (or localhost)
- Check manifest is valid
- Verify service worker is registered
- Clear site data and retry

### iOS Issues
- PWA features are limited on iOS
- No push notifications
- Service worker may be evicted after 7 days of inactivity

## Debug Commands

```javascript
// Check PWA install state
window.matchMedia('(display-mode: standalone)').matches

// Check online status
navigator.onLine

// Get service worker registration
navigator.serviceWorker.ready.then(reg => console.log(reg))

// Check notification permission
Notification.permission

// List all caches
caches.keys().then(console.log)
```

## Reporting Issues

When reporting PWA issues, include:
1. Browser and version
2. Device/OS
3. Console errors
4. Network tab screenshots
5. Service worker status
6. Steps to reproduce
