import type { ConfigContext, ExpoConfig } from 'expo/config';

// Review finding (Phase 1 retro): tried importing `tokens.ts`'s `passbook` value here instead of
// repeating the hex, since native splash/adaptive-icon `backgroundColor` can't reference a CSS
// variable. Reverted — Expo's config loader (`@expo/require-utils`) only transpiles this one
// file, not its transitive local imports, and fails with "Cannot find module './src/theme/tokens'"
// (confirmed by actually running `expo export`, not assumed). A plain literal, kept in sync by
// this comment, is the only thing that works here.
// Brand colours from the SocietyLedger brand kit (SocietyLedger-brand/README.md): slate splash in
// dark mode, white in light mode, brand blue behind the Android adaptive icon and notification tint.
const SPLASH_BACKGROUND_COLOR = '#0F172A';
const SPLASH_LIGHT_BACKGROUND_COLOR = '#FFFFFF';
const BRAND_BLUE = '#0B6BFF';

type AppVariant = 'development' | 'preview' | 'production';

// The EAS project id is not a secret (it is also in eas.json). A default lets `eas` commands run on a
// developer machine, where the build profile's env is not set; builds still pass it explicitly.
const DEFAULT_EAS_PROJECT_ID = '7deffb9f-b682-45c7-b773-b919a4d8f28b';

const APP_VARIANT = (process.env.APP_VARIANT as AppVariant | undefined) ?? 'development';

const IDENTITY: Record<AppVariant, { name: string; bundleId: string; scheme: string }> = {
  development: {
    name: 'SocietyLedger (Dev)',
    bundleId: 'ng.com.societyledger.app.dev',
    scheme: 'societyledger-dev',
  },
  preview: {
    name: 'SocietyLedger (Preview)',
    bundleId: 'ng.com.societyledger.app.preview',
    scheme: 'societyledger-preview',
  },
  production: {
    name: 'SocietyLedger',
    bundleId: 'ng.com.societyledger.app',
    scheme: 'societyledger',
  },
};

/**
 * `eas build` never reads apps/mobile/.env.local, so a build made on EAS without EXPO_PUBLIC_API_URL
 * falls back to http://localhost:4001 and cannot reach any server. Fail the production build early
 * instead of shipping that, and warn on the others. (Android release builds also block plain http.)
 */
function checkApiUrl(): void {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const problem = !apiUrl
    ? 'EXPO_PUBLIC_API_URL is not set, so the app would call http://localhost:4001.'
    : APP_VARIANT !== 'development' && !apiUrl.startsWith('https://')
      ? `EXPO_PUBLIC_API_URL (${apiUrl}) is not https, and Android release builds block plain http.`
      : null;
  if (!problem) return;
  const hint = 'Set it in the build profile env in eas.json, or with "eas env:create".';
  if (APP_VARIANT === 'production') throw new Error(`${problem} ${hint}`);
  if (APP_VARIANT === 'preview') console.warn(`[app.config] ${problem} ${hint}`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  checkApiUrl();
  const identity = IDENTITY[APP_VARIANT];
  const easProjectId = process.env.EAS_PROJECT_ID ?? DEFAULT_EAS_PROJECT_ID;
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: SPLASH_LIGHT_BACKGROUND_COLOR,
        image: './assets/images/splash-icon-light.png',
        imageWidth: 280,
        resizeMode: 'contain',
        dark: {
          backgroundColor: SPLASH_BACKGROUND_COLOR,
          image: './assets/images/splash-icon.png',
        },
      },
    ],
    [
      'expo-notifications',
      {
        // Android status-bar icon: white-on-transparent mark, tinted with the brand blue.
        icon: './assets/images/notification-icon.png',
        color: BRAND_BLUE,
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-web-browser',
    'expo-sharing',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow SocietyLedger to access your photos to attach a payment receipt.',
        cameraPermission: 'Allow SocietyLedger to use your camera to take a photo of a payment receipt.',
      },
    ],
  ];

  // Native code is compiled once per CPU type, and an unrestricted APK carries all four (arm64, armv7,
  // x86, x86_64): the first preview build came out at 283 MB. Real phones are arm64.
  //  - preview: arm64 only, with native libraries compressed inside the APK (smaller download).
  //  - production: the app bundle for Play is split per device by the store, so keep the two ARM types
  //    (arm64 for current phones, armv7 for older 32-bit ones) and drop x86 (emulators only).
  //  - development: untouched, so emulators keep working.
  if (APP_VARIANT !== 'development') {
    plugins.push([
      'expo-build-properties',
      {
        android: {
          buildArchs: APP_VARIANT === 'production' ? ['arm64-v8a', 'armeabi-v7a'] : ['arm64-v8a'],
          useLegacyPackaging: APP_VARIANT === 'preview',
        },
      },
    ]);
  }

  if (sentryDsn) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ]);
  }

  return {
    ...config,
    name: identity.name,
    slug: 'societyledger',
    scheme: identity.scheme,
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/images/icon.png',
    ios: {
      bundleIdentifier: identity.bundleId,
      supportsTablet: false,
      infoPlist: {
        // library-docs.md's expo-local-authentication note — this package ships no config
        // plugin of its own (confirmed: no app.plugin.js in the installed package, unlike
        // expo-image-picker's plugins-array entry below), so the usage string goes directly
        // into Info.plist via this field instead.
        NSFaceIDUsageDescription: 'Allow SocietyLedger to use Face ID to unlock the app and confirm sensitive actions.',
      },
    },
    android: {
      package: identity.bundleId,
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
        backgroundColor: BRAND_BLUE,
      },
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: easProjectId ? { projectId: easProjectId } : undefined,
    },
    updates: {
      url: easProjectId ? `https://u.expo.dev/${easProjectId}` : undefined,
    },
    runtimeVersion: {
      policy: 'fingerprint',
    },
  };
};
