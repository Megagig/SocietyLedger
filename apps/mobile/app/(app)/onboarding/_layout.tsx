import { Stack } from 'expo-router';

// Phase 8 — the setup wizard a new association's admin walks through (project-overview.md §6.2, O1–O5). `(app)/_layout.tsx` sends an
// admin whose setup is pending here; each step can be finished or skipped, and the wizard resumes where it was left.
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
