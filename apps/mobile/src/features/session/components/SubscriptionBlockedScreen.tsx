import { CreditCard } from 'lucide-react-native';

import { SupportCard } from '@/components/feedback/SupportCard';
import { AuthHeroScreen } from '@/components/layout/AuthHeroScreen';
import { Button } from '@/components/ui/Button';
import { useLogout } from '@/features/session/mutations';
import { useSessionStore } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';

/** Officers who can renew (on the web). Members only get told to contact their admin. */
const RENEWING_ROLES = ['admin', 'treasurer', 'financial_secretary'];

/**
 * The whole app is paused because the association's free trial or subscription has ended. It never shows prices, plan names or a pay
 * button (app-store billing rules): an officer is told to renew on the web, a member to contact their admin. Signing out stays possible.
 */
export function SubscriptionBlockedScreen() {
  const user = useSessionStore((state) => state.user);
  const associationName = useTenantStore((state) => state.current?.name) ?? 'Your association';
  const logout = useLogout();
  const canRenew = !!user && RENEWING_ROLES.includes(user.role);
  const trialEnded = user?.subscriptionAccess?.reason === 'TRIAL_ENDED';

  return (
    <AuthHeroScreen
      icon={CreditCard}
      title={trialEnded ? 'Your free trial has ended' : 'Your subscription has ended'}
      description={
        canRenew
          ? `${associationName} is paused until a subscription payment is made. Sign in on the web to renew. Your data is safe and everything comes back as soon as you do.`
          : "Your association's subscription has expired. Please contact your administrator."
      }
      actions={
        <Button variant="accent-ghost" size="lg" fullWidth loading={logout.isPending} onPress={() => logout.mutate({ clearTenant: false })} testID="blocked-sign-out">
          Sign out
        </Button>
      }
    >
      {canRenew ? <SupportCard message={`Hello, ${associationName}'s ${trialEnded ? 'free trial' : 'subscription'} has ended and I would like to renew.`} nudgeLabel="Need help renewing?" /> : null}
    </AuthHeroScreen>
  );
}
