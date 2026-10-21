import { Stack } from 'expo-router';

/** Explicit Stack for the Money tab — required in Expo Router SDK 58 when a tab directory
 * contains nested subdirectories (ledger/, transaction/, donations/). Without this, the
 * implicit Stack does not reliably register sub-routes after the routing table is rebuilt. */
export default function MoneyLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
