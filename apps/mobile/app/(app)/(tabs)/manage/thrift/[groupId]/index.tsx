import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeftRight, CircleDollarSign, FileText, Gavel, HandCoins, ListOrdered, RefreshCw, Users, Wallet } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Text } from '@/components/ui/Text';
import { AjoActionSheet } from '@/features/ajo/components/AjoActionSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { EditCircleSheet, type EditCircleSheetHandle } from '@/features/ajo/components/EditCircleSheet';
import { formatDay, formatKobo, frequencyText, MODEL_LABEL } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import { AJO_STAFF_ACCESS, useGroupDetail } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';

const FEE_TEXT = { NONE: 'No collector fee', FIXED: 'A fixed amount', PERCENT: 'A percentage of the pot', DAYS: 'Days of contribution' } as const;
const sub = (groupId: number, path: string) => `/(app)/(tabs)/manage/thrift/${groupId}/${path}` as never;

/** THO2 (edit and settings) with the circle's lifecycle: draft, open for joining, running, completed or cancelled — and the way into each part of the circle. */
export default function CircleOverviewScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const { manage, reconcile, approvePayout, anyOfficer } = useAjoCan();
  const detail = useGroupDetail(groupId);
  const group = detail.data;
  const open = useAjoAction<void>(() => ajoApi.openGroup(groupId));
  const start = useAjoAction((confirmSmaller: boolean) => ajoApi.startGroup(groupId, confirmSmaller));
  const cancelSheet = useRef<BottomSheetModal>(null);
  const editSheet = useRef<EditCircleSheetHandle>(null);
  const [smaller, setSmaller] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const can = manage && canWrite;

  const doOpen = async () => {
    setProblem(null);
    try {
      await open.mutateAsync();
      toast.success('The circle is open. Members can now be added and approved.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not open the circle.');
    }
  };
  const doStart = async (confirmSmaller: boolean) => {
    setProblem(null);
    try {
      await start.mutateAsync(confirmSmaller);
      setSmaller(null);
      toast.success('The circle has started. The schedule is ready.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFIRM_SMALLER_GROUP') setSmaller(error.message);
      else setProblem(error instanceof ApiError ? error.message : 'Could not start the circle.');
    }
  };

  return (
    <AjoScreen title={group?.name ?? 'Circle'} access={AJO_STAFF_ACCESS} refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
      {detail.isPending ? (
        <AjoLoading />
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : group ? (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <AjoStatusBadge status={group.status} />
            <Text variant="caption" tone="secondary">
              {MODEL_LABEL[group.model]} · {frequencyText(group)}
            </Text>
          </View>

          {problem ? (
            <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
              <Text variant="body" tone="danger">
                {problem}
              </Text>
            </View>
          ) : null}

          {can && group.status === 'DRAFT' ? (
            <View className="gap-2 rounded-lg bg-info-soft p-4" testID="ajo-draft-banner">
              <Text variant="body-strong" tone="info">
                This circle is a draft.
              </Text>
              <Text variant="caption" tone="info">
                Check the details below, then open it so you can add and approve people.
              </Text>
              <Button loading={open.isPending} onPress={() => void doOpen()} testID="ajo-open-for-joining">
                Open for joining
              </Button>
            </View>
          ) : null}

          {can && group.status === 'OPEN' ? (
            <View className="gap-2 rounded-lg bg-success-soft p-4" testID="ajo-open-banner">
              <Text variant="body-strong" tone="success">
                {group.activeParticipants} of {group.maxParticipants} people are approved.
              </Text>
              <Text variant="caption" tone="success">
                Starting fixes the circle, draws the payout order (for a rotating pot) and creates everyone&apos;s payment schedule.
              </Text>
              {smaller ? (
                <View className="gap-2">
                  <Text variant="body" tone="success">
                    {smaller}
                  </Text>
                  <View className="flex-row gap-3">
                    <Button fullWidth loading={start.isPending} onPress={() => void doStart(true)} testID="ajo-start-smaller">
                      {`Start with ${group.activeParticipants} people`}
                    </Button>
                    <Button variant="secondary" fullWidth onPress={() => setSmaller(null)}>
                      Wait for more
                    </Button>
                  </View>
                </View>
              ) : (
                <Button loading={start.isPending} onPress={() => void doStart(false)} testID="ajo-start">
                  Start the circle
                </Button>
              )}
            </View>
          ) : null}

          {group.status === 'CANCELLED' ? (
            <View className="rounded-md bg-surface-sunken p-3">
              <Text variant="body">This circle was cancelled{group.cancelReason ? `: ${group.cancelReason}` : '.'}</Text>
            </View>
          ) : null}

          <Card testID="ajo-circle-facts">
            <View className="gap-2">
              {(
                [
                  ['Each pays', <AjoMoney key="a" kobo={group.contributionKobo} />],
                  ['Seats taken', <Text key="b" variant="body-strong">{`${group.seats.taken} of ${group.seats.total}`}</Text>],
                  ['First payment', <Text key="c" variant="body-strong">{formatDay(group.startDate)}</Text>],
                  [group.model === 'ROTATING_POT' ? 'Rounds' : 'Payments in the cycle', <Text key="d" variant="body-strong">{String(group.rounds ?? group.cycleLength ?? '—')}</Text>],
                  [
                    'Collector fee',
                    <Text key="e" variant="body-strong" align="right" className="flex-1">
                      {group.collectorFee.type === 'NONE'
                        ? 'None'
                        : `${FEE_TEXT[group.collectorFee.type]}: ${group.collectorFee.type === 'FIXED' ? formatKobo(group.collectorFee.value) : group.collectorFee.type === 'PERCENT' ? `${Number(group.collectorFee.value) / 100}%` : `${group.collectorFee.value} day(s)`}`}
                    </Text>,
                  ],
                  ['Current rules', <Text key="f" variant="body-strong">{group.currentRuleVersion ? `Version ${group.currentRuleVersion}` : 'None yet'}</Text>],
                ] as const
              ).map(([label, value]) => (
                <View key={label} className="flex-row items-center justify-between gap-3">
                  <Text variant="caption" tone="tertiary">
                    {label}
                  </Text>
                  {value}
                </View>
              ))}
            </View>
          </Card>

          <Card testID="ajo-circle-bank">
            <View className="gap-1">
              <Text variant="h3">Where members pay</Text>
              {group.bankAccount ? (
                <Text variant="body">
                  {group.bankAccount.bankName} · {group.bankAccount.accountName} · {group.bankAccount.masked}
                </Text>
              ) : (
                <Text variant="body" tone="danger">
                  No bank account has been added yet. Members cannot pay until one is.
                </Text>
              )}
              <Text variant="caption" tone="tertiary">
                Timezone {group.timezone}, cut-off {group.cutoffTime}. Members {group.requirePhoneConfirm ? 'must' : 'do not need to'} confirm their phone number.
              </Text>
            </View>
          </Card>

          <ListGroup>
            {manage ? <ListItem leading={<IconCircle icon={Users} tone="primary" />} title="Members" meta="Approve people, verification, guarantors" showChevron onPress={() => router.push(sub(groupId, 'members'))} testID="ajo-nav-members" /> : null}
            {anyOfficer && group.model === 'ROTATING_POT' ? <ListItem leading={<IconCircle icon={ListOrdered} tone="primary" />} title="Payout order" meta="Draw, swaps and exceptions" showChevron onPress={() => router.push(sub(groupId, 'order'))} testID="ajo-nav-order" /> : null}
            {manage || reconcile ? <ListItem leading={<IconCircle icon={CircleDollarSign} tone="primary" />} title="Payments" meta="Confirm transfers, reverse with a reason" showChevron onPress={() => router.push(sub(groupId, 'payments'))} testID="ajo-nav-payments" /> : null}
            {(manage || reconcile) && group.model === 'COLLECTOR_THRIFT' ? <ListItem leading={<IconCircle icon={HandCoins} tone="primary" />} title="Cash handovers" meta="Count and reconcile collectors’ cash" showChevron onPress={() => router.push(sub(groupId, 'handovers'))} testID="ajo-nav-handovers" /> : null}
            {anyOfficer && group.model === 'COLLECTOR_THRIFT' ? <ListItem leading={<IconCircle icon={RefreshCw} tone="primary" />} title="Savings cycle" meta="Who continues, who withdraws, start the next cycle" showChevron onPress={() => router.push(sub(groupId, 'cycle'))} testID="ajo-nav-cycle" /> : null}
            {manage && group.model === 'COLLECTOR_THRIFT' ? <ListItem leading={<IconCircle icon={ArrowLeftRight} tone="primary" />} title="Collectors" meta="Assign contributors and daily targets" showChevron onPress={() => router.push(sub(groupId, 'collectors'))} testID="ajo-nav-collectors" /> : null}
            {anyOfficer ? <ListItem leading={<IconCircle icon={Wallet} tone="primary" />} title="Payouts" meta="Prepare, approve and record payouts" showChevron onPress={() => router.push(sub(groupId, 'payouts'))} testID="ajo-nav-payouts" /> : null}
            {manage || reconcile || approvePayout ? <ListItem leading={<IconCircle icon={Gavel} tone="warning" />} title="Arrears and cases" meta="Late fees, disputes and default cases" showChevron onPress={() => router.push(sub(groupId, 'arrears'))} testID="ajo-nav-arrears" /> : null}
            {manage ? <ListItem leading={<IconCircle icon={FileText} tone="primary" />} title="Rules" meta="Versions and publishing a new one" showChevron onPress={() => router.push(sub(groupId, 'rules'))} testID="ajo-nav-rules" /> : null}
          </ListGroup>

          {can && (group.status === 'DRAFT' || group.status === 'OPEN' || group.status === 'ACTIVE') ? (
            <View className="gap-3">
              {group.status === 'DRAFT' || group.status === 'OPEN' ? (
                <Button variant="secondary" onPress={() => editSheet.current?.open(group)} testID="ajo-edit-settings">
                  Edit settings
                </Button>
              ) : null}
              <Button variant="ghost" onPress={() => cancelSheet.current?.present()} testID="ajo-cancel-circle">
                Cancel this circle
              </Button>
            </View>
          ) : null}

          <AjoActionSheet
            ref={cancelSheet}
            title="Cancel this circle"
            summary="Cancelling stops the circle for everyone. Money already recorded stays on the record; nothing is deleted."
            confirmLabel="Cancel the circle"
            destructive
            reasonMin={10}
            reasonLabel="Why is it being cancelled"
            onConfirm={({ reason }) => ajoApi.cancelGroup(groupId, reason)}
            successMessage="The circle was cancelled."
            testID="ajo-cancel-sheet"
          />
          <EditCircleSheet ref={editSheet} groupId={groupId} />
        </>
      ) : null}
    </AjoScreen>
  );
}
