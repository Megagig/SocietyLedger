import { View } from 'react-native';

import { useAppState } from '@/hooks/useAppState';
import { usePrefsStore } from '@/stores/prefs';

/**
 * architecture.md §7.5 — "Lock screen hides content (blur) in the app switcher via AppState +
 * privacy overlay." A plain opaque `bg-bg` cover (not an actual blur view — no blur library is
 * installed, and a solid cover hides content from the OS app-switcher snapshot exactly as well
 * as a blur would) rendered whenever the app isn't foregrounded. Scoped to `biometricsEnabled`
 * only, matching this rule's placement under App Lock, not a universal behaviour.
 */
export function PrivacyOverlay() {
  const appState = useAppState();
  const biometricsEnabled = usePrefsStore((state) => state.biometricsEnabled);

  if (!biometricsEnabled || appState === 'active') return null;

  return <View pointerEvents="none" className="absolute inset-0 bg-bg" />;
}
