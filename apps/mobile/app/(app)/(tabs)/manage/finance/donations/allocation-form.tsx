import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ALLOCATION_KIND_OPTIONS } from '@/features/donationsPenalties/labels';
import { useCreateAllocation, useUpdateAllocation } from '@/features/donationsPenalties/mutations';
import { FUND_CREATE_ACCESS, FUND_EDIT_ACCESS, useAllocations } from '@/features/donationsPenalties/queries';
import { allocationFormSchema, allocationToFormValues, emptyAllocationValues, toAllocationPayload, type AllocationFormValues } from '@/features/donationsPenalties/schemas';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 FN10 — add a fund a gift can be directed into, or change one (`?id=`). */
export default function AllocationFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const canCreate = useCan(FUND_CREATE_ACCESS);
  const canEdit = useCan(FUND_EDIT_ACCESS);
  const list = useAllocations();
  const create = useCreateAllocation();
  const update = useUpdateAllocation(editId ?? 0);
  const { control, handleSubmit, reset } = useForm<AllocationFormValues>({ resolver: zodResolver(allocationFormSchema), defaultValues: emptyAllocationValues(), mode: 'onTouched' });
  const back = () => router.back();
  const title = isEdit ? 'Edit fund' : 'Add a fund';
  const fund = list.data?.pages.flatMap((p) => p.allocations).find((a) => a.id === editId);

  useEffect(() => {
    if (fund) reset(allocationToFormValues(fund));
  }, [fund, reset]);

  if (isEdit ? !canEdit : !canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (isEdit && list.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (isEdit && (list.isError || !fund)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={list.error} title={list.isError ? undefined : 'Fund not found'} onRetry={() => list.refetch()} />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the fund. Try again.');

  const onSubmit = (values: AllocationFormValues) => {
    const payload = toAllocationPayload(values);
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        router.back();
      },
      onError: fail,
    });
    if (isEdit) update.mutate(payload, done('Fund updated'));
    else create.mutate(payload, done('Fund added'));
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="FN10" />

      <View className="gap-6 pb-6">
        <Section title="The fund">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Hall roof repairs" autoCapitalize="sentences" testID="fund-name" />
            <SelectSheet control={control} name="type" label="Kind" options={ALLOCATION_KIND_OPTIONS} placeholder="Choose the kind" />
            <TextField control={control} name="description" label="What it is for (optional)" multiline />
          </View>
        </Section>

        <Section title="Target">
          <AmountField control={control} name="targetAmount" label="Target (optional)" helper="The amount you want to raise. Leave it blank for a fund with no target." presets={[100000, 500000, 1000000]} />
        </Section>

        {isEdit ? (
          <Section title="Status">
            <Switch control={control} name="isActive" label="Active" helper="A switched-off fund can't be chosen for new gifts. Gifts already in it stay." />
          </Section>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(onSubmit)(); }} testID="fund-save">
            {isEdit ? 'Save changes' : 'Add fund'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
