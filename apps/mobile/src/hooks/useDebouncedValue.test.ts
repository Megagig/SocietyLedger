import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the initial value immediately', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('only updates after the delay elapses with no further changes', async () => {
    const { result, rerender } = await renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    await rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    await act(async () => jest.advanceTimersByTime(200));
    await rerender({ value: 'abc' });
    expect(result.current).toBe('a');

    await act(async () => jest.advanceTimersByTime(300));
    expect(result.current).toBe('abc');
  });
});
