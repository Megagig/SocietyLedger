import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AjoGate, useAjoWrite } from './AjoGate';

// The gate decides what a person sees before any Ajo screen: loading, locked, not allowed, or the screen (with a read-only banner when lapsed).
const mockStatus = jest.fn();
jest.mock('../queries', () => ({ useAjoStatus: () => mockStatus() }));
jest.mock('@/components/feedback/AccessState', () => {
  const { Text: T } = jest.requireActual('react-native');
  return { AccessState: ({ kind }: { kind: string }) => <T>{`access:${kind}`}</T> };
});
jest.mock('@/components/feedback/ErrorState', () => {
  const { Text: T } = jest.requireActual('react-native');
  return { ErrorState: () => <T>error</T> };
});
jest.mock('./AjoStates', () => {
  const { Text: T } = jest.requireActual('react-native');
  return { AjoLoading: () => <T>loading</T>, AjoReadOnlyBanner: () => <T>read-only</T> };
});

const ok = (readOnly: boolean) => ({ isPending: false, isError: false, data: { kind: 'ok', status: { readOnly } } });

describe('AjoGate', () => {
  it('shows a loading state first', async () => {
    mockStatus.mockReturnValue({ isPending: true });
    await render(<AjoGate><Text>body</Text></AjoGate>);
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByText('body')).toBeNull();
  });

  it('says the add-on is missing, without offering a purchase', async () => {
    mockStatus.mockReturnValue({ isPending: false, isError: false, data: { kind: 'locked' }, refetch: jest.fn() });
    await render(<AjoGate><Text>body</Text></AjoGate>);
    expect(screen.getByText('access:plan')).toBeTruthy();
    expect(screen.queryByText('body')).toBeNull();
  });

  it('says when the person has no Ajo permission', async () => {
    mockStatus.mockReturnValue({ isPending: false, isError: false, data: { kind: 'forbidden' } });
    await render(<AjoGate><Text>body</Text></AjoGate>);
    expect(screen.getByText('access:permission')).toBeTruthy();
  });

  it('shows the screen, and a read-only banner when the add-on has lapsed', async () => {
    mockStatus.mockReturnValue(ok(true));
    await render(<AjoGate><Text>body</Text></AjoGate>);
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByText('read-only')).toBeTruthy();
  });

  it('shows no banner when writes are allowed', async () => {
    mockStatus.mockReturnValue(ok(false));
    await render(<AjoGate><Text>body</Text></AjoGate>);
    expect(screen.queryByText('read-only')).toBeNull();
  });
});

describe('useAjoWrite', () => {
  function Probe() {
    const { canWrite, readOnly } = useAjoWrite();
    return <Text>{`write:${canWrite} readOnly:${readOnly}`}</Text>;
  }
  it('turns writes off when the add-on is read-only', async () => {
    mockStatus.mockReturnValue(ok(true));
    await render(<Probe />);
    expect(screen.getByText('write:false readOnly:true')).toBeTruthy();
  });
  it('leaves writes on while the status is still loading', async () => {
    mockStatus.mockReturnValue({ isPending: true });
    await render(<Probe />);
    expect(screen.getByText('write:true readOnly:false')).toBeTruthy();
  });
});
