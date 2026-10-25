import { Stack } from 'expo-router';

// architecture.md §4 — unauthenticated stack. `(app)/_layout.tsx` is the only guard that redirects
// here; this layout has nothing of its own to gate. Every screen architecture.md's `(auth)`
// table lists is now real except `create-association` (A13, Mobile Phase 8 — nothing links to it
// yet). `reset-password`/`accept-invite` are reached only via `app/+native-intent.tsx`'s deep-link
// rewrite (F2.3), not by in-app navigation.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
