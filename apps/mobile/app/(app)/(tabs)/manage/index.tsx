import { Bell, Briefcase, LifeBuoy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle } from '@/components/ui/IconCircle';
import { SUPPORT_STAFF_ACCESS, useStaffTickets } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';

// project-overview.md §6.8/§6.9 — members, finance, payments verification, accounting, reports,
// meetings/elections/polls/welfare/cooperatives admin, communication, AI, settings, support land
// across Phase 4+. This screen (and the tab itself) is only reachable with a management
// permission — `(tabs)/_layout.tsx`'s `href` conditional, driven by `MANAGE_TAB_PERMISSIONS`.
// Sections appear here as each officer tool ships; Support is the first.
export default function ManageScreen() {
  const router = useRouter();
  const canSupport = useCan(SUPPORT_STAFF_ACCESS);
  const ticketsQuery = useStaffTickets();
  const needsReply = (ticketsQuery.data?.tickets ?? []).filter((t) => t.status === 'OPEN' || t.status === 'WAITING_ON_STAFF').length;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title="Manage"
        rightActions={
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
        }
      />

      {canSupport ? (
        <View className="gap-6">
          <Section title="Support">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={LifeBuoy} tone="info" />}
                title="Support tickets"
                meta="Member tickets, and your tickets to SocietyLedger"
                trailing={needsReply > 0 ? <Badge tone="warning">{`${needsReply} need a reply`}</Badge> : undefined}
                showChevron
                onPress={() => router.push('/(app)/(tabs)/manage/support' as never)}
                testID="manage-support"
              />
            </ListGroup>
          </Section>
        </View>
      ) : (
        <EmptyState icon={Briefcase} title="Officer hub" description="Member, finance and operations tools arrive from Phase 4 onward." />
      )}
    </Screen>
  );
}
