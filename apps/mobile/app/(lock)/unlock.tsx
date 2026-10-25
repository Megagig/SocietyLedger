import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/layout/Screen';
import { useLogout } from '@/features/session/mutations';
import { authenticateWithDevice } from '@/lib/biometrics';
import { t } from '@/lib/i18n';
import { useAppLockStore } from '@/stores/appLock';
import { useThemeTokens } from '@/providers/ThemeProvider';

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

  async function attemptUnlock() {
    setAttempting(true);
    const result = await authenticateWithDevice(t('auth.unlock.promptMessage'), t('common.cancel'));
    setAttempting(false);
    if (result.success) unlock();
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
