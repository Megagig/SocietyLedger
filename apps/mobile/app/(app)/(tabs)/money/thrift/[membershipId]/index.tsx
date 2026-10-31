import { useLocalSearchParams, useRouter } from 'expo-router';
import { PiggyBank } from 'lucide-react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { DisputeSheet, type DisputeSheetHandle } from '@/features/ajo/components/DisputeSheet';
import { LeaveCircle } from '@/features/ajo/components/LeaveCircle';
import { MemberCasesCard } from '@/features/ajo/components/MemberCasesCard';
import { PayoutOrderCard } from '@/features/ajo/components/PayoutOrderCard';
import { thriftHref } from '@/features/ajo/components/MembershipCard';
import { PhoneConfirmCard } from '@/features/ajo/components/PhoneConfirmCard';
import { ReceiptsSheet, type ReceiptsSheetHandle } from '@/features/ajo/components/ReceiptsSheet';
import { CycleCard } from '@/features/ajo/components/CycleCard';
import { SwapRequestCard } from '@/features/ajo/components/SwapRequestCard';
import { formatDay, formatKobo, formatMoment, frequencyText, koboPositive, MODEL_LABEL, ordinal } from '@/features/ajo/format';
import type { MyMembershipDTO } from '@/types/api/ajo';
import { AJO_MEMBER_ACCESS, useContributions, useMyDisputes, useMyLateFees, useMyMemberships, useSchedule, useTrust } from '@/features/ajo/queries';

/** THM2 (schedule, my payments, rules), with THM7 (my trust score) and THM8 (raise a dispute). */
export default function MembershipDetailScreen() {
  const params = useLocalSearchParams<{ membershipId?: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const mine = useMyMemberships();
  const schedule = useSchedule(membershipId);
  const payments = useContributions(membershipId);
  const fees = useMyLateFees(membershipId);
  const trust = useTrust(membershipId);
  const disputes = useMyDisputes(membershipId);
  const disputeSheet = useRef<DisputeSheetHandle>(null);
  const receiptSheet = useRef<ReceiptsSheetHandle>(null);

  const item = mine.data?.find((m) => m.membershipId === membershipId);
  const refresh = () => {
    void mine.refetch();
    void schedule.refetch();
    void payments.refetch();
    void fees.refetch();
    void trust.refetch();
    void disputes.refetch();
  };

  return (
    <AjoScreen title={item?.group.name ?? 'My circle'} access={AJO_MEMBER_ACCESS} refreshing={mine.isRefetching} onRefresh={refresh}>
      <DetailBody
        loading={mine.isPending}
        error={mine.error}
        onRetry={() => mine.refetch()}
        item={item}
        membershipId={membershipId}
        schedule={schedule}
        payments={payments}
        fees={fees}
        trust={trust}
        disputes={disputes}
        disputeSheet={disputeSheet}
        receiptSheet={receiptSheet}
        onLeft={() => router.replace('/(app)/(tabs)/money/thrift' as never)}
        goBack={() => router.replace('/(app)/(tabs)/money/thrift' as never)}
        canWrite={canWrite}
      />
    </AjoScreen>
  );
}

type BodyProps = {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  item: MyMembershipDTO | undefined;
  membershipId: number;
  schedule: ReturnType<typeof useSchedule>;
  payments: ReturnType<typeof useContributions>;
  fees: ReturnType<typeof useMyLateFees>;
  trust: ReturnType<typeof useTrust>;
  disputes: ReturnType<typeof useMyDisputes>;
  disputeSheet: React.RefObject<DisputeSheetHandle | null>;
  receiptSheet: React.RefObject<ReceiptsSheetHandle | null>;
  onLeft: () => void;
  goBack: () => void;
  canWrite: boolean;
};

function DetailBody({ loading, error, onRetry, item, membershipId, schedule, payments, fees, trust, disputes, disputeSheet, receiptSheet, onLeft, goBack, canWrite }: BodyProps) {
  const router = useRouter();
  if (loading) return <AjoLoading />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!item) {
    return <EmptyState icon={PiggyBank} title="We could not find that circle." description="It may not be one of yours." actionLabel="Back to my circles" onAction={goBack} />;
  }

  const openDispute = new Set((disputes.data ?? []).filter((d) => d.status === 'OPEN').map((d) => d.installmentId));
  const owes = koboPositive(item.totalOwedKobo);
  const needsPhone = item.status === 'PENDING' && item.waitingFor.some((w) => w.requirement === 'PHONE_CONFIRMATION');

  return (
    <>
      <View className="gap-1">
        <Text variant="body" tone="secondary">
          {MODEL_LABEL[item.group.model]} · {frequencyText(item.group)} · {formatKobo(item.amountKobo ?? item.group.contributionKobo)}
          {item.shares > 1 ? ` × ${item.shares} shares` : ''}
        </Text>
        {item.group.model === 'ROTATING_POT' && item.payoutPositions.length > 0 ? (
          <Text variant="body">
            You collect {item.payoutPositions.map(ordinal).join(' and ')}
            {item.rounds ? ` of ${item.rounds} rounds` : ''}.
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-3">
        {item.group.model === 'COLLECTOR_THRIFT' && item.status !== 'LEFT' ? (
          <Button variant="secondary" fullWidth onPress={() => router.push(thriftHref(membershipId, '/savings'))} testID="ajo-savings-link">
            My savings
          </Button>
        ) : null}
        {item.group.model === 'ROTATING_POT' && item.status !== 'LEFT' ? (
          <Button variant="secondary" fullWidth onPress={() => router.push(thriftHref(membershipId, '/board'))} testID="ajo-board-link">
            Circle board
          </Button>
        ) : null}
        <Button variant="secondary" fullWidth onPress={() => router.push(thriftHref(membershipId, '/rules'))} testID="ajo-rules-link">
          Circle rules
        </Button>
        {canWrite && item.status === 'ACTIVE' && owes ? (
          <Button fullWidth onPress={() => router.push(thriftHref(membershipId, '/pay'))} testID="ajo-pay-link">
            Pay
          </Button>
        ) : null}
      </View>

      {item.waitingFor.some((w) => w.requirement === 'RULE_ACCEPTANCE') ? (
        <Card testID="ajo-next-step-rules">
          <View className="gap-2">
            <Text variant="h3">Your next step: read and accept the circle’s rules.</Text>
            <Text variant="body" tone="secondary">
              You become a member of the circle once you accept them. It takes a minute, and you can read them first.
            </Text>
            <Button onPress={() => router.push(thriftHref(membershipId, '/rules'))} testID="ajo-next-step-rules-button">
              Read and accept the rules
            </Button>
          </View>
        </Card>
      ) : null}

      {needsPhone && canWrite ? <PhoneConfirmCard membershipId={membershipId} /> : null}
      {item.group.model === 'ROTATING_POT' && item.status !== 'LEFT' ? <SwapRequestCard groupId={item.group.id} /> : null}
      {item.group.model === 'COLLECTOR_THRIFT' && item.status !== 'LEFT' ? <CycleCard membershipId={membershipId} /> : null}

      <View className="gap-3">
        <Text variant="h2">Your schedule</Text>
        {schedule.isPending ? (
          <AjoLoading rows={3} />
        ) : schedule.isError ? (
          <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} />
        ) : schedule.data.installments.length > 0 ? (
          <>
            <View className="flex-row gap-3">
              <StatTile label="To pay in all" value={formatKobo(schedule.data.totals.expectedKobo)} tone="info" />
              <StatTile label="Paid so far" value={formatKobo(schedule.data.totals.paidKobo)} tone="success" />
              <StatTile label="Still to pay" value={formatKobo(schedule.data.totals.remainingKobo)} tone="warning" />
            </View>
            <SectionCard title="Instalments">
              {schedule.data.installments.map((i) => {
                const unpaid = i.status === 'OVERDUE' || i.status === 'PARTIAL' || i.status === 'DUE';
                return (
                  <View key={i.id} className="gap-2 px-4 py-3" testID={`ajo-installment-${i.id}`}>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text variant="body-strong">{formatDay(i.dueDate)}</Text>
                      <AjoStatusBadge status={i.status} />
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="secondary">
                        Amount
                      </Text>
                      <AjoMoney kobo={i.amountKobo} />
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="secondary">
                        Paid
                      </Text>
                      <AjoMoney kobo={i.paidKobo} />
                    </View>
                    {openDispute.has(i.id) ? (
                      <Text variant="caption" tone="tertiary">
                        Claim sent
                      </Text>
                    ) : canWrite && unpaid && i.pastDue ? (
                      <Button size="sm" variant="ghost" onPress={() => disputeSheet.current?.open(i)} testID={`ajo-dispute-${i.id}`}>
                        I already paid this
                      </Button>
                    ) : null}
                  </View>
                );
              })}
            </SectionCard>
          </>
        ) : (
          <EmptyState icon={PiggyBank} title="No payments are scheduled yet." description="Your schedule appears once the circle has started." />
        )}
      </View>

      <View className="gap-3">
        <Text variant="h2">Your payments</Text>
        {payments.isPending ? (
          <AjoLoading rows={2} />
        ) : payments.isError ? (
          <ErrorState error={payments.error} onRetry={() => payments.refetch()} />
        ) : payments.data.length > 0 ? (
          <SectionCard title="Payments">
            {payments.data.map((p) => (
              <View key={p.id} className="gap-2 px-4 py-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1">
                    <AjoMoney kobo={p.amountKobo} />
                    <Text variant="caption" tone="tertiary">
                      by {p.method === 'CASH' ? 'cash' : 'bank transfer'} · {formatMoment(p.receivedAt)}
                    </Text>
                  </View>
                  <AjoStatusBadge status={p.reversed ? 'REVERSED' : p.status} />
                </View>
                {p.reversed && p.reversalReason ? (
                  <Text variant="caption" tone="tertiary">
                    Reversed: {p.reversalReason}
                  </Text>
                ) : null}
                {p.status === 'REJECTED' && p.reason ? (
                  <Text variant="caption" tone="tertiary">
                    Turned down: {p.reason}
                  </Text>
                ) : null}
                {p.counts ? (
                  <Button size="sm" variant="ghost" onPress={() => receiptSheet.current?.open(p.id)} testID={`ajo-receipt-${p.id}`}>
                    Receipt
                  </Button>
                ) : null}
              </View>
            ))}
          </SectionCard>
        ) : (
          <InlineEmpty icon={PiggyBank} message="You have not paid anything yet." />
        )}
      </View>

      {fees.data && fees.data.length > 0 ? (
        <SectionCard title="Late fees">
          {fees.data.map((f) => (
            <View key={f.id} className="gap-1 px-4 py-3">
              <View className="flex-row items-center justify-between gap-2">
                <AjoMoney kobo={f.feeKobo} />
                <AjoStatusBadge status={f.status} />
              </View>
              {f.calculation?.text ? (
                <Text variant="caption" tone="secondary">
                  {f.calculation.text}
                </Text>
              ) : null}
              {f.status === 'PENDING' ? (
                <Text variant="caption" tone="tertiary">
                  You are told first. It only becomes payable 48 hours after you have been told.
                </Text>
              ) : null}
              {f.status === 'WAIVED' && f.waivedReason ? (
                <Text variant="caption" tone="tertiary">
                  Waived: {f.waivedReason}
                </Text>
              ) : null}
            </View>
          ))}
        </SectionCard>
      ) : null}

      <View className="gap-3">
        <Text variant="h2">Your trust score</Text>
        {trust.isPending ? (
          <AjoLoading rows={1} />
        ) : trust.isError ? (
          <ErrorState error={trust.error} onRetry={() => trust.refetch()} />
        ) : (
          <Card testID="ajo-trust-card">
            <View className="gap-2">
              <View className="flex-row items-center gap-3">
                <AjoStatusBadge status={trust.data.band} />
                {trust.data.onTimePercent !== null ? <Text variant="h2">{trust.data.onTimePercent}%</Text> : null}
              </View>
              <Text variant="body">{trust.data.text}</Text>
              <Text variant="caption" tone="tertiary">
                It looks at how many of your payments in the last 12 months were made on time, across your circles. It never stops you from joining or being paid.
              </Text>
            </View>
          </Card>
        )}
      </View>

      {disputes.data && disputes.data.length > 0 ? (
        <SectionCard title="Your claims">
          {disputes.data.map((d) => (
            <View key={d.id} className="gap-1 px-4 py-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="body-strong">{formatMoment(d.createdAt)}</Text>
                <AjoStatusBadge status={d.outcome === 'OPEN' ? 'PENDING' : d.outcome} label={d.outcome === 'OPEN' ? 'With the officers' : undefined} />
              </View>
              <Text variant="body">{d.claim}</Text>
              {d.resolution ? (
                <Text variant="caption" tone="tertiary">
                  Decision: {d.resolution}
                </Text>
              ) : null}
            </View>
          ))}
        </SectionCard>
      ) : null}

      {item.group.model === 'ROTATING_POT' ? <PayoutOrderCard groupId={item.group.id} /> : null}

      <MemberCasesCard membershipId={membershipId} canWrite={canWrite} />

      {canWrite ? <LeaveCircle membershipId={membershipId} groupName={item.group.name} onLeft={onLeft} /> : null}
      <DisputeSheet ref={disputeSheet} membershipId={membershipId} />
      <ReceiptsSheet ref={receiptSheet} />
    </>
  );
}
