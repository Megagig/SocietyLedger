import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { INTEREST_TYPE_OPTIONS } from '@/features/coopManage/labels';
import { useCreateProduct, useUpdateProduct } from '@/features/coopManage/mutations';
import { COOP_LOANS_ACCESS, COOP_MODULE, useLoanProducts } from '@/features/coopManage/queries';
import { emptyProductValues, productFormSchema, productToFormValues, toProductPayload, type ProductFormValues } from '@/features/coopManage/schemas';
import { useModuleAccess } from '@/hooks/useModuleAccess';

/**
 * project-overview.md §6.9 CP3 — add a loan product, or change one (`?id=`). A change applies to loans applied for afterwards; loans
 * already paid out and applications already made keep the terms they were made with.
 */
export default function ProductFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const list = useLoanProducts();
  const create = useCreateProduct();
  const update = useUpdateProduct(editId ?? 0);
  const { control, handleSubmit, reset } = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: emptyProductValues(), mode: 'onTouched' });
  const requiresGuarantor = useWatch({ control, name: 'requiresGuarantor' });
  const back = () => router.back();
  const title = isEdit ? 'Edit loan product' : 'Add a loan product';
  const product = list.data?.pages.flatMap((p) => p.products).find((p) => p.id === editId);

  useEffect(() => {
    if (product) reset(productToFormValues(product));
  }, [product, reset]);

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

  if (isEdit && (list.isError || !product)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={list.error} title={list.isError ? undefined : 'Loan product not found'} onRetry={() => list.refetch()} />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the loan product. Try again.');

  const submit = (values: ProductFormValues) => {
    const payload = toProductPayload(values);
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        router.back();
      },
      onError: fail,
    });
    if (isEdit) update.mutate(payload, done('Loan product updated'));
    else create.mutate(payload, done('Loan product added'));
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="CP3" />

      <View className="gap-6 pb-6">
        <Section title="The product">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Emergency loan" autoCapitalize="sentences" testID="product-name" />
            <TextField control={control} name="description" label="Description (optional)" multiline />
          </View>
        </Section>

        <Section title="Amount and time">
          <View className="gap-4">
            <AmountField control={control} name="minAmount" label="Smallest loan" presets={[10000, 50000, 100000]} />
            <AmountField control={control} name="maxAmount" label="Largest loan" presets={[100000, 500000, 1000000]} />
            <TextField control={control} name="minTenureMonths" label="Shortest tenure (months)" keyboardType="number-pad" />
            <TextField control={control} name="maxTenureMonths" label="Longest tenure (months)" keyboardType="number-pad" />
          </View>
        </Section>

        <Section title="Interest and fees">
          <View className="gap-4">
            <TextField control={control} name="interestRate" label="Interest rate (% a year)" keyboardType="decimal-pad" placeholder="10" />
            <SelectSheet control={control} name="interestType" label="How interest is worked out" options={INTEREST_TYPE_OPTIONS} placeholder="Choose" />
            <TextField control={control} name="processingFeePercent" label="Processing fee (% of the loan, optional)" keyboardType="decimal-pad" />
            <AmountField control={control} name="processingFeeFixed" label="Processing fee (fixed, optional)" />
          </View>
        </Section>

        <Section title="Guarantors and savings">
          <View className="gap-4">
            <Switch control={control} name="requiresGuarantor" label="Needs guarantors" helper="Members must find guarantors who accept before an officer can approve." />
            {requiresGuarantor ? <TextField control={control} name="minGuarantors" label="Guarantors needed" keyboardType="number-pad" /> : null}
            <TextField
              control={control}
              name="maxLoanToSavingsRatio"
              label="Borrow up to (times their available savings, optional)"
              keyboardType="decimal-pad"
              helper="For example 2 lets a member borrow up to twice what they have saved."
            />
            <Switch control={control} name="lockSavings" label="Hold savings against the loan" helper="Part of the member's savings can't be withdrawn until the loan is repaid." />
          </View>
        </Section>

        <Section title="Late repayment">
          <View className="gap-4">
            <TextField control={control} name="gracePeriodDays" label="Grace period (days, optional)" keyboardType="number-pad" />
            <TextField control={control} name="lateFeePercent" label="Late fee (% of the instalment, optional)" keyboardType="decimal-pad" />
            <AmountField control={control} name="lateFeeFixed" label="Late fee (fixed, optional)" />
          </View>
        </Section>

        <Section title="Status">
          <Switch control={control} name="isActive" label="On" helper="A switched-off product can't be applied for. Loans already made are not affected." />
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="product-save">
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
