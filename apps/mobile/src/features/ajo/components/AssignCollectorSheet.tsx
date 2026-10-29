import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { CollectorCandidateDTO, PersonNameDTO } from '@/types/api/ajo';
import { nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { assignCollectorSchema, type AssignCollectorValues } from '../schemas';
import { TickRow } from './TickRow';

export type AssignCollectorSheetHandle = { open: (preselected?: number) => void };

/** Assign contributors to a collector, with an optional daily target. A person has one collector at a time. */
export const AssignCollectorSheet = forwardRef<AssignCollectorSheetHandle, { people: PersonNameDTO[]; candidates: CollectorCandidateDTO[] }>(function AssignCollectorSheet({ people, candidates }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  // A choice list, not a SelectSheet: a sheet never opens on top of another sheet.
  const [collector, setCollector] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<AssignCollectorValues>({ resolver: zodResolver(assignCollectorSchema), defaultValues: { target: '' }, mode: 'onTouched' });
  const assign = useAjoAction((input: { membershipId: number; collectorUserId: number; dailyTargetKobo: string | null }) =>
    ajoApi.assignCollector(input.membershipId, { collectorUserId: input.collectorUserId, dailyTargetKobo: input.dailyTargetKobo }),
  );
  useImperativeHandle(
    ref,
    () => ({
      open: (preselected) => {
        setChosen(new Set(preselected ? [preselected] : []));
        setCollector(null);
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [],
  );

  const submit = handleSubmit(async (values) => {
    if (collector === null) {
      setProblem('Choose the collector.');
      return;
    }
    if (chosen.size === 0) {
      setProblem('Choose at least one person.');
      return;
    }
    const dailyTargetKobo = values.target?.trim() ? nairaToKoboString(values.target) : null;
    setProblem(null);
    try {
      for (const membershipId of chosen) await assign.mutateAsync({ membershipId, collectorUserId: collector, dailyTargetKobo });
      toast.success(`${chosen.size} ${chosen.size === 1 ? 'person was' : 'people were'} assigned.`);
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not assign them.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="Assign contributors to a collector"
      snapPoints={['92%']}
      onDismiss={() => {
        reset();
        setChosen(new Set());
        setProblem(null);
      }}
    >
      <View className="gap-4 pb-6">
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            Collector
          </Text>
          {candidates.length === 0 ? (
            <Text variant="caption" tone="tertiary">
              No one has the collector permission yet.
            </Text>
          ) : (
            candidates.map((c) => <TickRow key={c.userId} label={c.name} meta={c.email} checked={collector === c.userId} onToggle={() => setCollector(c.userId)} testID={`ajo-assign-collector-${c.userId}`} />)
          )}
        </View>
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            Contributors
          </Text>
          {people.map((p) => (
            <TickRow
              key={p.membershipId}
              label={p.name}
              checked={chosen.has(p.membershipId)}
              onToggle={() =>
                setChosen((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.membershipId)) next.delete(p.membershipId);
                  else next.add(p.membershipId);
                  return next;
                })
              }
              testID={`ajo-assign-tick-${p.membershipId}`}
            />
          ))}
        </View>
        <TextField control={control} name="target" label="Daily target (₦, optional)" helper="What you expect this collector to bring in each day from these people." keyboardType="decimal-pad" testID="ajo-assign-target" />
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={assign.isPending} onPress={() => void submit()} testID="ajo-assign-submit">
            Assign
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
