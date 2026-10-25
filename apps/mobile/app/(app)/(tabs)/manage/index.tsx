import { Banknote, BookOpen, Bell, CalendarDays, ChartPie, FileBarChart, Wallet, Briefcase, HeartHandshake, LifeBuoy, MailPlus, Megaphone, PiggyBank, ReceiptText, Settings, Sparkles, UserCheck, Users, Vote } from 'lucide-react-native';
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
import { COOP_ADMIN_ACCESS, COOP_MODULE } from '@/features/coopManage/queries';
import { WELFARE_ADMIN_ACCESS, WELFARE_MODULE } from '@/features/welfareManage/queries';
import { ELECTION_ADMIN_ACCESS, VOTING_MODULE } from '@/features/electionsManage/labels';
import { dashboardKeys, attentionCount, useAttention } from '@/features/dashboard/queries';
import { FINANCE_VIEW_ACCESS } from '@/features/finance/queries';
import { MEETINGS_ADMIN_ACCESS, MEETINGS_MODULE, useMeetingStats } from '@/features/meetingsAdmin/queries';
import { CASH_ANY_ACCESS, CASH_VERIFY_ACCESS, useCashOverview } from '@/features/cash/queries';
import { MEMBERS_APPROVE_ACCESS, MEMBERS_INVITE_ACCESS, MEMBERS_VIEW_ACCESS, useMemberStats } from '@/features/members/queries';
import { BANK_ACCOUNTS_VIEW_ACCESS, PROOFS_VIEW_ACCESS } from '@/features/nigerianPayments/queries';
import { ACCOUNTING_MODULE, ACCOUNTING_VIEW_ACCESS } from '@/features/accounting/labels';
import { AI_MODULE, AI_VIEW_ACCESS } from '@/features/ai/labels';
import { COMMUNICATION_ACCESS } from '@/features/communication/labels';
import { EXPORT_ANY_ACCESS, REPORTS_MODULE, REPORTS_VIEW_ACCESS } from '@/features/reports/labels';
import { SETTINGS_HUB_ACCESS } from '@/features/settings/labels';
import { SUPPORT_STAFF_ACCESS } from '@/features/support/queries';
import { sessionKeys } from '@/features/session/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess, useModuleDisabled } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';

// project-overview.md §6.8/§6.9 — members, finance, payments verification, accounting, reports,
// meetings/elections/polls/welfare/cooperatives admin, communication, AI, settings, support land
// across Phase 5+. This screen (and the tab itself) is only reachable with a management
// permission — `(tabs)/_layout.tsx`'s `href` conditional, driven by `MANAGE_TAB_PERMISSIONS`.
// Sections appear here as each officer tool ships (Support, then Members); F5.1 turns this into the full hub.
export default function ManageScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantKey = useTenantKey();
  // Permissions come from the session (/auth/me); re-check them whenever the hub opens so a role granted
  // after sign-in shows up without a full sign-out.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.attention(tenantKey) });
    }, [queryClient, tenantKey]),
  );
  const canSupport = useCan(SUPPORT_STAFF_ACCESS);
  // Settings: any settings, roles or audit permission (each screen inside checks its own).
  const canSettings = useCan(SETTINGS_HUB_ACCESS);
  // Accounting: the permission to read the books and the accounting module on; the badge is entries waiting for this officer to approve or post.
  const canAccounting = useModuleAccess(ACCOUNTING_VIEW_ACCESS, ACCOUNTING_MODULE);
  const canAi = useModuleAccess(AI_VIEW_ACCESS, AI_MODULE);
  const canMembers = useCan(MEMBERS_VIEW_ACCESS);
  const canApprove = useCan(MEMBERS_APPROVE_ACCESS);
  const canInvite = useCan(MEMBERS_INVITE_ACCESS);
  const canProofs = useCan([PROOFS_VIEW_ACCESS, ...BANK_ACCOUNTS_VIEW_ACCESS]);
  // One call for every pending badge; the server only counts what this officer may open.
  const attention = useAttention().data;
  const waitingProofs = attentionCount(attention, 'paymentProofs') + attentionCount(attention, 'bankTransfers');
  const waitingApprovals = attentionCount(attention, 'memberApprovals');
  const canCash = useCan(CASH_ANY_ACCESS);
  const meetingsOff = useModuleDisabled(MEETINGS_MODULE);
  const canMeetings = useCan(MEETINGS_ADMIN_ACCESS) && !meetingsOff;
  const upcomingMeetings = useMeetingStats().data?.scheduledMeetings ?? 0;
  const canFinance = useCan(FINANCE_VIEW_ACCESS);
  // Communication: announcements need `notifications.send`; texting needs an SMS permission (the hub shows only what each can open).
  const canCommunication = useCan(COMMUNICATION_ACCESS);
  // Reports: the officer permission with the reports module on, or any export permission (files are made on the server).
  const canReadReports = useModuleAccess(REPORTS_VIEW_ACCESS, REPORTS_MODULE);
  const canExport = useCan(EXPORT_ANY_ACCESS);
  const canReports = canReadReports || canExport;
  // Cooperatives: officer permission and the module on; the badge adds up everything waiting for a decision.
  const canCoop = useModuleAccess(COOP_ADMIN_ACCESS, COOP_MODULE);
  const coopWaiting = attentionCount(attention, 'savingsDeposits') + attentionCount(attention, 'loanRepayments') + attentionCount(attention, 'loanApplications');
  // Welfare: officer permission and the module on; the badge adds contributions to confirm and requests to decide.
  const canWelfare = useModuleAccess(WELFARE_ADMIN_ACCESS, WELFARE_MODULE);
  const welfareWaiting = attentionCount(attention, 'welfareContributions') + attentionCount(attention, 'welfarePayouts');
  // Voting: the Election Committee runs elections, the Administrator runs polls; the badge adds up what is waiting for the committee.
  const canElections = useModuleAccess(ELECTION_ADMIN_ACCESS, VOTING_MODULE);
  const canPolls = useModuleAccess('POLL_MANAGE', VOTING_MODULE);
  // Who can vote and stand: the association's rules for new elections. Nothing is set until it chooses to.
  const canVotingRules = useModuleAccess('ELECTION_RULES', VOTING_MODULE);
  const electionsWaiting = attentionCount(attention, 'electionNominations') + attentionCount(attention, 'electionsToClose') + attentionCount(attention, 'electionResults');
  const overdueCharges = attentionCount(attention, 'overdueCharges');
  const journalWaiting = attentionCount(attention, 'journalEntries');
  const canVerifyCash = useCan(CASH_VERIFY_ACCESS);
  const cashOverview = useCashOverview().data;
  const cashToLodge = cashOverview?.mine?.readyToLodge ?? 0;
  const cashToVerify = attentionCount(attention, 'cashLodgments');
  const statsQuery = useMemberStats();
  const needsReply = attentionCount(attention, 'supportTickets');

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title="Manage"
        rightActions={
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
        }
      />

      {canMembers || canProofs || canCash || canFinance || canMeetings || canCoop || canWelfare || canElections || canPolls || canVotingRules || canCommunication || canReports || canAccounting || canAi || canSettings || canSupport ? (
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

          {canCoop ? (
            <Section title="Cooperative">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={PiggyBank} tone={coopWaiting > 0 ? 'warning' : 'primary'} />}
                  title="Cooperatives"
                  meta="Savings, loans, and payments to confirm"
                  trailing={coopWaiting > 0 ? <Badge tone="warning">{`${coopWaiting} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/cooperatives' as never)}
                  testID="manage-cooperatives"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canWelfare ? (
            <Section title="Welfare">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={HeartHandshake} tone={welfareWaiting > 0 ? 'warning' : 'primary'} />}
                  title="Welfare"
                  meta="Funds, contributions and payout requests"
                  trailing={welfareWaiting > 0 ? <Badge tone="warning">{`${welfareWaiting} to decide`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/welfare' as never)}
                  testID="manage-welfare"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canElections || canPolls || canVotingRules ? (
            <Section title="Voting">
              <ListGroup>
                {canElections ? (
                  <ListItem
                    leading={<IconCircle icon={Vote} tone={electionsWaiting > 0 ? 'warning' : 'primary'} />}
                    title="Elections"
                    meta="Nominations, voting and results"
                    trailing={electionsWaiting > 0 ? <Badge tone="warning">{`${electionsWaiting} waiting`}</Badge> : undefined}
                    showChevron
                    onPress={() => router.push('/(app)/(tabs)/manage/elections' as never)}
                    testID="manage-elections"
                  />
                ) : null}
                {canVotingRules ? (
                  <ListItem
                    leading={<IconCircle icon={Vote} tone="primary" />}
                    title="Voting rules"
                    meta="Who can vote and who can stand"
                    showChevron
                    onPress={() => router.push('/(app)/(tabs)/manage/elections/rules' as never)}
                    testID="manage-voting-rules"
                  />
                ) : null}
                {canPolls ? (
                  <ListItem
                    leading={<IconCircle icon={ChartPie} tone="primary" />}
                    title="Polls"
                    meta="Ask members a quick question"
                    showChevron
                    onPress={() => router.push('/(app)/(tabs)/manage/polls' as never)}
                    testID="manage-polls"
                  />
                ) : null}
              </ListGroup>
            </Section>
          ) : null}

          {canMeetings ? (
            <Section title="Meetings">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={CalendarDays} tone="primary" />}
                  title="Meetings"
                  meta="Schedule, take attendance and write minutes"
                  trailing={upcomingMeetings > 0 ? <Badge tone="neutral">{`${upcomingMeetings} coming up`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/meetings' as never)}
                  testID="manage-meetings"
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

          {canReports ? (
            <Section title="Reports">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={FileBarChart} tone="primary" />}
                  title="Reports"
                  meta="Financial reports, member balances, aging and exports"
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/reports' as never)}
                  testID="manage-reports"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canAccounting ? (
            <Section title="Accounting">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={BookOpen} tone={journalWaiting > 0 ? 'warning' : 'primary'} />}
                  title="Accounting"
                  meta="Journal entries, accounts, statements and budgets"
                  trailing={journalWaiting > 0 ? <Badge tone="warning">{`${journalWaiting} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/accounting' as never)}
                  testID="manage-accounting"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canAi ? (
            <Section title="AI assistant">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Sparkles} tone="primary" />}
                  title="AI assistant"
                  meta="Ask about your money, smart reminders and written reports"
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/ai' as never)}
                  testID="manage-ai"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canCommunication ? (
            <Section title="Communication">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Megaphone} tone="primary" />}
                  title="Communication"
                  meta="Announcements, texts, campaigns and templates"
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/communication' as never)}
                  testID="manage-communication"
                />
              </ListGroup>
            </Section>
          ) : null}

          {canSettings ? (
            <Section title="Settings">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Settings} tone="primary" />}
                  title="Settings"
                  meta="Profile, payments, reminders, access and your plan"
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/settings' as never)}
                  testID="manage-settings"
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
