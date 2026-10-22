import { useRouter } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { TicketRow } from '@/features/support/components/TicketRow';
import { isOpenTicket } from '@/features/support/labels';
import { SUPPORT_CREATE_ACCESS, useCanViewTickets, useMyTickets } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';

type Tab = 'open' | 'closed';

/** project-overview.md §6.7 P8 — My tickets: the support requests I've sent to my association, open ones first. */
export default function MyTicketsScreen() {
  const router = useRouter();
  const canView = useCanViewTickets();
  const canCreate = useCan(SUPPORT_CREATE_ACCESS);
  const query = useMyTickets();
  const [tab, setTab] = useState<Tab>('open');

  const back = () => router.back();
  const newTicket = () => router.push('/(app)/(tabs)/profile/help/tickets/new' as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="My tickets" onBack={back} />
        <EmptyState icon={LifeBuoy} title="No access" description="You don't have access to support tickets." />
      </Screen>
    );
  }

  const tickets = query.data?.tickets ?? [];
  const open = tickets.filter((t) => isOpenTicket(t.status));
  const closed = tickets.filter((t) => !isOpenTicket(t.status));
  const shown = tab === 'open' ? open : closed;

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="My tickets" onBack={back} docsKey="P8" />

      <View className="gap-4 pb-6">
        {canCreate ? (
          <Button variant="primary" onPress={newTicket} testID="new-ticket">
            New ticket
          </Button>
        ) : null}

        <SegmentedControl<Tab>
          options={[
            { label: `Open (${open.length})`, value: 'open' },
            { label: `Closed (${closed.length})`, value: 'closed' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={84} radius="lg" />
            <Skeleton width="100%" height={84} radius="lg" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={tab === 'open' ? 'No open tickets' : 'No closed tickets'}
            description={
              tab === 'open'
                ? "Need help that the help centre doesn't cover? Send a ticket to your association's admins."
                : 'Resolved and closed tickets show up here.'
            }
          />
        ) : (
          <ListGroup>
            {shown.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} onPress={() => router.push(`/(app)/(tabs)/profile/help/tickets/${ticket.id}` as never)} />
            ))}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}
