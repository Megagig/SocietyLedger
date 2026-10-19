import type { ConfigContext, ExpoConfig } from 'expo/config';

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
        backgroundColor: '#0A4842',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
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
    },
    android: {
      package: identity.bundleId,
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
        backgroundColor: '#0A4842',
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
