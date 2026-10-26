import { Platform } from 'react-native';

type DeviceModule = typeof import('expo-device');

/** Resolved lazily, like biometrics.ts: a build without the native module must not break every request that sends these headers. */
function loadDevice(): DeviceModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-device') as DeviceModule;
  } catch {
    return null;
  }
}

let cached: { name: string | undefined; platform: string } | null = null;

/** What the Security screen shows for this phone ("Pixel 8", not "Unknown device"). Sent to the API as headers; computed once. */
export function deviceHeaders(): { name: string | undefined; platform: string } {
  if (cached) return cached;
  const device = loadDevice();
  const model = device?.modelName?.trim();
  const brand = device?.brand?.trim();
  const name = model ? (brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model) : device?.deviceName?.trim() || undefined;
  cached = { name, platform: Platform.OS };
  return cached;
}
