import Constants from 'expo-constants';

/**
 * The version of the app, as the person should see it.
 *
 * `version` is the number set in `app.config.ts` (the one you edit when you cut a release). `build` is the number of the installed app itself
 * (iOS build number / Android version code): EAS raises it on every production build (eas.json `autoIncrement`), so it tells two builds of the
 * same version apart. It is absent in Expo Go, on the web, and in a development server, and the label simply leaves it out then.
 */
export type AppVersion = { version: string | null; build: string | null };

const clean = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

export function appVersion(): AppVersion {
  return {
    version: clean(Constants.expoConfig?.version),
    build: clean(Constants.nativeBuildVersion),
  };
}

/** "1.0.0 (build 12)", "1.0.0" when there is no build number, or null when the version cannot be read. Never invents a number. */
export function appVersionLabel({ version, build }: AppVersion = appVersion()): string | null {
  if (!version) return null;
  return build ? `${version} (build ${build})` : version;
}
