import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMakeDonation } from '@/features/memberFinance/mutations';
import { useMemberDonations } from '@/features/memberFinance/queries';

const donateSchema = z.object({
  categoryId: z.string().min(1, 'Please select a cause'),
  amount: z
    .string()
    .min(1, 'Enter an amount')
    .refine((v) => Number(v.replace(/,/g, '')) > 0, 'Amount must be greater than 0'),
  notes: z.string().optional(),
  isAnonymous: z.boolean().optional(),
});

type DonateForm = z.infer<typeof donateSchema>;

/**
 * Make a donation. This is a screen, not a bottom sheet: the cause picker is itself a bottom sheet, and opening one sheet from inside
 * another closes the first (so the form used to vanish when "Select a cause" was tapped).
 */
export default function NewDonationScreen() {
  const router = useRouter();
  const donationsQuery = useMemberDonations();
  const makeDonation = useMakeDonation();
  const categoryOptions = (donationsQuery.data?.donationCategories ?? []).map((c) => ({ label: c.name, value: String(c.id) }));

  const { control, handleSubmit } = useForm<DonateForm>({
    resolver: zodResolver(donateSchema),
    defaultValues: { categoryId: '', amount: '', notes: '', isAnonymous: false },
  });

  const onSubmit = (values: DonateForm) =>
    makeDonation.mutate(
      {
        categoryId: Number(values.categoryId),
        amount: Number(values.amount.replace(/,/g, '')),
        paymentMethod: 'bank_transfer',
        notes: values.notes || undefined,
        isAnonymous: values.isAnonymous ?? false,
      },
      {
        onSuccess: () => {
          toast.success('Donation recorded');
          router.back();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not record the donation. Try again.'),
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Make a donation" onBack={() => router.back()} />
      {donationsQuery.isPending ? (
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      ) : (
        <View className="gap-4 pb-6">
          <SelectSheet control={control} name="categoryId" label="Cause" options={categoryOptions} placeholder="Select a cause" />
          <AmountField control={control} name="amount" label="Amount" presets={[1000, 5000, 10000, 50000]} />
          <TextField control={control} name="notes" label="Notes (optional)" placeholder="Add a message or dedication" multiline />
          <Switch control={control} name="isAnonymous" label="Donate anonymously" />
        </View>
      )}
      <StickyFooter>
        <View style={{ flex: 1 }}>
          <Button variant="gradient" size="lg" fullWidth loading={makeDonation.isPending} disabled={makeDonation.isPending} onPress={() => handleSubmit(onSubmit)()}>
            Submit donation
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
