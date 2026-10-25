import { useRouter } from 'expo-router';
import { MessageSquare, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { CampaignRow } from '@/features/communication/components/Rows';
import { CAMPAIGN_STATUS_FILTERS, COMMUNICATION_MODULE, SMS_CAMPAIGN_ACCESS, SMS_VIEW_ACCESS } from '@/features/communication/labels';
import { useCampaignsInfinite } from '@/features/communication/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { SmsCampaignDTO, SmsCampaignStatus } from '@/types/api/communication';

/** project-overview.md §6.9 CM4 — the campaigns: texts to a whole group, now or at a set time. */
export default function CampaignsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess([SMS_CAMPAIGN_ACCESS, SMS_VIEW_ACCESS], COMMUNICATION_MODULE);
  const canCreate = useCan(SMS_CAMPAIGN_ACCESS);
  const [status, setStatus] = useState<SmsCampaignStatus | ''>('');
  const query = useCampaignsInfinite(status);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.campaigns) ?? [], [query.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/communication/campaigns/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Campaigns" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Campaigns"
        onBack={back}
        docsKey="CM4"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="New campaign" onPress={() => go('new')} testID="campaigns-new" /> : undefined}
      />

      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
          {CAMPAIGN_STATUS_FILTERS.map((s) => (
            <FilterChip key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(status === s.value ? '' : s.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={items}
        keyOf={(c) => String(c.id)}
        skeletonHeight={80}
        renderItem={(c: SmsCampaignDTO, i, n) => <CampaignRow item={c} position={positionOf(i, n)} onPress={(item) => go(`${item.id}`)} />}
        empty={
          <EmptyState
            icon={MessageSquare}
            title={status ? 'No campaigns here' : 'No campaigns yet'}
            description={status ? 'Try another filter.' : 'A campaign texts a whole group, like everyone who owes dues.'}
            actionLabel={!status && canCreate ? 'New campaign' : undefined}
            onAction={!status && canCreate ? () => go('new') : undefined}
          />
        }
      />
    </Screen>
  );
}
