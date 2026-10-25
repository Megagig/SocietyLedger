import { Stack } from 'expo-router';

// architecture.md §7.5 — app-lock stack. `gestureEnabled: false` — swiping back must never
// dismiss the lock screen (there's nothing behind it to reveal either way; `(app)/_layout.tsx`'s
// guard is what redirects here).
export default function LockLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
