import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Gavel } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { AjoActionSheet } from '@/features/ajo/components/AjoActionSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { TickRow } from '@/features/ajo/components/TickRow';
import { formatDay, formatKobo, formatMoment } from '@/features/ajo/format';
import { CASE_STATUS, caseBadge } from '@/features/ajo/labels';
import { useAjoAction } from '@/features/ajo/mutations';
import { useGroupCases, useGroupDetail, useGroupDisputes, useGroupLateFees, usePeople } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import type { StaffDisputeDTO, StaffLateFeeDTO } from '@/types/api/ajo';
import { useForm } from 'react-hook-form';

type Tab = 'fees' | 'disputes' | 'cases';

/** THO6: everything about people who are behind: late fees, claims that they already paid, and cases after a payout. */
export default function CircleArrearsScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const { manage, reconcile, approvePayout } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const people = usePeople(groupId);
  const names = new Map((people.data ?? []).map((p) => [p.membershipId, p.name]));
  const nameOf = (id: number) => names.get(id) ?? 'A member';
  // Each role reads only what the server lets it: fees and claims need manage or reconcile, cases need manage or approve. A call it may not make is never sent.
  const canFees = manage || reconcile;
  const canCases = group?.model === 'ROTATING_POT' && (manage || approvePayout);
  const fees = useGroupLateFees(canFees ? groupId : 0);
  const disputes = useGroupDisputes(canFees ? groupId : 0);
  const cases = useGroupCases(canCases ? groupId : 0);
  const tabs = [
    ...(canFees ? [{ label: 'Late fees', value: 'fees' as Tab }] : []),
    ...(canFees ? [{ label: `Claims${disputes.data && disputes.data.filter((d) => d.status === 'OPEN').length ? ` (${disputes.data.filter((d) => d.status === 'OPEN').length})` : ''}`, value: 'disputes' as Tab }] : []),
    ...(canCases ? [{ label: 'Cases', value: 'cases' as Tab }] : []),
  ];
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const tab: Tab = chosenTab && tabs.some((t) => t.value === chosenTab) ? chosenTab : (tabs[0]?.value ?? 'fees');

  const waiveSheet = useRef<BottomSheetModal>(null);
  const unwaiveSheet = useRef<BottomSheetModal>(null);
  const toldSheet = useRef<BottomSheetModal>(null);
  const decideSheet = useRef<BottomSheetModal>(null);
  const [waiving, setWaiving] = useState<StaffLateFeeDTO | null>(null);
  const [unwaiving, setUnwaiving] = useState<StaffLateFeeDTO | null>(null);
  const [told, setTold] = useState<StaffLateFeeDTO | null>(null);
  const [resolving, setResolving] = useState<StaffDisputeDTO | null>(null);
  const [outcome, setOutcome] = useState<'UPHELD' | 'NOT_UPHELD'>('UPHELD');
  const [problem, setProblem] = useState<string | null>(null);
  const { control, getValues, reset } = useForm<{ person: string }>({ defaultValues: { person: '' } });
  const openCase = useAjoAction((membershipId: number) => ajoApi.openCase(membershipId));
  const anyOfficer = manage || reconcile;

  const evidence = async (id: number) => {
    setProblem(null);
    try {
      await WebBrowser.openBrowserAsync((await ajoApi.disputeEvidence(id)).url);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not open the evidence.');
    }
  };
  const doOpenCase = async () => {
    const membershipId = Number(getValues('person'));
    if (!membershipId) return;
    setProblem(null);
    try {
      await openCase.mutateAsync(membershipId);
      toast.success('Case opened.');
      reset();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not open the case.');
    }
  };

  return (
    <AjoScreen title="Arrears and cases" access={['AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT']} refreshing={fees.isRefetching} onRefresh={() => void Promise.all([fees.refetch(), disputes.refetch(), cases.refetch()])}>
      {problem ? (
        <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        </View>
      ) : null}
      {tabs.length > 1 ? <SegmentedControl options={tabs} value={tab} onChange={setTab} testID="ajo-arrears-tabs" /> : null}

      {tab === 'fees' && canFees ? (
        <View className="gap-3">
          <Text variant="body" tone="secondary">
            A late fee is worked out from the rules the member accepted. They are told first, and it only becomes payable 48 hours later. It belongs to the circle, never to a payout or to SocietyLedger.
          </Text>
          {fees.isPending ? (
            <AjoLoading />
          ) : fees.isError ? (
            <ErrorState error={fees.error} onRetry={() => fees.refetch()} />
          ) : fees.data.length > 0 ? (
            fees.data.map((f) => (
              <Card key={f.id} testID={`ajo-fee-${f.id}`}>
                <View className="gap-2">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text variant="h3" className="flex-1">
                      {nameOf(f.membershipId)}
                    </Text>
                    <AjoMoney kobo={f.feeKobo} />
                  </View>
                  <Text variant="caption" tone="secondary">
                    {f.calculation?.text}
                    {f.waivedReason ? ` · waived: ${f.waivedReason}` : ''}
                    {f.status === 'PENDING' && !f.notifiedAt ? ' · the member has not been told yet' : ''}
                  </Text>
                  <AjoStatusBadge status={f.status} />
                  {canWrite && manage ? (
                    <View className="flex-row flex-wrap gap-2">
                      {f.status === 'PENDING' && !f.notifiedAt ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            setTold(f);
                            toldSheet.current?.present();
                          }}
                        >
                          I told them
                        </Button>
                      ) : null}
                      {f.status === 'PENDING' || f.status === 'PAYABLE' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setWaiving(f);
                            waiveSheet.current?.present();
                          }}
                          testID={`ajo-waive-${f.id}`}
                        >
                          Waive
                        </Button>
                      ) : null}
                      {f.status === 'WAIVED' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            setUnwaiving(f);
                            unwaiveSheet.current?.present();
                          }}
                        >
                          Undo waiver
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Card>
            ))
          ) : (
            <EmptyState icon={Gavel} title="No late fees." description="Fees only appear if the circle's rules have a late fee and someone is late past the grace days." />
          )}
        </View>
      ) : null}

      {tab === 'disputes' && canFees ? (
        <View className="gap-3">
          <Text variant="body" tone="secondary">
            While a claim is open, that member is not charged late fees or chased. A different person from the one who raised it decides, with a reason. A decision is final, and a claim never creates money: record the payment the normal way if it was real.
          </Text>
          {disputes.isPending ? (
            <AjoLoading />
          ) : disputes.isError ? (
            <ErrorState error={disputes.error} onRetry={() => disputes.refetch()} />
          ) : disputes.data.length > 0 ? (
            disputes.data.map((d) => (
              <Card key={d.id} testID={`ajo-dispute-${d.id}`}>
                <View className="gap-2">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text variant="h3">{nameOf(d.membershipId)}</Text>
                      <Text variant="caption" tone="tertiary">
                        {formatMoment(d.createdAt)}
                      </Text>
                    </View>
                    <AjoStatusBadge status={d.outcome === 'OPEN' ? 'PENDING' : d.outcome} label={d.outcome === 'OPEN' ? 'Waiting for a decision' : undefined} />
                  </View>
                  <Text variant="body">{d.claim}</Text>
                  {d.resolution ? (
                    <Text variant="caption" tone="tertiary">
                      Decision: {d.resolution}
                    </Text>
                  ) : null}
                  <View className="flex-row flex-wrap gap-2">
                    {d.hasEvidence ? (
                      <Button size="sm" variant="ghost" onPress={() => void evidence(d.id)}>
                        See evidence
                      </Button>
                    ) : null}
                    {canWrite && anyOfficer && d.status === 'OPEN' ? (
                      <Button
                        size="sm"
                        onPress={() => {
                          setResolving(d);
                          setOutcome('UPHELD');
                          decideSheet.current?.present();
                        }}
                        testID={`ajo-decide-${d.id}`}
                      >
                        Decide
                      </Button>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState icon={Gavel} title="No claims." />
          )}
        </View>
      ) : null}

      {tab === 'cases' && canCases ? (
        <View className="gap-3">
          <Text variant="body" tone="secondary">
            A case opens when someone who has already collected stops paying. It keeps a record and can offer a repayment plan. Nothing is taken from other members or guarantors, and nobody is removed automatically.
          </Text>
          {canWrite && manage ? (
            <Card>
              <View className="gap-3">
                <SelectSheet
                  control={control}
                  name="person"
                  label="Open a case by hand"
                  placeholder="Choose a person…"
                  options={(people.data ?? []).filter((p) => p.status === 'ACTIVE').map((p) => ({ value: String(p.membershipId), label: p.name }))}
                  testID="ajo-open-case-person"
                />
                <Button variant="secondary" loading={openCase.isPending} onPress={() => void doOpenCase()} testID="ajo-open-case">
                  Open case
                </Button>
              </View>
            </Card>
          ) : null}
          {cases.isPending ? (
            <AjoLoading />
          ) : cases.isError ? (
            <ErrorState error={cases.error} onRetry={() => cases.refetch()} />
          ) : cases.data.length > 0 ? (
            cases.data.map((c) => (
              <Card key={c.id} testID={`ajo-case-${c.id}`}>
                <View className="gap-2">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text variant="h3" className="flex-1">
                      {c.member}
                    </Text>
                    <AjoStatusBadge status={caseBadge(c.status)} label={CASE_STATUS[c.status]} />
                  </View>
                  <View className="flex-row flex-wrap items-center gap-1">
                    <Text variant="caption" tone="tertiary">
                      Owes
                    </Text>
                    <AjoMoney kobo={c.outstandingNowKobo} />
                    <Text variant="caption" tone="tertiary">
                      now · opened {formatDay(c.openedAt)}
                    </Text>
                  </View>
                  <Button size="sm" variant="secondary" onPress={() => router.push(`/(app)/(tabs)/manage/thrift/case/${c.id}` as never)} testID={`ajo-open-case-${c.id}`}>
                    Open
                  </Button>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState icon={Gavel} title="No cases." />
          )}
        </View>
      ) : null}

      <AjoActionSheet
        ref={waiveSheet}
        title="Waive this late fee"
        summary={waiving ? `${nameOf(waiving.membershipId)}'s late fee of ${formatKobo(waiving.feeKobo)} will never be counted or charged. You can undo a waiver later, with a reason.` : undefined}
        confirmLabel="Waive the fee"
        destructive
        reasonMin={10}
        reasonLabel="Why (it stays on the record)"
        onConfirm={({ reason }) => ajoApi.waiveFee(waiving?.id ?? 0, reason)}
        successMessage="The fee was waived."
        testID="ajo-waive-sheet"
      />
      <AjoActionSheet
        ref={unwaiveSheet}
        title="Undo this waiver"
        summary={unwaiving ? `${nameOf(unwaiving.membershipId)}'s late fee of ${formatKobo(unwaiving.feeKobo)} applies again.` : undefined}
        confirmLabel="Undo the waiver"
        reasonMin={10}
        reasonLabel="Why"
        onConfirm={({ reason }) => ajoApi.reverseWaiver(unwaiving?.id ?? 0, reason)}
        successMessage="The waiver was undone."
        testID="ajo-unwaive-sheet"
      />
      <AjoActionSheet
        ref={toldSheet}
        title="Record that you told them"
        summary={told ? `Use this only when ${nameOf(told.membershipId)} could not be reached by the app or a text, and you told them yourself.` : undefined}
        confirmLabel="Record it"
        reasonMin={5}
        reasonLabel="How you told them (for example, in person at the market)"
        onConfirm={({ reason }) => ajoApi.feeTold(told?.id ?? 0, reason)}
        successMessage="Recorded. The fee becomes payable after 48 hours."
        testID="ajo-told-sheet"
      />
      <AjoActionSheet
        ref={decideSheet}
        title="Decide this claim"
        summary={resolving ? `${nameOf(resolving.membershipId)} says: “${resolving.claim}”. The decision cannot be changed afterwards.` : undefined}
        confirmLabel="Record the decision"
        reasonMin={10}
        reasonLabel="Your reason (the member is told)"
        onConfirm={({ reason }) => ajoApi.resolveDispute(resolving?.id ?? 0, { outcome, reason })}
        successMessage="Decided. The member has been told."
        testID="ajo-decide-sheet"
      >
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            Decision
          </Text>
          <TickRow label="Accept the claim" checked={outcome === 'UPHELD'} onToggle={() => setOutcome('UPHELD')} testID="ajo-decision-upheld" />
          <TickRow label="Do not accept the claim" checked={outcome === 'NOT_UPHELD'} onToggle={() => setOutcome('NOT_UPHELD')} testID="ajo-decision-not-upheld" />
        </View>
      </AjoActionSheet>
    </AjoScreen>
  );
}
