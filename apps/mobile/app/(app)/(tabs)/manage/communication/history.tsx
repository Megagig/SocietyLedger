import { useLocalSearchParams, useRouter } from 'expo-router';
import { History, Coins } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { StatTile } from '@/components/ui/StatTile';
import { CreditRow, MessageRow } from '@/features/communication/components/Rows';
import { COMMUNICATION_MODULE, MESSAGE_STATUS_FILTERS, SMS_VIEW_ACCESS } from '@/features/communication/labels';
import { useCreditBalance, useCreditHistoryInfinite, useMessagesInfinite } from '@/features/communication/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { SmsCreditTransactionDTO, SmsMessageDTO, SmsMessageStatus } from '@/types/api/communication';

type View_ = 'TEXTS' | 'CREDITS';

/**
 * project-overview.md §6.9 CM6 — every text sent (with whether it arrived) and every change to the credit balance. Opened from a
 * campaign it shows only that campaign's texts. Credits are bought on the web.
 */
export default function CommunicationHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ campaignId?: string }>();
  const campaignId = params.campaignId ? Number(params.campaignId) : undefined;
  const allowed = useModuleAccess(SMS_VIEW_ACCESS, COMMUNICATION_MODULE);
  const [view, setView] = useState<View_>('TEXTS');
  const [status, setStatus] = useState<SmsMessageStatus | ''>('');
  const messages = useMessagesInfinite(status, campaignId);
  const credits = useCreditHistoryInfinite();
  const balance = useCreditBalance();
  const texts = useMemo(() => messages.data?.pages.flatMap((p) => p.messages) ?? [], [messages.data]);
  const changes = useMemo(() => credits.data?.pages.flatMap((p) => p.transactions) ?? [], [credits.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Texts and credits" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title={campaignId ? 'Campaign texts' : 'Texts and credits'} onBack={back} docsKey="CM6" />

      {campaignId ? null : (
        <View className="pb-3">
          <SegmentedControl
            options={[
              { label: 'Texts', value: 'TEXTS' },
              { label: 'Credits', value: 'CREDITS' },
            ]}
            value={view}
            onChange={setView}
          />
        </View>
      )}

      {view === 'TEXTS' || campaignId ? (
        <>
          <View className="pb-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
              {MESSAGE_STATUS_FILTERS.map((s) => (
                <FilterChip key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(status === s.value ? '' : s.value)} />
              ))}
            </ScrollView>
          </View>
          <PagedList
            query={messages}
            items={texts}
            keyOf={(m) => String(m.id)}
            skeletonHeight={88}
            renderItem={(m: SmsMessageDTO, i, n) => <MessageRow item={m} position={positionOf(i, n)} />}
            empty={<EmptyState icon={History} title={status ? 'No texts here' : 'No texts yet'} description={status ? 'Try another filter.' : 'Texts you send show here, with whether they arrived.'} />}
          />
        </>
      ) : (
        <PagedList
          query={credits}
          items={changes}
          keyOf={(t) => String(t.id)}
          skeletonHeight={64}
          header={
            <View className="gap-3 pb-3">
              <View className="flex-row gap-3">
                <StatTile label="Left" value={(balance.data?.balance ?? 0).toLocaleString('en-NG')} tone="primary" />
                <StatTile label="Bought" value={(balance.data?.totalPurchased ?? 0).toLocaleString('en-NG')} tone="info" />
                <StatTile label="Used" value={(balance.data?.totalUsed ?? 0).toLocaleString('en-NG')} tone="accent" />
              </View>
            </View>
          }
          renderItem={(t: SmsCreditTransactionDTO, i, n) => <CreditRow item={t} position={positionOf(i, n)} />}
          empty={<EmptyState icon={Coins} title="No credit changes yet" description="Credits bought on the web, and credits used or refunded, show here." />}
        />
      )}
    </Screen>
  );
}
