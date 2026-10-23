import { Banknote, Bell, Wallet, Briefcase, LifeBuoy, MailPlus, ReceiptText, UserCheck, Users } from 'lucide-react-native';
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
import { FINANCE_VIEW_ACCESS, useChargeStats } from '@/features/finance/queries';
import { CASH_ANY_ACCESS, CASH_VERIFY_ACCESS, useCashOverview } from '@/features/cash/queries';
import { MEMBERS_APPROVE_ACCESS, MEMBERS_INVITE_ACCESS, MEMBERS_VIEW_ACCESS, usePendingApprovalCount, useMemberStats } from '@/features/members/queries';
import { BANK_ACCOUNTS_VIEW_ACCESS, PROOFS_VIEW_ACCESS, usePendingProofCount, usePendingTransferCount } from '@/features/nigerianPayments/queries';
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
  const canApprove = useCan(MEMBERS_APPROVE_ACCESS);
  const canInvite = useCan(MEMBERS_INVITE_ACCESS);
  const canProofs = useCan([PROOFS_VIEW_ACCESS, ...BANK_ACCOUNTS_VIEW_ACCESS]);
  const waitingProofs = (usePendingProofCount().data ?? 0) + (usePendingTransferCount().data ?? 0);
  const waitingApprovals = usePendingApprovalCount().data ?? 0;
  const canCash = useCan(CASH_ANY_ACCESS);
  const canFinance = useCan(FINANCE_VIEW_ACCESS);
  const overdueCharges = Number(useChargeStats().data?.byStatus?.overdue?.count ?? 0);
  const canVerifyCash = useCan(CASH_VERIFY_ACCESS);
  const cashOverview = useCashOverview().data;
  const cashToLodge = cashOverview?.mine?.readyToLodge ?? 0;
  const cashToVerify = cashOverview?.lodgmentsToVerify ?? 0;
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

      {canMembers || canProofs || canCash || canFinance || canSupport ? (
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
                {canApprove ? (
                  <ListItem
                    leading={<IconCircle icon={UserCheck} tone="warning" />}
                    title="Pending approvals"
                    meta="People who registered themselves"
                    trailing={waitingApprovals > 0 ? <Badge tone="warning">{`${waitingApprovals} waiting`}</Badge> : undefined}
                    showChevron
                    onPress={() => router.push('/(app)/(tabs)/manage/members/approvals' as never)}
                    testID="manage-approvals"
                  />
                ) : null}
                {canInvite ? (
                  <ListItem
                    leading={<IconCircle icon={MailPlus} tone="info" />}
                    title="Invite members"
                    meta="Email members a link to activate their login"
                    showChevron
                    onPress={() => router.push('/(app)/(tabs)/manage/members/invite' as never)}
                    testID="manage-invite"
                  />
                ) : null}
              </ListGroup>
            </Section>
          ) : null}

          {canFinance ? (
            <Section title="Finance">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Wallet} tone={overdueCharges > 0 ? 'warning' : 'primary'} />}
                  title="Finance"
                  meta="Collections, charges and recording payments"
                  trailing={overdueCharges > 0 ? <Badge tone="warning">{`${overdueCharges} overdue`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/finance' as never)}
                  testID="manage-finance"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canProofs ? (
            <Section title="Payments">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={ReceiptText} tone={waitingProofs > 0 ? 'warning' : 'primary'} />}
                  title="Payments"
                  meta="Payment proofs, bank transfers and bank accounts"
                  trailing={waitingProofs > 0 ? <Badge tone="warning">{`${waitingProofs} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/payments' as never)}
                  testID="manage-payments"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canCash ? (
            <Section title="Cash">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Banknote} tone={cashToLodge > 0 || (canVerifyCash && cashToVerify > 0) ? 'warning' : 'primary'} />}
                  title="Cash"
                  meta="Collect cash at meetings, lodge it, and check lodgments"
                  trailing={
                    canVerifyCash && cashToVerify > 0 ? (
                      <Badge tone="warning">{`${cashToVerify} to check`}</Badge>
                    ) : cashToLodge > 0 ? (
                      <Badge tone="warning">To lodge</Badge>
                    ) : undefined
                  }
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/cash' as never)}
                  testID="manage-cash"
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
