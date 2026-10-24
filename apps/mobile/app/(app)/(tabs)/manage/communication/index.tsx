import { useRouter } from 'expo-router';
import { FileText, History, Megaphone, MessageSquare, Send } from 'lucide-react-native';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import {
  ANNOUNCE_ACCESS,
  COMMUNICATION_ACCESS,
  COMMUNICATION_MODULE,
  creditsLabel,
  SMS_ANY_ACCESS,
  SMS_CAMPAIGN_ACCESS,
  SMS_SEND_ACCESS,
  SMS_TEMPLATE_ACCESS,
  SMS_VIEW_ACCESS,
} from '@/features/communication/labels';
import { useCreditBalance, useSmsDashboard } from '@/features/communication/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess, useModuleDisabled } from '@/hooks/useModuleAccess';

/**
 * project-overview.md §6.9 CM1 — Communication for officers: send an announcement, text members, run campaigns, keep message
 * wordings, and see what was sent and what it cost. Credits can only be bought on the web.
 */
export default function CommunicationHubScreen() {
  const router = useRouter();
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/communication/${path}` as never);

  const canAnyScreen = useCan(COMMUNICATION_ACCESS);
  const canAnnounce = useCan(ANNOUNCE_ACCESS);
  const smsOff = useModuleDisabled(COMMUNICATION_MODULE);
  const canTexts = useModuleAccess(SMS_ANY_ACCESS, COMMUNICATION_MODULE);
  const canQuick = useModuleAccess(SMS_SEND_ACCESS, COMMUNICATION_MODULE);
  const canCampaigns = useModuleAccess([SMS_CAMPAIGN_ACCESS, SMS_VIEW_ACCESS], COMMUNICATION_MODULE);
  const canTemplates = useModuleAccess([SMS_TEMPLATE_ACCESS, SMS_VIEW_ACCESS], COMMUNICATION_MODULE);
  const canHistory = useModuleAccess(SMS_VIEW_ACCESS, COMMUNICATION_MODULE);

  const balance = useCreditBalance();
  const stats = useSmsDashboard();

  if (!canAnyScreen) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Communication" onBack={back} docsKey="CM1" />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Communication" onBack={back} docsKey="CM1" />

      <View className="gap-6 pb-6">
        {canTexts ? (
          <Section title="Text messages">
            {balance.isPending ? (
              <Skeleton width="100%" height={88} radius="md" />
            ) : balance.isError ? (
              <ErrorState error={balance.error} onRetry={() => balance.refetch()} />
            ) : (
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <StatTile label="Credits left" value={balance.data.balance.toLocaleString('en-NG')} tone={balance.data.balance > 0 ? 'primary' : 'warning'} testID="credits-left" />
                  <StatTile label="Texts sent" value={(stats.data?.totalMessagesSent ?? 0).toLocaleString('en-NG')} tone="info" />
                  <StatTile label="Delivered" value={`${Math.round(stats.data?.deliveryRate ?? 0)}%`} tone="success" />
                </View>
                {balance.data.balance <= 0 ? (
                  <Card>
                    <Text variant="body" tone="secondary">
                      You have no credits left, so texts can’t go out. Buy credits on the web (Communication → Credits), then they show here.
                    </Text>
                  </Card>
                ) : (
                  <Text variant="caption" tone="secondary">
                    {`${creditsLabel(balance.data.balance)} left. Credits are bought on the web.`}
                  </Text>
                )}
              </View>
            )}
          </Section>
        ) : smsOff ? (
          <Card>
            <Text variant="body" tone="secondary">
              Text messages are not part of your plan. You can still send announcements by the app and email.
            </Text>
          </Card>
        ) : null}

        <Section title="Send">
          <ListGroup>
            {canAnnounce ? (
              <ListItem
                leading={<IconCircle icon={Megaphone} tone="primary" />}
                title="Announcement"
                meta="To everyone, a category or chosen members"
                showChevron
                onPress={() => go('announce')}
                testID="comm-announce"
              />
            ) : null}
            {canQuick ? (
              <ListItem
                leading={<IconCircle icon={Send} tone="primary" />}
                title="Quick text"
                meta="Text a few members or phone numbers"
                showChevron
                onPress={() => go('sms')}
                testID="comm-sms"
              />
            ) : null}
            {canCampaigns ? (
              <ListItem
                leading={<IconCircle icon={MessageSquare} tone="primary" />}
                title="Campaigns"
                meta="Text a whole group, now or later"
                trailing={stats.data && stats.data.activeCampaigns > 0 ? <Badge tone="warning">{`${stats.data.activeCampaigns} sending`}</Badge> : undefined}
                showChevron
                onPress={() => go('campaigns')}
                testID="comm-campaigns"
              />
            ) : null}
          </ListGroup>
        </Section>

        <Section title="Keep track">
          <ListGroup>
            {canAnnounce ? (
              <ListItem
                leading={<IconCircle icon={Megaphone} tone="info" />}
                title="Sent announcements"
                meta="What went out, to whom, and what it cost"
                showChevron
                onPress={() => go('announcements')}
                testID="comm-announcements"
              />
            ) : null}
            {canTemplates ? (
              <ListItem
                leading={<IconCircle icon={FileText} tone="info" />}
                title="Message templates"
                meta="Wordings you use again and again"
                trailing={stats.data ? <Badge tone="neutral">{String(stats.data.totalTemplates)}</Badge> : undefined}
                showChevron
                onPress={() => go('templates')}
                testID="comm-templates"
              />
            ) : null}
            {canHistory ? (
              <ListItem
                leading={<IconCircle icon={History} tone="info" />}
                title="Texts and credits"
                meta="Every text sent, and every credit bought or used"
                showChevron
                onPress={() => go('history')}
                testID="comm-history"
              />
            ) : null}
          </ListGroup>
        </Section>
      </View>
    </Screen>
  );
}
