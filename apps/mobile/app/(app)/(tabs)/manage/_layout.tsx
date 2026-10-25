import { Stack } from 'expo-router';

/** Explicit Stack for the Manage tab — required in Expo Router SDK 58 once a tab directory contains nested
 * subdirectories (support/ now; more officer sections follow). Same reason as `money/_layout.tsx`. */
export default function ManageLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
