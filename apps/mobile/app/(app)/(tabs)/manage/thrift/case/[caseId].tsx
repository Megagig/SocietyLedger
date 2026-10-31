import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
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
import { useCase } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';

const noteSchema = z.object({ note: z.string().trim().min(2, 'Write a short note.').max(500) });

/** One default case: the repayment plans, the file of notes, and — with the password typed again — closing it. */
export default function CaseDetailScreen() {
  const params = useLocalSearchParams<{ caseId?: string }>();
  const caseId = Number(params.caseId) || 0;
  const { canWrite } = useAjoWrite();
  const { manage, approvePayout } = useAjoCan();
  const detail = useCase(caseId);
  const c = detail.data;
  const open = c ? c.status === 'OPEN' || c.status === 'PLAN_AGREED' : false;
  const addNote = useAjoAction((text: string) => ajoApi.addCaseNote(caseId, text));
  const draft = useAjoAction<void>(() => ajoApi.draftPlan(caseId));
  const { control, handleSubmit, reset } = useForm<{ note: string }>({ resolver: zodResolver(noteSchema), defaultValues: { note: '' } });
  const agreeSheet = useRef<BottomSheetModal>(null);
  const cancelSheet = useRef<BottomSheetModal>(null);
  const closeSheet = useRef<BottomSheetModal>(null);
  const [agreeing, setAgreeing] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'RESOLVED' | 'CLOSED_UNRESOLVED'>('RESOLVED');
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setProblem(null);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  };
  const submitNote = handleSubmit(async ({ note }) => {
    await run(() => addNote.mutateAsync(note), 'Note added.');
    reset();
  });

  return (
    <AjoScreen title={c ? `Case: ${c.member}` : 'Case'} access={['AJO_MANAGE', 'AJO_APPROVE_PAYOUT']} keyboard refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
      {detail.isPending ? (
        <AjoLoading rows={2} />
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : c ? (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <AjoStatusBadge status={caseBadge(c.status)} label={CASE_STATUS[c.status]} />
            <Text variant="caption" tone="tertiary">
              opened {formatMoment(c.openedAt)}
            </Text>
          </View>
          <Card>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="tertiary">
                  Owed when it opened
                </Text>
                <AjoMoney kobo={c.outstandingAtOpeningKobo} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="tertiary">
                  Owed now
                </Text>
                <AjoMoney kobo={c.outstandingNowKobo} />
              </View>
            </View>
          </Card>
          {c.memberResponse ? (
            <View className="rounded-lg bg-surface-sunken p-3">
              <Text variant="body">The member says: {c.memberResponse}</Text>
            </View>
          ) : null}
          {c.resolution ? <Text variant="body">Outcome: {c.resolution}</Text> : null}
          {problem ? (
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          ) : null}

          <View className="gap-3">
            <Text variant="h2">Repayment plans</Text>
            {c.plans.length === 0 ? (
              <Text variant="body" tone="tertiary">
                No plan has been offered.
              </Text>
            ) : (
              c.plans.map((p) => (
                <Card key={p.id} testID={`ajo-plan-${p.id}`}>
                  <View className="gap-2">
                    <Text variant="body-strong">
                      {p.status === 'PROPOSED'
                        ? 'Offered, not agreed yet'
                        : p.status === 'ACTIVE'
                          ? `Agreed ${p.agreedAt ? formatMoment(p.agreedAt) : ''}${p.agreedVia ? ` (${p.agreedVia})` : ''}`
                          : p.status === 'COMPLETED'
                            ? 'Paid in full'
                            : `Cancelled${p.cancelReason ? `: ${p.cancelReason}` : ''}`}
                    </Text>
                    {p.schedule.map((l) => (
                      <Text key={l.dueDate} variant="caption" tone="secondary">
                        {formatDay(l.dueDate)}: {formatKobo(l.amountKobo)}
                      </Text>
                    ))}
                    {canWrite && manage ? (
                      <View className="flex-row flex-wrap gap-2">
                        {p.status === 'PROPOSED' ? (
                          <Button
                            size="sm"
                            onPress={() => {
                              setAgreeing(p.id);
                              agreeSheet.current?.present();
                            }}
                            testID={`ajo-agree-plan-${p.id}`}
                          >
                            Record agreement
                          </Button>
                        ) : null}
                        {p.status === 'PROPOSED' || p.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => {
                              setCancelling(p.id);
                              cancelSheet.current?.present();
                            }}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Card>
              ))
            )}
            {canWrite && manage && open ? (
              <Button variant="secondary" loading={draft.isPending} onPress={() => void run(() => draft.mutateAsync(), 'A plan was drafted and offered to the member.')} testID="ajo-draft-plan">
                Draft a new plan
              </Button>
            ) : null}
          </View>

          <View className="gap-3">
            <Text variant="h2">The file</Text>
            {(c.events ?? []).map((e) => (
              <Text key={e.id} variant="body">
                <Text variant="caption" tone="tertiary">
                  {formatMoment(e.createdAt)} ·{' '}
                </Text>
                {e.note ?? e.kind}
              </Text>
            ))}
            {canWrite && manage && open ? (
              <View className="gap-2">
                <TextField control={control} name="note" label="Add a note to the file" multiline testID="ajo-case-note" />
                <Button variant="secondary" loading={addNote.isPending} onPress={() => void submitNote()} testID="ajo-case-note-add">
                  Add
                </Button>
              </View>
            ) : null}
          </View>

          {canWrite && approvePayout && open ? (
            <Button
              variant="danger"
              onPress={() => {
                setOutcome('RESOLVED');
                closeSheet.current?.present();
              }}
              testID="ajo-close-case"
            >
              Close this case
            </Button>
          ) : null}

          <AjoActionSheet
            ref={agreeSheet}
            title="Record the member's agreement"
            summary="A plan is a promise about timing. While it is kept, no new late fees land on what it covers."
            confirmLabel="Record agreement"
            reasonMin={5}
            reasonLabel="How they agreed (for example, by phone on 5 March)"
            onConfirm={({ reason }) => ajoApi.agreePlan(agreeing ?? 0, reason)}
            successMessage="The plan is agreed."
            testID="ajo-agree-sheet"
          />
          <AjoActionSheet
            ref={cancelSheet}
            title="Cancel this plan"
            summary="With no plan standing, late fees on the covered payments start again."
            confirmLabel="Cancel the plan"
            destructive
            reasonMin={10}
            reasonLabel="Why"
            onConfirm={({ reason }) => ajoApi.cancelPlan(cancelling ?? 0, reason)}
            successMessage="The plan was cancelled."
            testID="ajo-cancel-plan-sheet"
          />
          <AjoActionSheet
            ref={closeSheet}
            title="Close this case"
            summary="Closing records how the circle decided to end it. Nothing is taken from anyone, and the member stays in the circle."
            confirmLabel="Close the case"
            destructive
            reasonMin={10}
            reasonLabel="The outcome, in words (it stays on the record)"
            needPassword
            onConfirm={({ reason, password }) => ajoApi.closeCase(c.id, { password, outcome, reason })}
            successMessage="The case is closed."
            testID="ajo-close-case-sheet"
          >
            <View className="gap-2">
              <Text variant="label" tone="secondary">
                Outcome
              </Text>
              <TickRow label="Resolved" checked={outcome === 'RESOLVED'} onToggle={() => setOutcome('RESOLVED')} testID="ajo-outcome-resolved" />
              <TickRow label="Closed, not resolved" checked={outcome === 'CLOSED_UNRESOLVED'} onToggle={() => setOutcome('CLOSED_UNRESOLVED')} testID="ajo-outcome-unresolved" />
            </View>
          </AjoActionSheet>
        </>
      ) : null}
    </AjoScreen>
  );
}
