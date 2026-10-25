import { router, useLocalSearchParams } from 'expo-router';
import { Hourglass } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { SupportCard } from '@/components/feedback/SupportCard';
import { AuthHeroScreen } from '@/components/layout/AuthHeroScreen';
import { t } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

/** A10 — "Check again" doesn't re-attempt login itself (no password is kept around once Login's
 * screen unmounts, by design — code-standards.md §16 on not holding credentials longer than a
 * request needs them); it returns to Login with the email prefilled instead, one tap short of a
 * full retype. */
export default function PendingApprovalScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  function checkAgain() {
    router.replace({ pathname: '/(auth)/login', params: email ? { email } : undefined });
  }

  function signOut() {
    useTenantStore.getState().clearCurrent();
    router.replace('/(auth)/welcome');
  }

  return (
    <AuthHeroScreen
      icon={Hourglass}
      title={t('auth.pending.title')}
      description={t('auth.pending.description')}
      actions={
        <>
          <Button variant="gradient" size="lg" fullWidth onPress={checkAgain} testID="pending-check-again">
            {t('auth.pending.checkAgain')}
          </Button>
          <Button variant="accent-ghost" size="lg" fullWidth onPress={signOut} testID="pending-sign-out">
            {t('auth.pending.signOut')}
          </Button>
        </>
      }
    >
      <SupportCard
        message={
          email
            ? t('auth.pending.supportMessage', { email })
            : t('auth.pending.supportMessageNoEmail')
        }
      />
    </AuthHeroScreen>
  );
}
