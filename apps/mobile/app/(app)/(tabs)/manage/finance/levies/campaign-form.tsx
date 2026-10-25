import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { campaignCanEdit } from '@/features/financeSetup/labels';
import { useCreateCampaign, useUpdateCampaign } from '@/features/financeSetup/mutations';
import { SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useActiveCategoriesOfKind, useCampaign } from '@/features/financeSetup/queries';
import { campaignFormSchema, campaignToFormValues, deadlineInPast, emptyCampaignValues, toCampaignPayload, type CampaignFormValues } from '@/features/financeSetup/schemas';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 FN8/FN9 — start a levy campaign, or change one (`?id=`). The levy category can't change once the campaign exists. */
export default function CampaignFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const canCreate = useCan(SETUP_CREATE_ACCESS);
  const canEdit = useCan(SETUP_EDIT_ACCESS);
  const campaignQuery = useCampaign(editId ?? NaN);
  const levyTypes = useActiveCategoriesOfKind('levy');
  const create = useCreateCampaign();
  const update = useUpdateCampaign(editId ?? 0);
  const { control, handleSubmit, reset, setError } = useForm<CampaignFormValues>({ resolver: zodResolver(campaignFormSchema), defaultValues: emptyCampaignValues(), mode: 'onTouched' });
  const back = () => router.back();
  const title = isEdit ? 'Edit campaign' : 'Start a campaign';
  const campaign = campaignQuery.data;
  const options = useMemo(() => (levyTypes.data ?? []).map((c) => ({ label: c.name, value: String(c.id) })), [levyTypes.data]);

  useEffect(() => {
    if (campaign) reset(campaignToFormValues(campaign));
  }, [campaign, reset]);

  if (isEdit ? !canEdit : !canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if ((isEdit && campaignQuery.isPending) || levyTypes.isPending) {
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

  if (isEdit && (campaignQuery.isError || !campaign)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={campaignQuery.error} onRetry={() => campaignQuery.refetch()} />
      </Screen>
    );
  }

  if (isEdit && campaign && !campaignCanEdit(campaign.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState title="This campaign can't be edited." description="It is completed or cancelled, so it is kept as a record." />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the campaign. Try again.');

  const onSubmit = (values: CampaignFormValues) => {
    const deadlineChanged = !isEdit || new Date(values.deadline).toDateString() !== new Date(campaign!.deadline).toDateString();
    if (deadlineChanged && deadlineInPast(values.deadline)) {
      setError('deadline', { message: "The deadline can't be in the past" });
      return;
    }
    const payload = toCampaignPayload(values);
    if (isEdit) {
      const { categoryId: _categoryId, ...changes } = payload;
      update.mutate(changes, {
        onSuccess: () => {
          toast.success('Campaign updated');
          router.back();
        },
        onError: fail,
      });
      return;
    }
    create.mutate(payload, {
      onSuccess: (created) => {
        toast.success('Campaign started — now put members on it');
        router.replace(`/(app)/(tabs)/manage/finance/levies/${created.id}` as never);
      },
      onError: fail,
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="FN8" />

      <View className="gap-6 pb-6">
        <Section title="The campaign">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="2026 Building fund drive" autoCapitalize="sentences" testID="campaign-name" />
            {isEdit ? (
              <View className="gap-1">
                <Text variant="label">Levy type</Text>
                <Text variant="body">{campaign?.category.name}</Text>
                <Text variant="caption" tone="secondary">
                  The levy type can&apos;t change once a campaign has started.
                </Text>
              </View>
            ) : options.length === 0 ? (
              <View className="gap-2 rounded-lg bg-warning-soft p-4">
                <Text variant="body-strong">No levy type yet</Text>
                <Text variant="caption" tone="secondary">
                  A campaign is raised under a levy type. Add one first.
                </Text>
                <Button variant="secondary" onPress={() => router.push('/(app)/(tabs)/manage/finance/categories/form?type=levy' as never)} testID="campaign-add-type">
                  Add a levy type
                </Button>
              </View>
            ) : (
              <SelectSheet control={control} name="categoryId" label="Levy type" options={options} placeholder="Choose the levy type" testID="campaign-category" />
            )}
            <TextField control={control} name="description" label="What it is for (optional)" multiline />
          </View>
        </Section>

        <Section title="The money">
          <View className="gap-4">
            <AmountField control={control} name="targetAmount" label="Total to raise" presets={[100000, 500000, 1000000]} />
            <AmountField control={control} name="amountPerMember" label="Amount per member (optional)" helper="What each member is charged. You can set a different amount when you put members on the campaign." presets={[5000, 10000, 20000]} />
          </View>
        </Section>

        <Section title="When">
          <DateField control={control} name="deadline" label="Deadline" minimumDate={isEdit ? undefined : new Date()} testID="campaign-deadline" />
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(onSubmit)(); }} testID="campaign-save">
            {isEdit ? 'Save changes' : 'Start campaign'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
