import { Stack } from 'expo-router';

/** Explicit Stack for the Circle tab (a standalone rotating pot's board), same SDK 58 requirement as the Money and Community tabs. */
export default function CircleLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
