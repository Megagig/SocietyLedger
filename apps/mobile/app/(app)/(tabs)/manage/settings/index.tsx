import { useRouter } from 'expo-router';
import { Bell, Building2, CreditCard, Crown, Landmark, ScrollText, ShieldCheck, UserCog, Users } from 'lucide-react-native';
import { View } from 'react-native';

import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { IconCircle } from '@/components/ui/IconCircle';
import { AUDIT_ACCESS, ROLES_VIEW_ACCESS } from '@/features/rbac/labels';
import { PAYMENTS_READ_ACCESS, SETTINGS_HUB_ACCESS, SETTINGS_READ_ACCESS, SUBSCRIPTION_ACCESS } from '@/features/settings/labels';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 ST1 — the settings an officer can change, grouped. A row appears only for the settings this officer may open. */
export default function SettingsHubScreen() {
  const router = useRouter();
  const canAny = useCan(SETTINGS_HUB_ACCESS);
  const canRead = useCan(SETTINGS_READ_ACCESS);
  const canPayments = useCan(PAYMENTS_READ_ACCESS);
  const canSubscription = useCan(SUBSCRIPTION_ACCESS);
  const canRoles = useCan(ROLES_VIEW_ACCESS);
  const canAudit = useCan(AUDIT_ACCESS);
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/settings/${path}` as never);

  if (!canAny) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Settings" onBack={() => router.back()} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Settings" onBack={() => router.back()} docsKey="ST1" />

      <View className="gap-6">
        {canRead ? (
          <Section title="Your association">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={Building2} tone="primary" />}
                title="Association profile"
                meta="Name, logo, colour and contact details"
                showChevron
                onPress={() => go('association')}
                testID="settings-association"
              />
              <ListItem
                leading={<IconCircle icon={UserCog} tone="primary" />}
                title="Members and access"
                meta="Self sign-up, default role, invites and member IDs"
                showChevron
                onPress={() => go('members-access')}
                testID="settings-members-access"
              />
            </ListGroup>
          </Section>
        ) : null}

        {canRead || canPayments ? (
          <Section title="Money and messages">
            <ListGroup>
              {canRead ? (
                <ListItem
                  leading={<IconCircle icon={Landmark} tone="primary" />}
                  title="Financial settings"
                  meta="Late fees, grace period and part payments"
                  showChevron
                  onPress={() => go('financial')}
                  testID="settings-financial"
                />
              ) : null}
              {canPayments ? (
                <ListItem
                  leading={<IconCircle icon={CreditCard} tone="primary" />}
                  title="Payment settings"
                  meta="Ways members can pay, receipts and cash lodgment"
                  showChevron
                  onPress={() => go('payments')}
                  testID="settings-payments"
                />
              ) : null}
              {canRead ? (
                <ListItem
                  leading={<IconCircle icon={Bell} tone="primary" />}
                  title="Reminders and sender"
                  meta="When members are reminded, and who the email is from"
                  showChevron
                  onPress={() => go('notifications')}
                  testID="settings-notifications"
                />
              ) : null}
            </ListGroup>
          </Section>
        ) : null}

        {canRoles || canAudit ? (
          <Section title="People and records">
            <ListGroup>
              {canRoles ? (
                <ListItem
                  leading={<IconCircle icon={Users} tone="info" />}
                  title="Users"
                  meta="Who can sign in, and the roles they hold"
                  showChevron
                  onPress={() => go('users')}
                  testID="settings-users"
                />
              ) : null}
              {canRoles ? (
                <ListItem
                  leading={<IconCircle icon={ShieldCheck} tone="info" />}
                  title="Roles and permissions"
                  meta="What each role can do"
                  showChevron
                  onPress={() => go('roles')}
                  testID="settings-roles"
                />
              ) : null}
              {canAudit ? (
                <ListItem
                  leading={<IconCircle icon={ScrollText} tone="info" />}
                  title="Audit log"
                  meta="Who did what, and when"
                  showChevron
                  onPress={() => go('audit')}
                  testID="settings-audit"
                />
              ) : null}
            </ListGroup>
          </Section>
        ) : null}

        {canSubscription ? (
          <Section title="Your plan">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={Crown} tone="accent" />}
                title="Subscription"
                meta="Your plan, renewal date and what it includes"
                showChevron
                onPress={() => go('subscription')}
                testID="settings-subscription"
              />
            </ListGroup>
          </Section>
        ) : null}
      </View>
    </Screen>
  );
}
