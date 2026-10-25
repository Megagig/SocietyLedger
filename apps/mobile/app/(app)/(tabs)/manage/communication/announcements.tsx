import { useRouter } from 'expo-router';
import { Megaphone, Plus } from 'lucide-react-native';
import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { AnnouncementRow } from '@/features/communication/components/Rows';
import { ANNOUNCE_ACCESS } from '@/features/communication/labels';
import { useAnnouncementsInfinite } from '@/features/communication/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import type { SentAnnouncementDTO } from '@/types/api/communication';

/** project-overview.md §6.9 CM2 — every announcement the association has sent: who sent it, who it went to, and where its texts stand. */
export default function SentAnnouncementsScreen() {
  const router = useRouter();
  const allowed = useCan(ANNOUNCE_ACCESS);
  const query = useAnnouncementsInfinite();
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.announcements) ?? [], [query.data]);
  const back = () => router.back();
  const compose = () => router.push('/(app)/(tabs)/manage/communication/announce' as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Sent announcements" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Sent announcements" onBack={back} docsKey="CM2" rightActions={<IconButton icon={Plus} accessibilityLabel="Send an announcement" onPress={compose} testID="announcements-new" />} />
      <PagedList
        query={query}
        items={items}
        keyOf={(a) => String(a.id)}
        skeletonHeight={104}
        renderItem={(a: SentAnnouncementDTO, i, n) => <AnnouncementRow item={a} position={positionOf(i, n)} />}
        empty={<EmptyState icon={Megaphone} title="Nothing sent yet" description="Announcements you send are kept here with who got them." actionLabel="Send an announcement" onAction={compose} />}
      />
    </Screen>
  );
}
