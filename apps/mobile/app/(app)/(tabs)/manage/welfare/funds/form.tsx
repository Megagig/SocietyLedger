import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
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
import { Text } from '@/components/ui/Text';
import { fundCanDelete, FUND_KIND_OPTIONS, FUND_STATUS_OPTIONS } from '@/features/welfareManage/labels';
import { useCreateFund, useDeleteFund, useUpdateFund } from '@/features/welfareManage/mutations';
import { WELFARE_MANAGE_ACCESS, WELFARE_MODULE, useAdminFunds } from '@/features/welfareManage/queries';
import { emptyFundValues, fundFormSchema, fundToFormValues, toFundPayload, type FundFormValues } from '@/features/welfareManage/schemas';
import { useModuleAccess } from '@/hooks/useModuleAccess';

/**
 * project-overview.md §6.9 WF2 — add a welfare fund, or change one (`?id=`). Closing a fund stops contributions and new requests; a fund
 * with no history can be deleted.
 */
export default function FundFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useModuleAccess(WELFARE_MANAGE_ACCESS, WELFARE_MODULE);
  const list = useAdminFunds();
  const create = useCreateFund();
  const update = useUpdateFund(editId ?? 0);
  const remove = useDeleteFund();
  const deleteRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit, reset } = useForm<FundFormValues>({ resolver: zodResolver(fundFormSchema), defaultValues: emptyFundValues(), mode: 'onTouched' });
  const back = () => router.back();
  const title = isEdit ? 'Edit fund' : 'Add a fund';
  const fund = list.data?.pages.flatMap((p) => p.funds).find((f) => f.id === editId);

  useEffect(() => {
    if (fund) reset(fundToFormValues(fund));
  }, [fund, reset]);

  if (!allowed) {
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

  const submit = (values: FundFormValues) => {
    const payload = toFundPayload(values);
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

  const doDelete = () => {
    if (!fund) return;
    remove.mutate(fund.id, {
      onSuccess: () => {
        deleteRef.current?.dismiss();
        toast.success('Fund deleted');
        router.back();
      },
      onError: (error) => {
        deleteRef.current?.dismiss();
        fail(error);
      },
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="WF2" />

      <View className="gap-6 pb-6">
        <Section title="The fund">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Bereavement fund" autoCapitalize="sentences" testID="fund-name" />
            <SelectSheet control={control} name="fundType" label="Kind of fund" options={FUND_KIND_OPTIONS} placeholder="Choose the kind" />
            <TextField control={control} name="description" label="What it is for (optional)" multiline />
          </View>
        </Section>

        <Section title="Contributions">
          <View className="gap-4">
            <AmountField control={control} name="targetBalance" label="Target balance (optional)" helper="What the fund is aiming to hold." />
            <AmountField control={control} name="monthlyContribution" label="Monthly contribution (optional)" />
            <AmountField control={control} name="minContribution" label="Smallest contribution (optional)" helper="A contribution below this is refused." />
            <Switch control={control} name="isContributionMandatory" label="Contributing is mandatory" helper="Members are expected to contribute every month." />
          </View>
        </Section>

        <Section title="Payouts">
          <View className="gap-4">
            <AmountField control={control} name="maxPayout" label="Most paid out at a time (optional)" helper="A request can't be approved for more than this." />
            <TextField control={control} name="waitingPeriodDays" label="Days a member must wait after joining" keyboardType="number-pad" placeholder="0" />
            <TextField control={control} name="minContributionMonths" label="Months of contributions needed" keyboardType="number-pad" placeholder="0" />
          </View>
        </Section>

        {isEdit ? (
          <Section title="Status">
            <View className="gap-2">
              <SelectSheet control={control} name="status" label="Status" options={FUND_STATUS_OPTIONS} placeholder="Choose" />
              <Text variant="caption" tone="secondary">
                Suspended and closed funds take no new contributions or requests. What they hold and what was paid out stay on record.
              </Text>
            </View>
          </Section>
        ) : null}

        {isEdit && fund && fundCanDelete(fund) ? (
          <Button variant="danger" onPress={() => deleteRef.current?.present()} testID="fund-delete">
            Delete this fund
          </Button>
        ) : null}
        {isEdit && fund && !fundCanDelete(fund) ? (
          <Text variant="caption" tone="secondary">
            This fund has contributions or requests on record, so it can&apos;t be deleted. Close it instead.
          </Text>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="fund-save">
            {isEdit ? 'Save changes' : 'Add fund'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet ref={deleteRef} title="Delete this fund?" description="It has no history, so nothing is lost. This can't be undone." confirmLabel="Delete fund" onConfirm={doDelete} />
    </Screen>
  );
}
