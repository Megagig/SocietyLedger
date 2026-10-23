import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { allActiveMemberIds } from '@/features/finance/allActiveMemberIds';
import { ChargeFormFields } from '@/features/finance/components/ChargeFormFields';
import { MembersMultiPickerSheet, type PickedMemberRef } from '@/features/finance/components/MembersMultiPickerSheet';
import { useCreateBulkCharges } from '@/features/finance/mutations';
import { CHARGE_CREATE_ACCESS, useFinanceCategories } from '@/features/finance/queries';
import { bulkFormSchema, dueDateToIso, parseAmount, type BulkFormValues, type BulkTarget } from '@/features/finance/schemas';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 FN7 — generate dues: pick a due category, the amount and due date, and charge every active member or the ones you
 * choose. A levy category can be passed in (`?categoryId=`) to charge a levy type straight to members without a campaign.
 */
export default function DuesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const canCreate = useCan(CHARGE_CREATE_ACCESS);
  const categoriesQuery = useFinanceCategories();
  const createMany = useCreateBulkCharges();
  const [target, setTarget] = useState<BulkTarget>('all');
  const [chosen, setChosen] = useState<PickedMemberRef[]>([]);
  const [resolving, setResolving] = useState(false);
  const pickerRef = useRef<BottomSheetModal>(null);
  const wanted = params.categoryId ? Number(params.categoryId) : null;
  const { control, handleSubmit, setValue } = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: { categoryId: wanted ? String(wanted) : '', amount: '', dueDate: '', notes: '' },
    mode: 'onTouched',
  });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const amountText = useWatch({ control, name: 'amount' });
  const back = () => router.back();

  // Due categories, plus the levy category the officer came to assign.
  const categories = useMemo(() => (categoriesQuery.data ?? []).filter((c) => c.type === 'due' || c.id === wanted), [categoriesQuery.data, wanted]);

  // Choosing a category fills in its default amount.
  useEffect(() => {
    const picked = categories.find((c) => String(c.id) === categoryId);
    if (picked?.amount) setValue('amount', String(Number(picked.amount)), { shouldValidate: false });
  }, [categoryId, categories, setValue]);

  if (!canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Generate dues" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (categoriesQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Generate dues" onBack={back} />
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
        <ScreenHeader title="Generate dues" onBack={back} />
        <ErrorState error={categoriesQuery.error} onRetry={() => categoriesQuery.refetch()} />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not generate the dues. Try again.');
  const amount = parseAmount(amountText);

  const generate = async (values: BulkFormValues) => {
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
          router.replace('/(app)/(tabs)/manage/finance/transactions?kind=due' as never);
        },
        onError: fail,
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader
        title="Generate dues"
        onBack={back}
        docsKey="FN7"
        rightActions={<IconButton icon={ListChecks} accessibilityLabel="See dues charged" onPress={() => router.push('/(app)/(tabs)/manage/finance/transactions?kind=due' as never)} testID="dues-see" />}
      />

      <View className="gap-6 pb-6">
        {categories.length === 0 ? (
          <View className="gap-2 rounded-lg bg-warning-soft p-4">
            <Text variant="body-strong">No dues category yet</Text>
            <Text variant="caption" tone="secondary">
              Add a dues category first — it holds the default amount and how often it is charged.
            </Text>
            <Button variant="secondary" onPress={() => router.push('/(app)/(tabs)/manage/finance/categories/form?type=due' as never)} testID="dues-add-category">
              Add a dues category
            </Button>
          </View>
        ) : null}

        <Section title="What to charge">
          <ChargeFormFields control={control} categories={categories} />
        </Section>

        <Section title="Who">
          <View className="gap-3">
            <SegmentedControl<BulkTarget>
              options={[
                { label: 'All active members', value: 'all' },
                { label: 'Choose members', value: 'chosen' },
              ]}
              value={target}
              onChange={setTarget}
              testID="dues-target"
            />
            {target === 'chosen' ? (
              <Button variant="secondary" onPress={() => pickerRef.current?.present()} testID="dues-choose-members">
                {chosen.length === 0 ? 'Choose members' : `${chosen.length} chosen — change`}
              </Button>
            ) : (
              <Text variant="caption" tone="secondary">
                Every active member gets the same charge. Suspended and disabled members are left out.
              </Text>
            )}
          </View>
        </Section>

        {amount !== null ? (
          <View className="gap-1 rounded-lg bg-surface-sunken p-4" testID="dues-summary">
            <Text variant="label">Summary</Text>
            <Text variant="body">
              {target === 'chosen'
                ? `${chosen.length} ${chosen.length === 1 ? 'member' : 'members'} × ${formatMoney(amount)} = ${formatMoney(amount * chosen.length)}`
                : `${formatMoney(amount)} for each active member`}
            </Text>
          </View>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={createMany.isPending || resolving} onPress={() => { void handleSubmit(generate)(); }} testID="dues-generate">
            {target === 'all' ? 'Generate dues for all members' : `Generate dues for ${chosen.length || ''} members`.replace('  ', ' ')}
          </Button>
        </View>
      </StickyFooter>

      <MembersMultiPickerSheet ref={pickerRef} selected={chosen} onChange={setChosen} />
    </Screen>
  );
}
