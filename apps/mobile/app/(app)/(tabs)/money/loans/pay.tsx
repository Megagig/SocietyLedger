import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PayToCard } from '@/features/cooperatives/components/PayToCard';
import { useLoan, useSubmitLoanRepayment } from '@/features/cooperatives/loanQueries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { toDecimal } from '@/lib/money';
import { COOPERATIVE_LOAN_REPAY_ACCESS } from '@/lib/permissions';

/**
 * F4.2 — declare a loan payment with its bank receipt. Creates a PENDING request: the loan balance moves after an
 * officer confirms the money landed (never self-credited), and the amount can't exceed what is still owed.
 */
export default function PayLoanScreen() {
  const router = useRouter();
  const { loanId: loanIdParam } = useLocalSearchParams<{ loanId?: string }>();
  const loanId = Number(loanIdParam);

  const canRepay = useCan(COOPERATIVE_LOAN_REPAY_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const loanQuery = useLoan(loanId);
  const submit = useSubmitLoanRepayment();
  const outstanding = loanQuery.data ? toDecimal(loanQuery.data.outstandingBalance) : null;

  const schema = z.object({
    amount: z
      .string()
      .min(1, 'Enter the amount you paid')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be more than zero')
      .refine((v) => !outstanding || toDecimal(v || 0).lessThanOrEqualTo(outstanding), 'That is more than you still owe on this loan'),
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

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', paymentDate: new Date().toISOString(), reference: '', memberNote: '', receipt: null },
  });

  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title="Pay loan" moduleName="Cooperatives" onBack={back} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay loan" onBack={back} />
        <NoMemberProfile subject="loans" />
      </Screen>
    );
  }

  if (!canRepay) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay loan" onBack={back} />
        <EmptyState icon={HandCoins} title="No access" description="You don't have permission to declare loan payments." />
      </Screen>
    );
  }

  if (loanQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay loan" onBack={back} />
        <Skeleton width="100%" height={160} radius="lg" />
      </Screen>
    );
  }

  if (loanQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay loan" onBack={back} />
        <ErrorState error={loanQuery.error} onRetry={() => loanQuery.refetch()} />
      </Screen>
    );
  }

  const loan = loanQuery.data;
  if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay loan" onBack={back} />
        <EmptyState icon={HandCoins} title="Nothing to pay" description="This loan is not open for payments." />
      </Screen>
    );
  }

  const onSubmit = (values: FormValues) => {
    if (!values.receipt) return;
    submit.mutate(
      {
        loanId: loan.id,
        amount: values.amount,
        paymentDate: values.paymentDate,
        reference: values.reference?.trim() || undefined,
        memberNote: values.memberNote?.trim() || undefined,
        file: { uri: values.receipt.uri, name: values.receipt.name, type: values.receipt.type },
      },
      {
        onSuccess: () => {
          toast.success('Payment submitted. Your loan balance updates once an officer confirms it.');
          router.back();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not submit your payment. Try again.');
        },
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Pay loan" onBack={back} />

      <View className="gap-5 pb-6">
        <View className="gap-1">
          <Text variant="caption" tone="secondary">{`${loan.loanProductName} · ${loan.loanNumber}`}</Text>
          <Text variant="caption" tone="secondary">Still owed</Text>
          <Money value={loan.outstandingBalance} size="h2" />
          {loan.nextPaymentAmount ? <Text variant="caption" tone="secondary">{`Next instalment: ₦${Number(loan.nextPaymentAmount).toLocaleString('en-NG')}`}</Text> : null}
        </View>

        <Text variant="body" tone="secondary">
          Pay into your cooperative&apos;s bank account first, then upload the receipt here. Your loan balance updates once an officer confirms the payment.
        </Text>

        <PayToCard />

        <AmountField control={control} name="amount" label="Amount you paid" />
        <DateField control={control} name="paymentDate" label="Date you paid" maximumDate={new Date()} />
        <TextField control={control} name="reference" label="Bank reference (optional)" placeholder="Transfer reference or teller number" />
        <FileAttachField control={control} name="receipt" label="Bank receipt" helper="A photo or PDF, up to 5MB." />
        <TextField control={control} name="memberNote" label="Note (optional)" placeholder="Anything the officer should know" multiline />
      </View>

      <StickyFooter>
        <Button variant="primary" loading={submit.isPending} onPress={() => { handleSubmit(onSubmit)(); }}>
          Submit payment
        </Button>
      </StickyFooter>
    </Screen>
  );
}
