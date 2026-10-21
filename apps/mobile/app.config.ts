import type { ConfigContext, ExpoConfig } from 'expo/config';

// Review finding (Phase 1 retro): tried importing `tokens.ts`'s `passbook` value here instead of
// repeating the hex, since native splash/adaptive-icon `backgroundColor` can't reference a CSS
// variable. Reverted — Expo's config loader (`@expo/require-utils`) only transpiles this one
// file, not its transitive local imports, and fails with "Cannot find module './src/theme/tokens'"
// (confirmed by actually running `expo export`, not assumed). A plain literal, kept in sync by
// this comment, is the only thing that works here.
// Keep equal to `tokens.light.color.passbook` / `--color-passbook` in src/theme/global.css.
const SPLASH_BACKGROUND_COLOR = '#0A4842';

type AppVariant = 'development' | 'preview' | 'production';

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

export default ({ config }: ConfigContext): ExpoConfig => {
  const identity = IDENTITY[APP_VARIANT];
  const easProjectId = process.env.EAS_PROJECT_ID;
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: SPLASH_BACKGROUND_COLOR,
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-web-browser',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow SocietyLedger to access your photos to attach a payment receipt.',
        cameraPermission: 'Allow SocietyLedger to use your camera to take a photo of a payment receipt.',
      },
    ],
  ];

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
        backgroundColor: SPLASH_BACKGROUND_COLOR,
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
