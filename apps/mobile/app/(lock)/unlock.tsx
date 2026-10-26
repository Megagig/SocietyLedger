import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/layout/Screen';
import { useLogout } from '@/features/session/mutations';
import { authenticateWithDevice } from '@/lib/biometrics';
import { t } from '@/lib/i18n';
import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** Errors that will never succeed on this device as it is now configured. */
const DEVICE_CANNOT_CHECK = new Set(['not_enrolled', 'passcode_not_set', 'not_available']);
const USER_CANCELLED = new Set(['user_cancel', 'app_cancel', 'system_cancel']);

/** Android cancels a biometric prompt that opens before the app is in the foreground, and the lock screen opens on cold start.
 * Waits only while the app is known to be in the background, and never longer than a couple of seconds, so it cannot hang the screen. */
function waitUntilForeground(): Promise<void> {
  const state = AppState.currentState;
  if (state !== 'background' && state !== 'inactive') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      subscription.remove();
      resolve();
    };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') done();
    });
    const timer = setTimeout(done, 2000);
  });
}

/**
 * A14 — shown by `(app)/_layout.tsx`'s guard on cold start / after `autoLockMinutes` in
 * background (architecture.md §7.5). Prompts immediately on mount, with "Unlock" as a manual
 * retry for a dismissed/failed first attempt. "Sign out" is a full logout (not just a lock
 * bypass) — matches A14's own spec ("Unlock · Sign out").
 */
export default function UnlockScreen() {
  const { color } = useThemeTokens();
  const unlock = useAppLockStore((state) => state.unlock);
  const logout = useLogout();
  const [attempting, setAttempting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function attemptUnlock() {
    setAttempting(true);
    setFailure(null);
    await waitUntilForeground();
    const result = await authenticateWithDevice(t('auth.unlock.promptMessage'), t('common.cancel'));
    setAttempting(false);
    if (result.success) {
      unlock();
      return;
    }
    if (result.error && DEVICE_CANNOT_CHECK.has(result.error)) {
      // Nothing on this phone can answer the prompt (the screen lock or fingerprints were removed, or the module is missing), so
      // keeping the lock would shut the person out for good. Turn it off and let them in; Security can switch it back on.
      usePrefsStore.getState().setBiometricsEnabled(false);
      unlock();
      toast.error(t('auth.unlock.lockTurnedOff'));
      return;
    }
    // A plain cancel is not worth an error; anything else shows its code so the cause can be found.
    if (result.error && !USER_CANCELLED.has(result.error)) setFailure(result.error);
  }

  useEffect(() => {
    // Prompting biometrics (and tracking its own loading state) once on mount is the whole
    // point of this effect — there's no external system to merely "synchronize" with here.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate mount-time prompt, not a synchronization effect
    attemptUnlock();
    // Only on mount — subsequent attempts are the user tapping "Unlock" again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    logout.mutate(undefined, { onSuccess: () => router.replace('/(auth)/association') });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-primary-soft">
          <Fingerprint size={48} color={color.primary} strokeWidth={1.5} />
        </View>
        <Text variant="h2" align="center">
          {t('auth.unlock.title')}
        </Text>
        {failure ? (
          <Text variant="body" tone="secondary" align="center" testID="unlock-failure">
            {t('auth.unlock.failed', { code: failure })}
          </Text>
        ) : null}
        <Button variant="gradient" size="lg" fullWidth loading={attempting} onPress={attemptUnlock} testID="unlock-try-again">
          {t('auth.unlock.tryAgain')}
        </Button>
      </View>
      <View className="px-4 pb-4">
        <Button variant="accent-ghost" size="lg" fullWidth loading={logout.isPending} onPress={signOut} testID="unlock-sign-out">
          {t('auth.unlock.signOut')}
        </Button>
      </View>
    </Screen>
  );
}
