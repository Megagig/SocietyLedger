jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));

import Constants from 'expo-constants';

import { appVersion, appVersionLabel } from './appVersion';

// The mocked module's default export, which the tests change from case to case.
const mockConstants = Constants as unknown as { expoConfig?: { version?: unknown } | null; nativeBuildVersion?: unknown };

beforeEach(() => {
  mockConstants.expoConfig = { version: '1.4.2' };
  mockConstants.nativeBuildVersion = '37';
});

describe('appVersion', () => {
  it('reads the version set in app.config.ts and the installed build number', () => {
    expect(appVersion()).toEqual({ version: '1.4.2', build: '37' });
  });

  it('has no build number in Expo Go, on the web, or on a development server', () => {
    mockConstants.nativeBuildVersion = null;
    expect(appVersion()).toEqual({ version: '1.4.2', build: null });
  });

  it('treats a missing or blank value as not available, never as a made-up number', () => {
    mockConstants.expoConfig = null;
    mockConstants.nativeBuildVersion = '  ';
    expect(appVersion()).toEqual({ version: null, build: null });
    mockConstants.expoConfig = { version: 42 }; // not text
    expect(appVersion().version).toBeNull();
  });
});

describe('appVersionLabel', () => {
  it('says the version and the build', () => {
    expect(appVersionLabel()).toBe('1.4.2 (build 37)');
  });

  it('says only the version when there is no build number', () => {
    mockConstants.nativeBuildVersion = undefined;
    expect(appVersionLabel()).toBe('1.4.2');
  });

  it('is null when the version cannot be read, so the screen can say so instead of showing a wrong number', () => {
    mockConstants.expoConfig = undefined;
    expect(appVersionLabel()).toBeNull();
  });
});
