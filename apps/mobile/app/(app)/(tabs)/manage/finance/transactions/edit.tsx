import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ChargeFormFields } from '@/features/finance/components/ChargeFormFields';
import { chargeCanEdit, chargeCanVoid } from '@/features/finance/labels';
import { useEditCharge, useVoidAndReplace } from '@/features/finance/mutations';
import { CHARGE_EDIT_ACCESS, useCharge, useFinanceCategories } from '@/features/finance/queries';
import { buildChargeFormSchema, chargeToFormValues, emptyChargeValues, toChargePayload, type ChargeFormValues, type ChargeMode } from '@/features/finance/schemas';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useCan } from '@/hooks/useCan';

/**
 * project-overview.md §6.9 FN3 — edit a charge nothing has been paid on (`?mode=edit`), or void a paid one and create the corrected
 * replacement (`?mode=void`, which asks for the officer's password).
 */
export default function EditChargeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; mode?: string }>();
  const id = Number(params.id);
  const mode: ChargeMode = params.mode === 'void' ? 'void' : 'edit';
  const canEdit = useCan(CHARGE_EDIT_ACCESS);
  const chargeQuery = useCharge(id);
  const categoriesQuery = useFinanceCategories();
  const edit = useEditCharge(id);
  const voidReplace = useVoidAndReplace(id);
  const schema = useMemo(() => buildChargeFormSchema(mode), [mode]);
  const { control, handleSubmit, reset } = useForm<ChargeFormValues>({ resolver: zodResolver(schema), defaultValues: emptyChargeValues(), mode: 'onTouched' });
  const back = () => router.back();
  const title = mode === 'void' ? 'Void and replace' : 'Edit charge';
  const charge = chargeQuery.data;

  useEffect(() => {
    if (charge) reset(chargeToFormValues(charge));
  }, [charge, reset]);

  if (!canEdit) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (chargeQuery.isPending || categoriesQuery.isPending) {
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

  if (chargeQuery.isError || categoriesQuery.isError || !charge) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={chargeQuery.error ?? categoriesQuery.error} onRetry={() => { void chargeQuery.refetch(); void categoriesQuery.refetch(); }} />
      </Screen>
    );
  }

  const allowed = mode === 'void' ? chargeCanVoid(charge) : chargeCanEdit(charge);
  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState
          title={mode === 'void' ? "This charge can't be voided." : "This charge can't be edited."}
          description={mode === 'void' ? 'It has no payments, or it was already voided.' : 'It has payments on it or was voided. Use Void and replace for a charge that has been paid on.'}
        />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save your changes. Try again.');

  const onSubmit = (values: ChargeFormValues) => {
    const payload = toChargePayload(values);
    if (mode === 'edit') {
      edit.mutate(
        { ...payload, editReason: values.reason.trim() },
        {
          onSuccess: () => {
            toast.success('Charge updated');
            router.back();
          },
          onError: fail,
        },
      );
      return;
    }
    voidReplace.mutate(
      { voidReason: values.reason.trim(), password: values.password, newTransaction: payload },
      {
        onSuccess: (result) => {
          toast.success('Charge voided and replaced');
          router.replace(`/(app)/(tabs)/manage/finance/transactions/${result.newTransaction.id}` as never);
        },
        onError: fail,
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="FN3" />

      <View className="gap-6 pb-6">
        {mode === 'void' ? (
          <View className="gap-1 rounded-lg bg-warning-soft p-4">
            <Text variant="label" tone="warning">
              This charge has payments on it
            </Text>
            <Text variant="body">
              The original is marked voided and a corrected charge is created. The payments stay on the original; the member is asked to pay the new one. The change is kept in the audit trail.
            </Text>
          </View>
        ) : null}

        <Section title={mode === 'void' ? 'The corrected charge' : 'The charge'}>
          <View className="gap-4">
            <MemberPickerField control={control} name="member" label="Member" />
            <ChargeFormFields control={control} categories={categoriesQuery.data ?? []} />
          </View>
        </Section>

        <Section title="Why">
          <View className="gap-4">
            <TextField
              control={control}
              name="reason"
              label={mode === 'void' ? 'Reason for voiding' : 'Reason for the change'}
              placeholder={mode === 'void' ? 'For example: charged the wrong amount' : 'For example: wrong due date'}
              multiline
              testID="charge-reason"
            />
            {mode === 'void' ? <PasswordField control={control} name="password" label="Your password" helper="Voiding changes what a member owes, so we ask you to confirm it is you." testID="charge-password" /> : null}
          </View>
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant={mode === 'void' ? 'danger' : 'primary'} fullWidth loading={edit.isPending || voidReplace.isPending} onPress={() => { void handleSubmit(onSubmit)(); }} testID="charge-edit-save">
            {mode === 'void' ? 'Void and replace' : 'Save changes'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
