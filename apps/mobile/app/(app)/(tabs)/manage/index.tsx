import { Bell, Briefcase, LifeBuoy, Users } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle } from '@/components/ui/IconCircle';
import { MEMBERS_VIEW_ACCESS, useMemberStats } from '@/features/members/queries';
import { SUPPORT_STAFF_ACCESS, useStaffTickets } from '@/features/support/queries';
import { sessionKeys } from '@/features/session/queries';
import { useCan } from '@/hooks/useCan';

// project-overview.md §6.8/§6.9 — members, finance, payments verification, accounting, reports,
// meetings/elections/polls/welfare/cooperatives admin, communication, AI, settings, support land
// across Phase 5+. This screen (and the tab itself) is only reachable with a management
// permission — `(tabs)/_layout.tsx`'s `href` conditional, driven by `MANAGE_TAB_PERMISSIONS`.
// Sections appear here as each officer tool ships (Support, then Members); F5.1 turns this into the full hub.
export default function ManageScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Permissions come from the session (/auth/me); re-check them whenever the hub opens so a role granted
  // after sign-in shows up without a full sign-out.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
    }, [queryClient]),
  );
  const canSupport = useCan(SUPPORT_STAFF_ACCESS);
  const canMembers = useCan(MEMBERS_VIEW_ACCESS);
  const ticketsQuery = useStaffTickets();
  const statsQuery = useMemberStats();
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

      {canMembers || canSupport ? (
        <View className="gap-6">
          {canMembers ? (
            <Section title="Members">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Users} tone="primary" />}
                  title="Members"
                  meta="Directory, profiles and contact details"
                  trailing={statsQuery.data ? <Badge tone="neutral">{String(statsQuery.data.totalMembers)}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/members' as never)}
                  testID="manage-members"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canSupport ? (
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
          ) : null}
        </View>
      ) : (
        <EmptyState icon={Briefcase} title="Officer hub" description="Member, finance and operations tools arrive in the next releases." />
      )}
    </Screen>
  );
}
