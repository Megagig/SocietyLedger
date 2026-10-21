import { useRef } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { Heart } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';
import { z } from 'zod';
import type { Decimal } from 'decimal.js-light';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { useMakeDonation } from '@/features/memberFinance/mutations';
import { useMemberDonations } from '@/features/memberFinance/queries';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { tokens } from '@/theme/tokens';

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

type DonationItem = {
  id: number;
  category: { id: number; name: string; type: string };
  amount: Decimal;
  isAnonymous: boolean;
  notes: string | null;
  createdAt: string;
};

function DonationRow({ item }: { item: DonationItem }) {
  return (
    <ListItem
      title={item.category.name}
      meta={`${formatDate(item.createdAt, 'short')}${item.isAnonymous ? ' · Anonymous' : ''}`}
      trailing={<Money value={item.amount} size="body-strong" />}
    />
  );
}

export default function DonationsScreen() {
  const donationsQuery = useMemberDonations();
  const sheetRef = useRef<BottomSheetModal>(null);
  const makeDonation = useMakeDonation();

  const donations = donationsQuery.data?.donations ?? [];
  const categories = donationsQuery.data?.donationCategories ?? [];

  const categoryOptions = categories.map((c) => ({ label: c.name, value: String(c.id) }));

  const totalDonated = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  const { control, handleSubmit, reset } = useForm<DonateForm>({
    resolver: zodResolver(donateSchema),
    defaultValues: { categoryId: '', amount: '', notes: '', isAnonymous: false },
  });

  function onSubmit(values: DonateForm) {
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
          reset();
          sheetRef.current?.dismiss();
        },
      },
    );
  }

  const hasDonations = donations.length > 0;

  return (
    <>
      <View style={{ flex: 1 }}>
      <Screen
        edges={['top']}
        refreshing={donationsQuery.isRefetching}
        onRefresh={() => donationsQuery.refetch()}
      >
        <ScreenHeader title="My Donations" onBack={() => router.back()} />

        <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 80 }}>
          {/* Summary banner — shown only when donations exist */}
          {donationsQuery.isPending ? (
            <Skeleton width="100%" height={72} radius="lg" />
          ) : hasDonations ? (
            <View className="mx-4 rounded-xl bg-primary/10 p-4">
              <Text variant="caption" tone="secondary">
                Total donated
              </Text>
              <Money value={toDecimal(totalDonated)} size="h2" />
            </View>
          ) : null}

          <Section>
            {donationsQuery.isPending ? (
              <View className="gap-2 px-4">
                <Skeleton width="100%" height={60} radius="md" />
                <Skeleton width="100%" height={60} radius="md" />
                <Skeleton width="100%" height={60} radius="md" />
              </View>
            ) : !hasDonations ? (
              <View className="flex-1 items-center justify-center py-12">
                <EmptyState
                  icon={Heart}
                  title="No donations yet"
                  description="Your donation history will appear here once you make your first donation."
                  actionLabel="Make a donation"
                  onAction={() => sheetRef.current?.present()}
                />
              </View>
            ) : (
              <ListGroup>
                <FlatList
                  data={donations}
                  keyExtractor={(item) => String(item.id)}
                  scrollEnabled={false}
                  renderItem={({ item }) => <DonationRow item={item} />}
                />
              </ListGroup>
            )}
          </Section>
        </View>

      </Screen>
      {/* Only show sticky footer when there are donations — empty state has its own CTA */}
      {hasDonations && (
        <StickyFooter>
          <Button variant="gradient" size="lg" fullWidth onPress={() => sheetRef.current?.present()}>
            Make a donation
          </Button>
        </StickyFooter>
      )}
      </View>

      <BottomSheet ref={sheetRef} title="Make a donation" snapPoints={['70%', '90%']}>
        <View className="gap-4 pb-6">
          <SelectSheet
            control={control}
            name="categoryId"
            label="Cause"
            options={categoryOptions}
            placeholder="Select a cause"
          />
          <AmountField
            control={control}
            name="amount"
            label="Amount"
            presets={[1000, 5000, 10000, 50000]}
          />
          <TextField
            control={control}
            name="notes"
            label="Notes (optional)"
            placeholder="Add a message or dedication"
            multiline
          />
          <Switch control={control} name="isAnonymous" label="Donate anonymously" />
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            loading={makeDonation.isPending}
            disabled={makeDonation.isPending}
            onPress={() => handleSubmit(onSubmit)()}
          >
            Submit donation
          </Button>
        </View>
      </BottomSheet>
    </>
  );
}
