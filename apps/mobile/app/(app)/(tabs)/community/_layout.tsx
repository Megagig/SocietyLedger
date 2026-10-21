import { Stack } from 'expo-router';

/** Explicit Stack for the Community tab — same SDK 58 requirement as `money/_layout.tsx`: a tab
 * directory with nested subdirectories (meetings/, elections/, polls/, welfare/) needs its own
 * navigator, otherwise sub-route taps fall through to the tab navigator's initial route (Home). */
export default function CommunityLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
