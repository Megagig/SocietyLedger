import { fireEvent, render, screen } from '@testing-library/react-native';

import { TabBar } from './TabBar';

// The real ThemeProvider reads MMKV (native, unavailable under Jest) — only the colour tokens matter here.
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: { primary: '#000', textSecondary: '#666' } }),
}));

async function setup(focusedIndex: number) {
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const navigateToTab = jest.fn();
  const routes = [
    { key: 'home-key', name: 'home' },
    { key: 'community-key', name: 'community' },
  ];
  const descriptors = Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name } }]));

  await render(
    <TabBar
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fake of the navigator's props
      {...({ state: { index: focusedIndex, routes }, descriptors, emitter: { emit }, navigateToTab, insets: { bottom: 0 } } as any)}
    />,
  );
  return { emit, navigateToTab };
}

describe('TabBar', () => {
  it('emits tabPress but does not navigate when the focused tab is pressed (lets its nested stack pop to top)', async () => {
    const { emit, navigateToTab } = await setup(1);

    fireEvent.press(screen.getByLabelText('community'));

    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'community-key', canPreventDefault: true });
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('emits tabPress and navigates when another tab is pressed', async () => {
    const { emit, navigateToTab } = await setup(1);

    fireEvent.press(screen.getByLabelText('home'));

    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'home-key', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith('home-key');
  });

  it('does not navigate when a tabPress listener prevents the default', async () => {
    const { emit, navigateToTab } = await setup(1);
    emit.mockReturnValueOnce({ defaultPrevented: true });

    fireEvent.press(screen.getByLabelText('home'));

    expect(navigateToTab).not.toHaveBeenCalled();
  });
});
