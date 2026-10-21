jest.mock('@/lib/storage', () => {
  const map = new Map<string, string>();
  return {
    storage: {
      getString: (key: string) => map.get(key),
      set: (key: string, value: string) => map.set(key, String(value)),
      remove: (key: string) => map.delete(key),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock call above
const { usePrefsStore, DEFAULT_AUTO_LOCK_MINUTES } = require('./prefs');

describe('usePrefsStore', () => {
  it('defaults to biometrics off, the default auto-lock timeout, prompt not yet seen, and balance visible', () => {
    const state = usePrefsStore.getState();
    expect(state.biometricsEnabled).toBe(false);
    expect(state.autoLockMinutes).toBe(DEFAULT_AUTO_LOCK_MINUTES);
    expect(state.hasSeenBiometricPrompt).toBe(false);
    expect(state.balanceHidden).toBe(false);
  });

  it('setBiometricsEnabled updates the flag', () => {
    usePrefsStore.getState().setBiometricsEnabled(true);
    expect(usePrefsStore.getState().biometricsEnabled).toBe(true);
  });

  it('setAutoLockMinutes updates the timeout', () => {
    usePrefsStore.getState().setAutoLockMinutes(10);
    expect(usePrefsStore.getState().autoLockMinutes).toBe(10);
  });

  it('markBiometricPromptSeen flips the flag once', () => {
    usePrefsStore.getState().markBiometricPromptSeen();
    expect(usePrefsStore.getState().hasSeenBiometricPrompt).toBe(true);
  });

  it('toggleBalanceHidden flips back and forth', () => {
    const initial = usePrefsStore.getState().balanceHidden;
    usePrefsStore.getState().toggleBalanceHidden();
    expect(usePrefsStore.getState().balanceHidden).toBe(!initial);
    usePrefsStore.getState().toggleBalanceHidden();
    expect(usePrefsStore.getState().balanceHidden).toBe(initial);
  });
});
