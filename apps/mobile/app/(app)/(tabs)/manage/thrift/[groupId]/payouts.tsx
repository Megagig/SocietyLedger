import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { Wallet } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
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
import { ApprovePayoutSheet, type ApprovePayoutSheetHandle } from '@/features/ajo/components/ApprovePayoutSheet';
import { RecordPaidSheet, type RecordPaidSheetHandle } from '@/features/ajo/components/RecordPaidSheet';
import { formatKobo, formatMoment, koboPositive, ordinal } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import type { PrepareAllResultDTO } from '@/types/api/ajo';
import { useGroupDetail, usePayoutPreview, usePayouts, usePeople } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import type { PayoutDTO } from '@/types/api/ajo';

const STATUS_LABEL: Record<string, string> = { PREPARED: 'Waiting for approval', APPROVED: 'Approved, waiting to be paid', PAID: 'Paid', VOID: 'Cancelled', REVERSED: 'Reversed' };

const targetSchema = z.object({ round: z.string().optional(), person: z.string().optional() });
type TargetValues = z.infer<typeof targetSchema>;

/** THO5: prepare a payout from the confirmed money (and see any shortfall), have an admin approve it, then record that it was paid. */
export default function CirclePayoutsScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { manage, reconcile, approvePayout } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const payouts = usePayouts(groupId);
  const people = usePeople(groupId);
  const rotating = group?.model === 'ROTATING_POT';
  const { control } = useForm<TargetValues>({ resolver: zodResolver(targetSchema), defaultValues: { round: '', person: '' } });
  const round = useWatch({ control, name: 'round' });
  const person = useWatch({ control, name: 'person' });
  const target = rotating ? (round ? { round: Number(round) } : null) : person ? { membershipId: Number(person) } : null;
  const preview = usePayoutPreview(groupId, target ?? {}, !!target && manage);
  const prepare = useAjoAction((body: { round?: number; membershipId?: number }) => ajoApi.preparePayout(groupId, body));
  const complete = useAjoAction<void>(() => ajoApi.completeGroup(groupId));
  const prepareAll = useAjoAction<void, PrepareAllResultDTO>(() => ajoApi.prepareAllPayouts(groupId));
  const [allResult, setAllResult] = useState<PrepareAllResultDTO | null>(null);
  const approveSheet = useRef<ApprovePayoutSheetHandle>(null);
  const paidSheet = useRef<RecordPaidSheetHandle>(null);
  const voidSheet = useRef<BottomSheetModal>(null);
  const failSheet = useRef<BottomSheetModal>(null);
  const reverseSheet = useRef<BottomSheetModal>(null);
  const [voiding, setVoiding] = useState<PayoutDTO | null>(null);
  const [failing, setFailing] = useState<PayoutDTO | null>(null);
  const [reversing, setReversing] = useState<PayoutDTO | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const active = (people.data ?? []).filter((p) => p.status === 'ACTIVE');

  const doPrepare = async () => {
    if (!target) return;
    setProblem(null);
    try {
      await prepare.mutateAsync(target);
      toast.success('Payout prepared. An admin can now approve it.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not prepare the payout.');
    }
  };
  const doComplete = async () => {
    setProblem(null);
    try {
      await complete.mutateAsync();
      toast.success('The circle is completed.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not complete the circle.');
    }
  };

  return (
    <AjoScreen title="Payouts" access={['AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT']} keyboard refreshing={payouts.isRefetching} onRefresh={() => void payouts.refetch()}>
      <Text variant="body" tone="secondary">
        SocietyLedger never sends money. A payout is worked out from the confirmed contributions, approved by an admin, paid by your circle from its own account, and then recorded here with the bank reference.
      </Text>
      {problem ? (
        <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        </View>
      ) : null}

      {manage && canWrite && group?.status === 'ACTIVE' ? (
        <Card testID="ajo-prepare">
          <View className="gap-4">
            <Text variant="h3">Prepare a payout</Text>
            {rotating ? (
              <SelectSheet
                control={control}
                name="round"
                label="Round"
                placeholder="Choose a round…"
                options={Array.from({ length: group.rounds ?? 0 }, (_, i) => ({ value: String(i + 1), label: `Round ${i + 1}` }))}
                testID="ajo-prepare-round"
              />
            ) : (
              <SelectSheet control={control} name="person" label="Person" placeholder="Choose a person…" options={active.map((p) => ({ value: String(p.membershipId), label: p.name }))} testID="ajo-prepare-person" />
            )}
            {target && preview.isPending ? <AjoLoading rows={1} /> : null}
            {target && preview.isError ? <ErrorState error={preview.error} onRetry={() => preview.refetch()} /> : null}
            {preview.data && target ? (
              <View className="gap-3 rounded-lg bg-surface-sunken p-3" testID="ajo-preview">
                <Text variant="body-strong">
                  {preview.data.recipient}
                  {preview.data.round ? ` collects round ${preview.data.round}` : ''}
                </Text>
                {(
                  [
                    ['Scheduled', preview.data.grossKobo],
                    ['Confirmed so far', preview.data.confirmedKobo],
                    ['Collector fee', preview.data.totalFeeKobo],
                    ['To pay out', preview.data.netKobo],
                  ] as const
                ).map(([label, kobo]) => (
                  <View key={label} className="flex-row items-center justify-between">
                    <Text variant="caption" tone="tertiary">
                      {label}
                    </Text>
                    <AjoMoney kobo={kobo} />
                  </View>
                ))}
                {koboPositive(preview.data.shortfallKobo) ? (
                  <View className="gap-1 rounded-md bg-warning-soft p-3">
                    <View className="flex-row items-center gap-2">
                      <Text variant="label" tone="warning">
                        Short by
                      </Text>
                      <AjoMoney kobo={preview.data.shortfallKobo} tone="warning" />
                    </View>
                    {preview.data.shortfall.map((s) => (
                      <Text key={s.membershipId} variant="caption" tone="warning">
                        • {s.name}: {formatKobo(s.shortKobo)}
                      </Text>
                    ))}
                    <Text variant="caption" tone="warning">
                      You can still pay out what has been confirmed. Money that arrives later is paid as a second payout.
                    </Text>
                  </View>
                ) : null}
                {preview.data.recipientArrearsNote ? (
                  <Text variant="caption" tone="secondary">
                    {preview.data.recipientArrearsNote}
                  </Text>
                ) : null}
                {!preview.data.readiness.ok ? (
                  <Text variant="body" tone="danger">
                    {preview.data.readiness.message ?? 'This round is not ready yet.'}
                  </Text>
                ) : null}
                {!preview.data.eligibility.ok ? (
                  <Text variant="body" tone="danger">
                    {preview.data.eligibility.message ?? 'This person cannot be paid out yet.'}
                  </Text>
                ) : null}
                {preview.data.openPayoutId ? (
                  <Text variant="caption" tone="secondary">
                    There is already an open payout for this.
                  </Text>
                ) : null}
                <Button loading={prepare.isPending} disabled={!preview.data.canPrepare} onPress={() => void doPrepare()} testID="ajo-prepare-submit">
                  Prepare this payout
                </Button>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <View className="gap-3">
        <Text variant="h2">Payouts</Text>
        {payouts.isPending ? (
          <AjoLoading />
        ) : payouts.isError ? (
          <ErrorState error={payouts.error} onRetry={() => payouts.refetch()} />
        ) : payouts.data.length > 0 ? (
          payouts.data.map((p) => (
            <Card key={p.id} testID={`ajo-payout-${p.id}`}>
              <View className="gap-2">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="h3">
                      {p.recipient}
                      {p.round ? ` · ${ordinal(p.round)} round` : ''}
                      {p.sequence > 1 ? ` (extra payout ${p.sequence})` : ''}
                    </Text>
                  </View>
                  <AjoMoney kobo={p.netKobo} />
                </View>
                <Text variant="caption" tone="tertiary">
                  {p.account.bankName} · {p.account.masked} · prepared {formatMoment(p.preparedAt)}
                  {p.paidReference ? ` · ref ${p.paidReference}` : ''}
                  {p.voidReason ? ` · ${p.failed ? 'failed' : 'cancelled'}: ${p.voidReason}` : ''}
                  {p.reverseReason ? ` · reversed: ${p.reverseReason}` : ''}
                  {p.selfApprovalConfirmed ? ' · approved by the only admin' : ''}
                </Text>
                <AjoStatusBadge status={p.status === 'PREPARED' ? 'PENDING' : p.status === 'APPROVED' ? 'DUE' : p.status} label={STATUS_LABEL[p.status]} />
                <View className="flex-row flex-wrap gap-2">
                  {canWrite && p.status === 'PREPARED' && approvePayout ? (
                    <Button size="sm" onPress={() => approveSheet.current?.open(p)} testID={`ajo-approve-${p.id}`}>
                      Approve
                    </Button>
                  ) : null}
                  {canWrite && p.status === 'APPROVED' && reconcile ? (
                    <>
                      <Button size="sm" onPress={() => paidSheet.current?.open(p)} testID={`ajo-paid-${p.id}`}>
                        Record as paid
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setFailing(p);
                          failSheet.current?.present();
                        }}
                      >
                        Transfer failed
                      </Button>
                    </>
                  ) : null}
                  {canWrite && (p.status === 'PREPARED' || p.status === 'APPROVED') && (manage || approvePayout) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setVoiding(p);
                        voidSheet.current?.present();
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  {canWrite && p.status === 'PAID' && approvePayout ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setReversing(p);
                        reverseSheet.current?.present();
                      }}
                      testID={`ajo-reverse-payout-${p.id}`}
                    >
                      Reverse
                    </Button>
                  ) : null}
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState icon={Wallet} title="No payouts yet." />
        )}
      </View>

      {manage && canWrite && !rotating && group && (group.status === 'ACTIVE' || group.status === 'COMPLETED') ? (
        <Card>
          <View className="gap-2">
            <Text variant="h3">Prepare everyone&apos;s payout</Text>
            <Text variant="body" tone="secondary">
              At the end of a cycle, prepare a payout for every saver who is ready in one go. Anyone who is not ready (for example no verified payout account) is listed with the reason, and nothing is prepared for them.
            </Text>
            <Button
              loading={prepareAll.isPending}
              onPress={async () => {
                setProblem(null);
                try {
                  setAllResult(await prepareAll.mutateAsync());
                  toast.success('Done. See the list below.');
                } catch (error) {
                  setProblem(error instanceof ApiError ? error.message : 'Could not prepare the payouts.');
                }
              }}
              testID="ajo-prepare-all"
            >
              Prepare all ready payouts
            </Button>
            {allResult ? (
              <View className="gap-1" testID="ajo-prepare-all-result">
                <Text variant="body-strong">
                  {allResult.prepared.length} prepared, {allResult.notReady.length} not ready.
                </Text>
                {allResult.notReady.map((n) => (
                  <Text key={n.membershipId} variant="caption" tone="secondary">
                    • {n.name}: {n.message}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {approvePayout && canWrite && group?.status === 'ACTIVE' ? (
        <Card>
          <View className="gap-2">
            <Text variant="h3">Finish the circle</Text>
            <Text variant="body" tone="secondary">
              When every payout has been made and nothing is open, close the circle. It stays readable and can still be reported on.
            </Text>
            <Button variant="secondary" loading={complete.isPending} onPress={() => void doComplete()} testID="ajo-complete-circle">
              Complete the circle
            </Button>
          </View>
        </Card>
      ) : null}

      <ApprovePayoutSheet ref={approveSheet} />
      <RecordPaidSheet ref={paidSheet} />
      <AjoActionSheet
        ref={voidSheet}
        title="Cancel this payout"
        summary={voiding ? `${voiding.recipient}'s payout of ${formatKobo(voiding.netKobo)} will be cancelled. Nothing has been sent, and a new one can be prepared.` : undefined}
        confirmLabel="Cancel the payout"
        destructive
        reasonMin={5}
        reasonLabel="Why"
        onConfirm={({ reason }) => ajoApi.voidPayout(voiding?.id ?? 0, reason)}
        successMessage="The payout was cancelled. Nothing was paid."
        testID="ajo-void-sheet"
      />
      <AjoActionSheet
        ref={failSheet}
        title="The transfer failed"
        summary={failing ? `The transfer of ${formatKobo(failing.netKobo)} to ${failing.recipient} did not go through. This cancels the payout and tells the admins.` : undefined}
        confirmLabel="Record the failure"
        destructive
        reasonMin={5}
        reasonLabel="What happened"
        onConfirm={({ reason }) => ajoApi.failPayout(failing?.id ?? 0, reason)}
        successMessage="Recorded. The admins have been told."
        testID="ajo-fail-sheet"
      />
      <AjoActionSheet
        ref={reverseSheet}
        title="Reverse a paid payout"
        summary={reversing ? `${reversing.recipient}'s payout of ${formatKobo(reversing.netKobo)} (reference ${reversing.paidReference ?? 'none'}) will be marked reversed and the round goes back to waiting. Do this only if the money came back to the circle.` : undefined}
        confirmLabel="Reverse it"
        destructive
        reasonMin={10}
        reasonLabel="Why is it being reversed"
        needPassword
        onConfirm={({ reason, password }) => ajoApi.reversePayout(reversing?.id ?? 0, { reason, password })}
        successMessage="The payout was reversed and the reason recorded."
        testID="ajo-reverse-payout-sheet"
      />
    </AjoScreen>
  );
}
