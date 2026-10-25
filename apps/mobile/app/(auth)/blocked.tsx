import { router, useLocalSearchParams } from 'expo-router';
import { Ban } from 'lucide-react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { SupportCard } from '@/components/feedback/SupportCard';
import { AuthHeroScreen } from '@/components/layout/AuthHeroScreen';
import { t } from '@/lib/i18n';
import { parseParams } from '@/lib/params';
import { useTenantStore } from '@/stores/tenant';

const paramsSchema = z.object({
  variant: z.enum(['account-rejected', 'account-suspended', 'association-suspended', 'association-cancelled', 'association-not-found']),
});
type BlockedVariant = z.infer<typeof paramsSchema>['variant'];

const COPY: Record<BlockedVariant, { title: string; description: string }> = {
  'account-rejected': { title: t('auth.blocked.accountRejectedTitle'), description: t('auth.blocked.accountRejectedDescription') },
  'account-suspended': { title: t('auth.blocked.accountSuspendedTitle'), description: t('auth.blocked.accountSuspendedDescription') },
  'association-suspended': { title: t('auth.blocked.associationSuspendedTitle'), description: t('auth.blocked.associationSuspendedDescription') },
  'association-cancelled': { title: t('auth.blocked.associationCancelledTitle'), description: t('auth.blocked.associationCancelledDescription') },
  'association-not-found': { title: t('auth.blocked.associationNotFoundTitle'), description: t('auth.blocked.associationNotFoundDescription') },
};

/** A11 — "Variant copy for rejected/suspended accounts and suspended/cancelled associations."
 * Falls back to the account-suspended copy for a missing/bad `variant` param (no deep link
 * reaches this screen yet, so this is a safety net, not a real path). */
export default function BlockedScreen() {
  const rawParams = useLocalSearchParams();
  const parsed = parseParams(paramsSchema, rawParams);
  const variant = parsed?.variant ?? 'account-suspended';
  const copy = COPY[variant];

  function switchAssociation() {
    useTenantStore.getState().clearCurrent();
    router.replace('/(auth)/welcome');
  }

  return (
    <AuthHeroScreen
      icon={Ban}
      title={copy.title}
      description={copy.description}
      actions={
        <Button variant="gradient" size="lg" fullWidth onPress={switchAssociation} testID="blocked-switch-association">
          {t('auth.blocked.switchAssociation')}
        </Button>
      }
    >
      <SupportCard
        message={t('auth.blocked.supportMessage', { reason: copy.title })}
        nudgeLabel={t('auth.blocked.supportPrompt')}
      />
    </AuthHeroScreen>
  );
}
