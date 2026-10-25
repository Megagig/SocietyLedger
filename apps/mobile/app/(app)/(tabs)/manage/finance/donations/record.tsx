import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
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
import { useRecordDonation } from '@/features/donationsPenalties/mutations';
import { DONATION_RECORD_ACCESS, useActiveAllocations } from '@/features/donationsPenalties/queries';
import { emptyDonationValues, recordDonationSchema, toDonationPayload, type RecordDonationValues } from '@/features/donationsPenalties/schemas';
import { PAYMENT_METHOD_OPTIONS } from '@/features/finance/labels';
import { useActiveCategoriesOfKind } from '@/features/financeSetup/queries';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useCan } from '@/hooks/useCan';
import type { DonationType } from '@/types/api/donationsPenalties';

/**
 * project-overview.md §6.9 FN10 — record a gift to a cause. Instant: the money is received now and the donor gets a receipt. Pledge:
 * a promise to give by a date; it is owed until it is paid.
 */
export default function RecordDonationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const categoryId = Number(params.categoryId);
  const canRecord = useCan(DONATION_RECORD_ACCESS);
  const causes = useActiveCategoriesOfKind('donation');
  const funds = useActiveAllocations();
  const record = useRecordDonation();
  const { control, handleSubmit, setValue } = useForm<RecordDonationValues>({ resolver: zodResolver(recordDonationSchema), defaultValues: emptyDonationValues(), mode: 'onTouched' });
  const donationType = useWatch({ control, name: 'donationType' });
  const back = () => router.back();
  const cause = causes.data?.find((c) => c.id === categoryId);
  const fundOptions = useMemo(() => [{ label: 'No fund (general)', value: '' }, ...(funds.data ?? []).map((f) => ({ label: f.name, value: String(f.id) }))], [funds.data]);

  if (!canRecord) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a donation" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (causes.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Record a donation" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (causes.isError || !cause) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a donation" onBack={back} />
        <ErrorState error={causes.error} title={causes.isError ? undefined : "That cause isn't available."} description={causes.isError ? undefined : 'It was not found or is switched off.'} onRetry={() => causes.refetch()} />
      </Screen>
    );
  }

  const submit = (values: RecordDonationValues) =>
    record.mutate(toDonationPayload(values, cause.id), {
      onSuccess: (result) => {
        if (values.donationType === 'instant') {
          toast.success('Donation recorded');
          router.replace(`/(app)/(tabs)/manage/finance/donations/receipt?id=${result.donationRecord.id}` as never);
        } else {
          toast.success('Pledge recorded — it is owed until it is paid');
          router.back();
        }
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not record the donation. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Record a donation" onBack={back} docsKey="FN10" />

      <View className="gap-6 pb-6">
        <Text variant="body" tone="secondary">
          {`To ${cause.name}`}
        </Text>

        <Section title="Kind of gift">
          <View className="gap-2">
            <SegmentedControl<DonationType>
              options={[
                { label: 'Paid now', value: 'instant' },
                { label: 'Pledge', value: 'pledge' },
              ]}
              value={donationType}
              onChange={(value) => setValue('donationType', value, { shouldValidate: true })}
              testID="donation-type"
            />
            <Text variant="caption" tone="secondary">
              {donationType === 'instant' ? 'The money is received now and the donor gets a receipt.' : 'A promise to give. It is owed until it is paid, and has no receipt yet.'}
            </Text>
          </View>
        </Section>

        <Section title="The gift">
          <View className="gap-4">
            <MemberPickerField control={control} name="member" label="Donor" testID="donation-member" />
            <AmountField control={control} name="amount" label="Amount" helper={cause.amount ? `Suggested: ₦${Number(cause.amount).toLocaleString('en-NG')}` : undefined} presets={[1000, 5000, 10000, 50000]} />
            {donationType === 'instant' ? (
              <SelectSheet control={control} name="paymentMethod" label="How it was paid" options={PAYMENT_METHOD_OPTIONS} placeholder="Choose how it was paid" />
            ) : (
              <DateField control={control} name="pledgeDate" label="Expected date (optional)" minimumDate={new Date()} helper="When the pledge is expected to be paid." />
            )}
            <SelectSheet control={control} name="allocationId" label="Fund (optional)" options={fundOptions} placeholder="No fund (general)" />
          </View>
        </Section>

        <Section title="Donor">
          <View className="gap-4">
            <TextField control={control} name="donorMessage" label="Message from the donor (optional)" multiline />
            <Switch control={control} name="isAnonymous" label="Anonymous" helper="The donor's name is left off the receipt and the list." />
          </View>
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={record.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="donation-save">
            {donationType === 'instant' ? 'Record donation' : 'Record pledge'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
