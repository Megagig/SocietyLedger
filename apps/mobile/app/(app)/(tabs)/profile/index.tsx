import { Bell, LogOut, Repeat, ShieldCheck, User } from 'lucide-react-native';
import { router, useRouter } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { useLogout } from '@/features/session/mutations';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * project-overview.md §6.7 — profile details, appearance, about, help/support land at F3.3,
 * which will absorb this placeholder into the real P1 menu. F2.4 adds the only 3 rows its own
 * logic actually needs to be reachable: Security (the new `security.tsx`), Sign out and Switch
 * association (both `useLogout()` — see that hook for why one keeps the tenant and one doesn't).
 */
export default function ProfileScreen() {
  const expoRouter = useRouter();
  const logout = useLogout();
  const { color } = useThemeTokens();

  function signOut() {
    logout.mutate(undefined, { onSuccess: () => router.replace('/(auth)/association') });
  }

  function switchAssociation() {
    logout.mutate({ clearTenant: true }, { onSuccess: () => router.replace('/(auth)/welcome') });
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title={t('profile.title')}
        rightActions={
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => expoRouter.push('/(app)/notifications')} />
        }
      />
      <EmptyState icon={User} title={t('profile.comingSoonTitle')} description={t('profile.comingSoonDescription')} />
      <ListGroup>
        <ListItem
          leading={<ShieldCheck size={20} color={color.textSecondary} strokeWidth={1.75} />}
          title={t('profile.securityRow')}
          showChevron
          onPress={() => expoRouter.push('/(app)/(tabs)/profile/security')}
          testID="profile-security"
        />
        <ListItem
          leading={<Repeat size={20} color={color.textSecondary} strokeWidth={1.75} />}
          title={t('profile.switchAssociationRow')}
          onPress={switchAssociation}
          disabled={logout.isPending}
          testID="profile-switch-association"
        />
        <ListItem
          leading={<LogOut size={20} color={color.danger} strokeWidth={1.75} />}
          title={t('profile.signOutRow')}
          onPress={signOut}
          disabled={logout.isPending}
          testID="profile-sign-out"
        />
      </ListGroup>
    </Screen>
  );
}
