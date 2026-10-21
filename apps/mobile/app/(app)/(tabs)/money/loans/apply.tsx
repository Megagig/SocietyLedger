import { useRouter } from 'expo-router';
import { Check, HandCoins } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { AmountField } from '@/components/forms/AmountField';
import { SearchField } from '@/components/forms/SearchField';
import { TextField } from '@/components/forms/TextField';
import { ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { borrowingLimit, estimateForProduct, heldSavingsFor } from '@/features/cooperatives/loanMath';
import { useCreateLoanApplication, useGuarantorCandidates, useLoanProducts } from '@/features/cooperatives/loanQueries';
import { useCooperativeProfile } from '@/features/cooperatives/queries';
import { useCan } from '@/hooks/useCan';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatMoney, toDecimal } from '@/lib/money';
import { COOPERATIVE_LOANS_APPLY_ACCESS } from '@/lib/permissions';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { GuarantorCandidateDTO, LoanProductDTO } from '@/types/api/loans';

type FormValues = { amount: string; tenure: string; purpose: string };

const STEPS = ['Loan product', 'Amount & term', 'Purpose & guarantors', 'Review'] as const;
const MIN_PURPOSE = 10;

const fullName = (m: Pick<GuarantorCandidateDTO, 'firstName' | 'lastName'>) => `${m.firstName} ${m.lastName}`;

/** project-overview.md §6.4 M19 — apply for a loan: product → amount & term (live estimate, savings limit) → purpose & guarantors → review. */
export default function ApplyForLoanScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const canApply = useCan(COOPERATIVE_LOANS_APPLY_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const productsQuery = useLoanProducts();
  const profileQuery = useCooperativeProfile();
  const create = useCreateLoanApplication();

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState<number | null>(null);
  // Everyone seen in a search is remembered, so a picked guarantor keeps their name as the results change.
  const [picked, setPicked] = useState<GuarantorCandidateDTO[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const { control, handleSubmit } = useForm<FormValues>({ defaultValues: { amount: '', tenure: '', purpose: '' } });
  const [amountText, tenureText, purposeText] = useWatch({ control, name: ['amount', 'tenure', 'purpose'] });

  const products = productsQuery.data?.products ?? [];
  const product: LoanProductDTO | null = products.find((p) => p.id === productId) ?? null;
  const available = profileQuery.data?.availableSavings ?? 0;
  const candidatesQuery = useGuarantorCandidates(debouncedSearch.trim(), step === 2 && !!product?.requiresGuarantor);

  const limit = product ? borrowingLimit(product, available) : null;
  const amount = Number(amountText) || 0;
  const tenure = Number(tenureText) || 0;

  const amountError = useMemo(() => {
    if (!product || !limit || !amountText) return null;
    if (amount < Number(product.minAmount)) return `The smallest loan on this product is ${formatMoney(product.minAmount)}.`;
    if (toDecimal(amount).greaterThan(limit.max)) return `You can borrow up to ${formatMoney(limit.max)} on this product.`;
    return null;
  }, [product, limit, amountText, amount]);

  const tenureError = useMemo(() => {
    if (!product || !tenureText) return null;
    if (!Number.isInteger(tenure) || tenure < product.minTenureMonths || tenure > product.maxTenureMonths) {
      return `Choose between ${product.minTenureMonths} and ${product.maxTenureMonths} months.`;
    }
    return null;
  }, [product, tenureText, tenure]);

  const estimate = product && amount > 0 && tenure > 0 && !amountError && !tenureError ? estimateForProduct(product, amount, tenure) : null;
  const held = product && estimate ? heldSavingsFor(product, amount) : null;
  const minGuarantors = product?.requiresGuarantor ? product.minGuarantors : 0;

  const canProceed =
    step === 0 ? !!product :
    step === 1 ? !!estimate :
    step === 2 ? purposeText.trim().length >= MIN_PURPOSE && picked.length >= minGuarantors :
    true;

  const back = () => (step === 0 ? router.back() : setStep(step - 1));

  if (locked) return <ModuleLockedScreen title="Apply for a loan" moduleName="Cooperatives" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Apply for a loan" onBack={() => router.back()} />
        <NoMemberProfile subject="loans" />
      </Screen>
    );
  }

  if (!canApply) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Apply for a loan" onBack={() => router.back()} />
        <EmptyState icon={HandCoins} title="No access" description="You don't have permission to apply for loans." />
      </Screen>
    );
  }

  const togglePicked = (candidate: GuarantorCandidateDTO) =>
    setPicked((current) => (current.some((c) => c.id === candidate.id) ? current.filter((c) => c.id !== candidate.id) : [...current, candidate]));

  const submit = handleSubmit((values) => {
    if (!product) return;
    create.mutate(
      {
        loanProductId: product.id,
        amount: Number(values.amount),
        tenureMonths: Number(values.tenure),
        purpose: values.purpose.trim(),
        guarantorIds: picked.map((p) => p.id),
      },
      {
        onSuccess: () => {
          toast.success('Application submitted. You will be notified as it moves forward.');
          router.replace('/money/loans' as never);
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not submit your application. Try again.');
        },
      },
    );
  });

  const candidates = (candidatesQuery.data ?? []).filter((c) => !picked.some((p) => p.id === c.id));

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Apply for a loan" onBack={back} />

      <View className="gap-5 pb-6">
        <View className="gap-1">
          <Text variant="caption" tone="secondary">{`Step ${step + 1} of ${STEPS.length}`}</Text>
          <Text variant="h3">{STEPS[step]}</Text>
        </View>

        {step === 0 ? (
          productsQuery.isPending || profileQuery.isPending ? (
            <Skeleton width="100%" height={140} radius="lg" />
          ) : productsQuery.isError ? (
            <ErrorState error={productsQuery.error} onRetry={() => productsQuery.refetch()} />
          ) : products.length === 0 ? (
            <EmptyState icon={HandCoins} title="No loan products yet" description="Your cooperative hasn't set up a loan product. Ask an officer." />
          ) : (
            products.map((p) => {
              const productLimit = borrowingLimit(p, available);
              const unavailable = productLimit.max.lessThan(toDecimal(p.minAmount));
              const selected = p.id === productId;
              return (
                <Pressable
                  key={p.id}
                  disabled={unavailable}
                  onPress={() => {
                    setProductId(p.id);
                    setPicked([]);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: unavailable }}
                  testID={`loan-product-${p.id}`}
                >
                  <Card className={cn('gap-2', selected && 'border-primary', unavailable && 'opacity-60')}>
                    <View className="flex-row items-center justify-between">
                      <Text variant="h3" className="flex-1">{p.name}</Text>
                      {selected ? <Check size={20} color={color.primary} strokeWidth={1.75} /> : null}
                    </View>
                    {p.description ? <Text variant="caption" tone="secondary">{p.description}</Text> : null}
                    <Text variant="body">{`${Number(p.interestRate)}% a year · ${p.minTenureMonths}–${p.maxTenureMonths} months`}</Text>
                    <Text variant="body">{`${formatMoney(p.minAmount)} – ${formatMoney(p.maxAmount)}`}</Text>
                    {p.requiresGuarantor ? <Badge tone="warning">{`${p.minGuarantors} guarantor${p.minGuarantors === 1 ? '' : 's'} required`}</Badge> : null}
                    {productLimit.limitedBySavings && !unavailable ? (
                      <Text variant="caption" tone="info">{`You can borrow up to ${formatMoney(productLimit.max)} based on your available savings.`}</Text>
                    ) : null}
                    {unavailable ? (
                      <Text variant="caption" tone="danger">
                        {`You need more available savings to borrow on this product (minimum ${formatMoney(p.minAmount)}).`}
                      </Text>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })
          )
        ) : null}

        {step === 1 && product && limit ? (
          <>
            <Text variant="body" tone="secondary">
              {`You can borrow up to ${formatMoney(limit.max)}${limit.limitedBySavings ? ', based on your available savings' : ''}.`}
            </Text>
            <AmountField control={control} name="amount" label="Amount you want to borrow" />
            {amountError ? <Text variant="caption" tone="danger">{amountError}</Text> : null}
            <TextField
              control={control}
              name="tenure"
              label={`Repay over (months, ${product.minTenureMonths}–${product.maxTenureMonths})`}
              keyboardType="number-pad"
              placeholder="12"
            />
            {tenureError ? <Text variant="caption" tone="danger">{tenureError}</Text> : null}

            {estimate ? (
              <Card className="gap-2">
                <Text variant="caption" tone="secondary">Estimate — the final figures are confirmed when you submit.</Text>
                <View className="flex-row items-center justify-between"><Text variant="body">Monthly repayment</Text><Money value={estimate.monthlyRepayment} /></View>
                <View className="flex-row items-center justify-between"><Text variant="body">Total interest</Text><Money value={estimate.totalInterest} /></View>
                <View className="flex-row items-center justify-between"><Text variant="body">Total to repay</Text><Money value={estimate.totalRepayment} /></View>
                <View className="flex-row items-center justify-between"><Text variant="body">Processing fee</Text><Money value={estimate.processingFee} /></View>
                {held ? (
                  <Text variant="caption" tone="info">
                    {`${formatMoney(held)} of your savings will be held until the loan is repaid. It stays in your account.`}
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

        {step === 2 && product ? (
          <>
            <TextField
              control={control}
              name="purpose"
              label="What is the loan for?"
              placeholder="Tell the committee what you will use the loan for"
              multiline
              helper={purposeText.trim().length < MIN_PURPOSE ? `At least ${MIN_PURPOSE} characters.` : undefined}
            />

            {product.requiresGuarantor ? (
              <>
                <Text variant="body" tone="secondary">
                  {`Choose at least ${product.minGuarantors} guarantor${product.minGuarantors === 1 ? '' : 's'}. They get a request to confirm.`}
                </Text>
                {picked.length > 0 ? (
                  <SectionCard title="Your guarantors" trailing={<Badge tone="primary">{String(picked.length)}</Badge>}>
                    {picked.map((c) => (
                      <ListItem key={c.id} title={fullName(c)} meta={c.memberId} trailing={<Text variant="label" tone="danger">Remove</Text>} onPress={() => togglePicked(c)} />
                    ))}
                  </SectionCard>
                ) : null}
                <SearchField value={search} onChangeText={setSearch} placeholder="Search members by name" />
                {candidatesQuery.isPending ? (
                  <Skeleton width="100%" height={56} radius="md" />
                ) : candidatesQuery.isError ? (
                  <ErrorState error={candidatesQuery.error} onRetry={() => candidatesQuery.refetch()} />
                ) : candidates.length === 0 ? (
                  <InlineEmpty icon={HandCoins} message="No members found." />
                ) : (
                  <SectionCard title="Members">
                    {candidates.map((c) => (
                      <ListItem key={c.id} title={fullName(c)} meta={c.memberId} trailing={<Text variant="label" tone="primary">Add</Text>} onPress={() => togglePicked(c)} />
                    ))}
                  </SectionCard>
                )}
              </>
            ) : null}
          </>
        ) : null}

        {step === 3 && product && estimate ? (
          <>
            <SectionCard title="Your application">
              <ListItem title="Loan product" trailing={<Text variant="body">{product.name}</Text>} />
              <ListItem title="Amount" trailing={<Money value={amount} />} />
              <ListItem title="Repay over" trailing={<Text variant="body">{`${tenure} months`}</Text>} />
              <ListItem title="Monthly repayment (est.)" trailing={<Money value={estimate.monthlyRepayment} />} />
              <ListItem title="Total to repay (est.)" trailing={<Money value={estimate.totalRepayment} />} />
              <ListItem title="Processing fee (est.)" trailing={<Money value={estimate.processingFee} />} />
              {held ? <ListItem title="Savings held" trailing={<Money value={held} />} /> : null}
            </SectionCard>
            <Card className="gap-1">
              <Text variant="caption" tone="secondary">Purpose</Text>
              <Text variant="body">{purposeText.trim()}</Text>
            </Card>
            {picked.length > 0 ? (
              <SectionCard title="Guarantors">
                {picked.map((c) => (
                  <ListItem key={c.id} title={fullName(c)} meta={c.memberId} />
                ))}
              </SectionCard>
            ) : null}
            <Text variant="caption" tone="secondary">
              Submitting sends your application for review. No money moves until an officer approves and pays out the loan.
            </Text>
          </>
        ) : null}
      </View>

      <StickyFooter>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" disabled={!canProceed} onPress={() => setStep(step + 1)}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" loading={create.isPending} onPress={() => { submit(); }}>
            Submit application
          </Button>
        )}
      </StickyFooter>
    </Screen>
  );
}
