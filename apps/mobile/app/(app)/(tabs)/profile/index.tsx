import { BookOpen, Bell, HelpCircle, Info, LogOut, Moon, Repeat, ShieldCheck, User } from 'lucide-react-native';
import { router, useRouter } from 'expo-router';
import { useAjoNav } from '@/features/ajo/useAjoNav';
import { View } from 'react-native';

import { EditableAvatar } from '@/features/members/components/EditableAvatar';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useLogout } from '@/features/session/mutations';
import { useProfile } from '@/features/session/queries';
import { openUserManual } from '@/lib/docs';
import { appVersionLabel } from '@/lib/appVersion';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** project-overview.md §6.7 P1 — full profile home with avatar, name, role chip, and menu rows. */
export default function ProfileScreen() {
  const { thriftOnly } = useAjoNav();
  const expoRouter = useRouter();
  const logout = useLogout();
  const { color } = useThemeTokens();
  // Shown under the About row so the version is visible without opening the screen.
  const version = appVersionLabel();
  const appVersionText = version ? `${t('profile.about.version')} ${version}` : undefined;
  const profileQuery = useProfile();
  const profile = profileQuery.data;

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
    : '';

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
          <IconButton
            icon={Bell}
            accessibilityLabel="Notifications"
            onPress={() => expoRouter.push('/(app)/notifications')}
          />
        }
      />

      {/* Avatar + name hero */}
      <View className="items-center gap-3 py-6">
        {profileQuery.isPending ? (
          <>
            <Skeleton width={96} height={96} radius="full" />
            <Skeleton width={160} height={20} />
            <Skeleton width={100} height={14} />
          </>
        ) : (
          <>
            <EditableAvatar name={displayName || 'Member'} size={96} colorSeed={profile?.id} imageUrl={profile?.photoUrl} target={{ kind: 'me' }} testID="profile-photo" />
            <View className="items-center gap-1">
              <Text variant="h2">{displayName || '—'}</Text>
              {profile?.memberId ? (
                <Text variant="caption" tone="tertiary">
                  {profile.memberId}
                </Text>
              ) : null}
              {profile?.category ? (
                <View
                  className="mt-1 rounded-full px-3 py-1"
                  style={{ backgroundColor: `${color.primary}1A` }}
                >
                  <Text variant="caption" style={{ color: color.primary }}>
                    {profile.category}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>

      {/* Account section */}
      <View className="gap-3">
        <ListGroup>
          <ListItem
            leading={<User size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={t('profile.myProfile')}
            showChevron
            onPress={() => expoRouter.push('/(app)/(tabs)/profile/details' as never)}
            testID="profile-details"
          />
          <ListItem
            leading={<ShieldCheck size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={t('profile.securityRow')}
            showChevron
            onPress={() => expoRouter.push('/(app)/(tabs)/profile/security')}
            testID="profile-security"
          />
          <ListItem
            leading={<Bell size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={t('profile.notificationsRow')}
            showChevron
            onPress={() => expoRouter.push('/(app)/notifications/preferences' as never)}
            testID="profile-notifications"
          />
        </ListGroup>

        <ListGroup>
          <ListItem
            leading={<Moon size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={t('profile.appearanceRow')}
            showChevron
            onPress={() => expoRouter.push('/(app)/(tabs)/profile/appearance' as never)}
            testID="profile-appearance"
          />
          <ListItem
            leading={<HelpCircle size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={t('profile.helpRow')}
            showChevron
            onPress={() => expoRouter.push('/(app)/(tabs)/profile/help' as never)}
            testID="profile-help"
          />
          <ListItem
            leading={<BookOpen size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title="User manual"
            meta="Step-by-step guides on our docs site"
            showChevron
            onPress={() => void openUserManual('profile')}
            testID="profile-user-manual"
          />
          <ListItem
            leading={<Info size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={t('profile.aboutRow')}
            meta={appVersionText}
            showChevron
            onPress={() => expoRouter.push('/(app)/(tabs)/profile/about' as never)}
            testID="profile-about"
          />
        </ListGroup>

        <ListGroup>
          <ListItem
            leading={<Repeat size={20} color={color.textSecondary} strokeWidth={1.75} />}
            title={thriftOnly ? 'Switch group' : t('profile.switchAssociationRow')}
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
      </View>
    </Screen>
  );
}
