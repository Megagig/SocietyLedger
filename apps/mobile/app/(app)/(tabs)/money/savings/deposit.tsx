import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PayToCard } from '@/features/cooperatives/components/PayToCard';
import { ACCOUNT_TYPE_LABELS } from '@/features/cooperatives/labels';
import { useCooperativeProfile, useSubmitSavingsDeposit } from '@/features/cooperatives/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { COOPERATIVE_SAVINGS_DEPOSIT_ACCESS } from '@/lib/permissions';
import { PiggyBank } from 'lucide-react-native';

const schema = z.object({
  accountId: z.string().min(1, 'Choose the account you paid into'),
  amount: z
    .string()
    .min(1, 'Enter the amount you paid')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be more than zero'),
  paymentDate: z.string().min(1, 'Select the date you paid'),
  reference: z.string().max(100, 'Keep the reference under 100 characters').optional(),
  memberNote: z.string().max(500, 'Keep the note under 500 characters').optional(),
  receipt: z
    .object({ uri: z.string(), name: z.string(), type: z.string(), size: z.number().optional() })
    .nullable()
    // superRefine, not refine: refine's inferred type predicate would narrow the form type to non-null and break the empty default.
    .superRefine((v, ctx) => {
      if (v === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Attach your bank receipt (a photo or PDF)' });
    }),
});

type FormValues = z.infer<typeof schema>;

/**
 * F4.1 — declare a deposit with its bank receipt. This only creates a PENDING request: the balance moves
 * after an officer confirms the money landed (never self-credited).
 */
export default function SavingsDepositScreen() {
  const router = useRouter();
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const canDeposit = useCan(COOPERATIVE_SAVINGS_DEPOSIT_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const profileQuery = useCooperativeProfile();
  const submit = useSubmitSavingsDeposit();

  const activeAccounts = (profileQuery.data?.savingsAccounts ?? []).filter((a) => a.status === 'ACTIVE');
  const accountOptions = activeAccounts.map((a) => ({ label: `${ACCOUNT_TYPE_LABELS[a.accountType]} · ${a.accountNumber}`, value: String(a.id) }));

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: accountId ?? '',
      amount: '',
      paymentDate: new Date().toISOString(),
      reference: '',
      memberNote: '',
      receipt: null,
    },
  });

  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title="Make a deposit" moduleName="Cooperatives" onBack={back} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Make a deposit" onBack={back} />
        <NoMemberProfile subject="savings" />
      </Screen>
    );
  }

  if (!canDeposit) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Make a deposit" onBack={back} />
        <EmptyState icon={PiggyBank} title="No access" description="You don't have permission to declare savings deposits." />
      </Screen>
    );
  }

  const onSubmit = (values: FormValues) => {
    if (!values.receipt) return;
    submit.mutate(
      {
        savingsAccountId: Number(values.accountId),
        amount: values.amount,
        paymentDate: values.paymentDate,
        reference: values.reference?.trim() || undefined,
        memberNote: values.memberNote?.trim() || undefined,
        file: { uri: values.receipt.uri, name: values.receipt.name, type: values.receipt.type },
      },
      {
        onSuccess: () => {
          toast.success('Deposit submitted. It will show in your savings once an officer confirms the payment.');
          router.back();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not submit your deposit. Try again.');
        },
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Make a deposit" onBack={back} />

      {profileQuery.isPending ? (
        <Skeleton width="100%" height={200} radius="lg" />
      ) : activeAccounts.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No active savings account" description="You need an active savings account to deposit into. Ask an officer to open one." />
      ) : (
        <View className="gap-5 pb-6">
          <Text variant="body" tone="secondary">
            Pay into your cooperative&apos;s bank account first, then upload the receipt here. Your savings are updated once an officer confirms the payment.
          </Text>

          <PayToCard />

          <SelectSheet control={control} name="accountId" label="Account" options={accountOptions} placeholder="Select an account…" />
          <AmountField control={control} name="amount" label="Amount you paid" />
          <DateField control={control} name="paymentDate" label="Date you paid" maximumDate={new Date()} />
          <TextField control={control} name="reference" label="Bank reference (optional)" placeholder="Transfer reference or teller number" />
          <FileAttachField control={control} name="receipt" label="Bank receipt" helper="A photo or PDF, up to 5MB." />
          <TextField control={control} name="memberNote" label="Note (optional)" placeholder="Anything the officer should know" multiline />
        </View>
      )}

      <StickyFooter>
        <Button variant="primary" loading={submit.isPending} disabled={activeAccounts.length === 0} onPress={() => { handleSubmit(onSubmit)(); }}>
          Submit deposit
        </Button>
      </StickyFooter>
    </Screen>
  );
}
