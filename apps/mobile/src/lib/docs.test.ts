import * as WebBrowser from 'expo-web-browser';

import { docsUrl, getDocsPathForScreen, openDocs, openUserManual } from './docs';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

// `EXPO_PUBLIC_DOCS_URL` is inlined by babel-preset-expo at transform time from `.env*` —
// assertions check the path/query shape, not a hardcoded base URL, so they hold regardless of
// which base URL this environment inlines (nothing sets the var in `.env.local` here, so it
// falls back to the production docs URL — but that's an environment fact, not this module's contract).
describe('docsUrl', () => {
  it('builds a URL ending in the given path with the mobile UTM tags', () => {
    expect(docsUrl('/docs/member-guide/what-you-owe')).toMatch(
      /\/docs\/member-guide\/what-you-owe\?utm_source=mobile&utm_medium=mobile$/,
    );
  });

  it('defaults to the docs home when no path is given', () => {
    expect(docsUrl()).toMatch(/\/docs\?utm_source=mobile&utm_medium=mobile$/);
  });

  it('honours a custom surface tag', () => {
    expect(docsUrl('/docs', 'notification')).toContain('utm_medium=notification');
  });

  it('normalises a path without a leading slash', () => {
    expect(docsUrl('docs')).toMatch(/\/docs\?/);
  });
});

describe('getDocsPathForScreen', () => {
  it('resolves a real mobile screen ID', () => {
    expect(getDocsPathForScreen('H2')).toBe('/docs/reports/association-dashboard');
  });

  it('returns undefined for an unmapped screen ID', () => {
    expect(getDocsPathForScreen('NOT_A_REAL_SCREEN')).toBeUndefined();
  });
});

describe('openDocs', () => {
  afterEach(() => jest.clearAllMocks());

  it('opens the in-app browser for a mapped, non-plan-billing screen', async () => {
    const opened = await openDocs('H2');
    expect(opened).toBe(true);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining('/docs/reports/association-dashboard'));
  });

  it('never opens a plan-billing docs page from mobile (rule #16)', async () => {
    const opened = await openDocs('/dashboard/subscription');
    expect(opened).toBe(false);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('no-ops for an unmapped screen ID', async () => {
    const opened = await openDocs('NOT_A_REAL_SCREEN');
    expect(opened).toBe(false);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});

describe('cooperatives screens and the user manual', () => {
  afterEach(() => jest.clearAllMocks());

  it('maps the member cooperatives screens to their docs pages', () => {
    expect(getDocsPathForScreen('M15')).toBe('/docs/cooperatives/depositing-into-your-savings');
    expect(getDocsPathForScreen('M16')).toBe('/docs/cooperatives/depositing-into-your-savings');
    expect(getDocsPathForScreen('M17')).toBe('/docs/cooperatives/paying-your-loan');
    expect(getDocsPathForScreen('M18')).toBe('/docs/cooperatives/paying-your-loan');
    expect(getDocsPathForScreen('M19')).toBe('/docs/cooperatives/applying-for-a-loan');
    expect(getDocsPathForScreen('M20')).toBe('/docs/cooperatives/guarantors');
  });

  it('opens the docs home in the in-app browser for the user manual', async () => {
    await openUserManual('profile');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/\/docs\?utm_source=mobile&utm_medium=profile$/));
  });
});
