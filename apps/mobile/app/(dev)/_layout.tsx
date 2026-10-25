import { Redirect, Slot } from 'expo-router';

// build-plan.md F1.4 — dev-only, excluded from production builds. Files still exist in the
// bundle (Metro has no "drop this route" primitive), but are unreachable once `__DEV__` is
// false, which is what matters in practice.
export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
