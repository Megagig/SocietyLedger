import { useRouter } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SearchField } from '@/components/forms/SearchField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { TicketRow } from '@/features/support/components/TicketRow';
import { isOpenTicket } from '@/features/support/labels';
import { SUPPORT_ESCALATE_ACCESS, SUPPORT_STAFF_ACCESS, useMyPlatformTickets, useStaffTickets } from '@/features/support/queries';
import { useCan } from '@/hooks/useCan';
import type { TicketDTO } from '@/types/api/support';

type Scope = 'members' | 'platform';
type Tab = 'open' | 'closed';

/** Matches the number, subject, category and the opener's name — plain, local, case-insensitive. */
function matches(ticket: TicketDTO, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const member = ticket.user?.member;
  const haystack = `${ticket.ticketNumber} ${ticket.subject} ${ticket.category} ${member ? `${member.firstName} ${member.lastName}` : ticket.user?.email ?? ''}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** project-overview.md §6.9 ST11 — Support tickets for the association's staff: every member ticket, plus my own tickets to SocietyLedger. */
export default function SupportDeskScreen() {
  const router = useRouter();
  const isStaff = useCan(SUPPORT_STAFF_ACCESS);
  const canEscalate = useCan(SUPPORT_ESCALATE_ACCESS);

  const [scope, setScope] = useState<Scope>('members');
  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');

  const membersQuery = useStaffTickets();
  const platformQuery = useMyPlatformTickets();
  const query = scope === 'members' ? membersQuery : platformQuery;

  const back = () => router.back();

  if (!isStaff) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Support tickets" onBack={back} />
        <EmptyState icon={LifeBuoy} title="No access" description="Support tickets are handled by your association's admins and officers." />
      </Screen>
    );
  }

  const tickets = query.data?.tickets ?? [];
  const open = tickets.filter((t) => isOpenTicket(t.status));
  const closed = tickets.filter((t) => !isOpenTicket(t.status));
  const needsReply = open.filter((t) => t.status === 'OPEN' || t.status === 'WAITING_ON_STAFF').length;
  const shown = (tab === 'open' ? open : closed).filter((t) => matches(t, search));

  const openTicket = (ticket: TicketDTO) =>
    // Tier 2 tickets are my own conversation with SocietyLedger — the same thread screen a member uses.
    router.push((scope === 'platform' ? `/(app)/(tabs)/profile/help/tickets/${ticket.id}` : `/(app)/(tabs)/manage/support/${ticket.id}`) as never);

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Support tickets" onBack={back} docsKey="ST11" />

      <View className="gap-4 pb-6">
        {canEscalate ? (
          <SegmentedControl<Scope>
            options={[
              { label: 'Member tickets', value: 'members' },
              { label: 'To SocietyLedger', value: 'platform' },
            ]}
            value={scope}
            onChange={(next) => {
              setScope(next);
              setTab('open');
              setSearch('');
            }}
          />
        ) : null}

        {scope === 'platform' ? (
          <Button variant="primary" onPress={() => router.push('/(app)/(tabs)/profile/help/tickets/new?to=platform' as never)} testID="contact-societyledger">
            Contact SocietyLedger
          </Button>
        ) : (
          <View className="flex-row gap-3">
            <StatTile label="Need a reply" value={String(needsReply)} tone="warning" />
            <StatTile label="Open" value={String(open.length)} tone="info" />
            <StatTile label="Closed" value={String(closed.length)} tone="success" />
          </View>
        )}

        <SearchField value={search} onChangeText={setSearch} placeholder="Search by number, subject or member" />

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
            title={search ? 'No tickets match' : tab === 'open' ? 'No open tickets' : 'No closed tickets'}
            description={
              scope === 'members'
                ? tab === 'open'
                  ? 'When a member sends a ticket, it shows up here — you get a notification too.'
                  : 'Resolved and closed tickets show up here.'
                : 'Tickets you send to SocietyLedger support show up here.'
            }
          />
        ) : (
          <ListGroup>
            {shown.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} staffView={scope === 'members'} onPress={() => openTicket(ticket)} />
            ))}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}
