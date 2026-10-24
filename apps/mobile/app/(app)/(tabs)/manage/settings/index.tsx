import { useRouter } from 'expo-router';
import { Bell, Building2, CreditCard, Crown, Landmark, UserCog } from 'lucide-react-native';
import { View } from 'react-native';

import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { IconCircle } from '@/components/ui/IconCircle';
import { PAYMENTS_EDIT_ACCESS, SETTINGS_EDIT_ACCESS, SETTINGS_HUB_ACCESS, SUBSCRIPTION_ACCESS } from '@/features/settings/labels';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 ST1 — the settings an officer can change, grouped. A row appears only for the settings this officer may open. */
export default function SettingsHubScreen() {
  const router = useRouter();
  const canAny = useCan(SETTINGS_HUB_ACCESS);
  const canEdit = useCan(SETTINGS_EDIT_ACCESS);
  const canPayments = useCan(PAYMENTS_EDIT_ACCESS);
  const canSubscription = useCan(SUBSCRIPTION_ACCESS);
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
        {canEdit ? (
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

        {canEdit || canPayments ? (
          <Section title="Money and messages">
            <ListGroup>
              {canEdit ? (
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
              {canEdit ? (
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
