import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { allActiveMemberIds } from '@/features/finance/allActiveMemberIds';
import { ChargeFormFields } from '@/features/finance/components/ChargeFormFields';
import { MembersMultiPickerSheet, type PickedMemberRef } from '@/features/finance/components/MembersMultiPickerSheet';
import { useCreateBulkCharges, useCreateCharge } from '@/features/finance/mutations';
import { CHARGE_CREATE_ACCESS, useFinanceCategories } from '@/features/finance/queries';
import { buildChargeFormSchema, bulkFormSchema, dueDateToIso, emptyChargeValues, parseAmount, toChargePayload, type BulkFormValues, type BulkTarget, type ChargeFormValues } from '@/features/finance/schemas';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useCan } from '@/hooks/useCan';

type Mode = 'single' | 'bulk';
const singleSchema = buildChargeFormSchema('create');

/** project-overview.md §6.9 FN4 — charge one member, or many at once (all active members, or the ones you choose). */
export default function NewChargeScreen() {
  const router = useRouter();
  const canCreate = useCan(CHARGE_CREATE_ACCESS);
  const categoriesQuery = useFinanceCategories();
  const createOne = useCreateCharge();
  const createMany = useCreateBulkCharges();
  const [mode, setMode] = useState<Mode>('single');
  const [target, setTarget] = useState<BulkTarget>('all');
  const [chosen, setChosen] = useState<PickedMemberRef[]>([]);
  const [resolving, setResolving] = useState(false);
  const pickerRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  const single = useForm<ChargeFormValues>({ resolver: zodResolver(singleSchema), defaultValues: emptyChargeValues(), mode: 'onTouched' });
  const bulk = useForm<BulkFormValues>({ resolver: zodResolver(bulkFormSchema), defaultValues: { categoryId: '', amount: '', dueDate: '', notes: '' }, mode: 'onTouched' });

  if (!canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Charge members" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (categoriesQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Charge members" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Charge members" onBack={back} />
        <ErrorState error={categoriesQuery.error} onRetry={() => categoriesQuery.refetch()} />
      </Screen>
    );
  }

  const categories = categoriesQuery.data ?? [];
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the charge. Try again.');

  const saveSingle = (values: ChargeFormValues) =>
    createOne.mutate(toChargePayload(values), {
      onSuccess: (created) => {
        toast.success('Charge created');
        router.replace(`/(app)/(tabs)/manage/finance/transactions/${created.id}` as never);
      },
      onError: fail,
    });

  const saveBulk = async (values: BulkFormValues) => {
    let memberIds: number[];
    if (target === 'all') {
      setResolving(true);
      try {
        memberIds = await allActiveMemberIds();
      } catch (error) {
        setResolving(false);
        fail(error);
        return;
      }
      setResolving(false);
    } else {
      memberIds = chosen.map((m) => m.id);
    }
    if (memberIds.length === 0) {
      toast.error(target === 'all' ? 'There are no active members to charge.' : 'Choose at least one member.');
      return;
    }
    createMany.mutate(
      { categoryId: Number(values.categoryId), memberIds, amount: parseAmount(values.amount) ?? 0, dueDate: dueDateToIso(values.dueDate), notes: values.notes.trim() || null },
      {
        onSuccess: () => {
          toast.success(`Charged ${memberIds.length} ${memberIds.length === 1 ? 'member' : 'members'}`);
          router.replace('/(app)/(tabs)/manage/finance/transactions' as never);
        },
        onError: fail,
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Charge members" onBack={back} docsKey="FN4" />

      <View className="gap-6 pb-6">
        <SegmentedControl<Mode>
          options={[
            { label: 'One member', value: 'single' },
            { label: 'Many members', value: 'bulk' },
          ]}
          value={mode}
          onChange={setMode}
          testID="charge-mode"
        />

        {mode === 'single' ? (
          <Section title="The charge">
            <View className="gap-4">
              <MemberPickerField control={single.control} name="member" label="Member" testID="charge-member-picker" />
              <ChargeFormFields control={single.control} categories={categories} />
            </View>
          </Section>
        ) : (
          <>
            <Section title="Who">
              <View className="gap-3">
                <SegmentedControl<BulkTarget>
                  options={[
                    { label: 'All active members', value: 'all' },
                    { label: 'Choose members', value: 'chosen' },
                  ]}
                  value={target}
                  onChange={setTarget}
                  testID="charge-target"
                />
                {target === 'chosen' ? (
                  <Button variant="secondary" onPress={() => pickerRef.current?.present()} testID="charge-choose-members">
                    {chosen.length === 0 ? 'Choose members' : `${chosen.length} chosen — change`}
                  </Button>
                ) : (
                  <Text variant="caption" tone="secondary">
                    Every active member gets the same charge. Suspended and disabled members are left out.
                  </Text>
                )}
              </View>
            </Section>
            <Section title="The charge">
              <ChargeFormFields control={bulk.control} categories={categories} />
            </Section>
          </>
        )}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            loading={createOne.isPending || createMany.isPending || resolving}
            onPress={() => {
              if (mode === 'single') void single.handleSubmit(saveSingle)();
              else void bulk.handleSubmit(saveBulk)();
            }}
            testID="charge-save"
          >
            {mode === 'single' ? 'Create charge' : target === 'all' ? 'Charge all members' : `Charge ${chosen.length || ''} members`.replace('  ', ' ')}
          </Button>
        </View>
      </StickyFooter>

      <MembersMultiPickerSheet ref={pickerRef} selected={chosen} onChange={setChosen} />
    </Screen>
  );
}
