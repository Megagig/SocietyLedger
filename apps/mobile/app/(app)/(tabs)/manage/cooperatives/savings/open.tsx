import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { useOpenAccount } from '@/features/coopManage/mutations';
import { COOP_MODULE, COOP_SAVINGS_ACCESS } from '@/features/coopManage/queries';
import { emptyOpenAccountValues, openAccountSchema, toOpenAccountPayload, type OpenAccountValues } from '@/features/coopManage/schemas';
import { ACCOUNT_TYPE_LABELS } from '@/features/cooperatives/labels';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { SavingsAccountType } from '@/types/api/cooperatives';

const TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABELS) as SavingsAccountType[]).map((value) => ({ value, label: ACCOUNT_TYPE_LABELS[value] }));

/** project-overview.md §6.9 CP2 — open a savings account for a member. It starts at ₦0.00; record deposits on the account afterwards. */
export default function OpenAccountScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(COOP_SAVINGS_ACCESS, COOP_MODULE);
  const open = useOpenAccount();
  const { control, handleSubmit } = useForm<OpenAccountValues>({ resolver: zodResolver(openAccountSchema), defaultValues: emptyOpenAccountValues(), mode: 'onTouched' });
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Open an account" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const submit = (values: OpenAccountValues) =>
    open.mutate(toOpenAccountPayload(values), {
      onSuccess: (account) => {
        toast.success(`Account ${account.accountNumber} opened`);
        router.replace(`/(app)/(tabs)/manage/cooperatives/savings/${account.id}` as never);
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not open the account. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Open an account" onBack={back} docsKey="CP2" />

      <View className="gap-6 pb-6">
        <Section title="The account">
          <View className="gap-4">
            <MemberPickerField control={control} name="member" label="Member" testID="open-member" />
            <SelectSheet control={control} name="accountType" label="Kind of account" options={TYPE_OPTIONS} placeholder="Choose the kind" />
          </View>
        </Section>

        <Section title="Goals (optional)">
          <View className="gap-4">
            <AmountField control={control} name="targetAmount" label="Savings target" helper="What the member is saving towards." />
            <AmountField control={control} name="monthlyContribution" label="Monthly contribution" />
            <TextField control={control} name="interestRate" label="Interest rate (% a year)" keyboardType="decimal-pad" placeholder="0" />
            <TextField control={control} name="notes" label="Note" multiline />
          </View>
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={open.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="open-save">
            Open account
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
