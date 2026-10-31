import { render, screen } from '@testing-library/react-native';

import AboutScreen from './about';

// The version comes from the app's own config, which the test sets case by case.
const mockVersion: { version: string | null; build: string | null } = { version: '1.4.2', build: '37' };
jest.mock('@/lib/appVersion', () => ({
  appVersion: () => mockVersion,
  appVersionLabel: () => (mockVersion.version ? (mockVersion.build ? `${mockVersion.version} (build ${mockVersion.build})` : mockVersion.version) : null),
}));

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('lucide-react-native', () => ({ ExternalLink: () => null }));
jest.mock('@/providers/ThemeProvider', () => ({ useThemeTokens: () => ({ color: { textTertiary: '#000000' } }) }));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/ListItem', () => ({ ListGroup: ({ children }: { children: React.ReactNode }) => children, ListItem: () => null }));

describe('About screen', () => {
  beforeEach(() => {
    mockVersion.version = '1.4.2';
    mockVersion.build = '37';
  });

  it('shows the version set in the code, with the build number of the installed app', async () => {
    await render(<AboutScreen />);
    expect(screen.getByTestId('about-version').props.children).toBe('Version 1.4.2 (build 37)');
  });

  it('shows just the version when there is no build number (Expo Go, development)', async () => {
    mockVersion.build = null;
    await render(<AboutScreen />);
    expect(screen.getByTestId('about-version').props.children).toBe('Version 1.4.2');
  });

  it('says the version is not available instead of showing a made-up number', async () => {
    mockVersion.version = null;
    mockVersion.build = null;
    await render(<AboutScreen />);
    expect(screen.getByTestId('about-version').props.children).toBe('Version not available');
  });
});
