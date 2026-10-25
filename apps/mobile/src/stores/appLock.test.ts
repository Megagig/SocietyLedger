import { useAppLockStore } from './appLock';

describe('useAppLockStore', () => {
  it('starts locked', () => {
    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it('unlock() clears the flag', () => {
    useAppLockStore.getState().unlock();
    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it('lock() sets it again', () => {
    useAppLockStore.getState().unlock();
    useAppLockStore.getState().lock();
    expect(useAppLockStore.getState().isLocked).toBe(true);
  });
});
