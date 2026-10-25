import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PayableAmountRow } from '@/features/cash/components/PayableAmountRow';
import { useRecordCashReceipt } from '@/features/cash/mutations';
import { CASH_COLLECT_ACCESS, useCashCollection, useCashPayables } from '@/features/cash/queries';
import { buildReceiptDraft, newIdempotencyKey, payableRows, type DonationEntry, type PayableRow } from '@/features/cash/schemas';
import { ITEM_KIND_LABELS } from '@/features/cash/labels';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useCan } from '@/hooks/useCan';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { CashReceiptDTO } from '@/types/api/cash';

const GROUP_TITLES: Record<PayableRow['group'], string> = {
  charges: 'What they owe',
  loans: 'Loan repayment',
  savings: 'Cooperative savings',
  welfare: 'Welfare',
};

type Failure = { message: string; partial: boolean };

/**
 * project-overview.md §6.9 CA5 — Collect cash: pick the member, enter what they hand over against what they owe or could put aside,
 * and record one receipt. Safe to retry: a receipt that failed to save stays on screen with "Not saved — Retry", and a retry never
 * credits the member twice.
 */
export default function CollectCashScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ collectionId?: string }>();
  const collectionId = Number(params.collectionId);
  const { color } = useThemeTokens();

  const canCollect = useCan(CASH_COLLECT_ACCESS);
  const collectionQuery = useCashCollection(collectionId);
  const record = useRecordCashReceipt(collectionId);
  const { control, setValue } = useForm<{ member: { id: number; name: string } | null }>({ defaultValues: { member: null } });
  const member = useWatch({ control, name: 'member' });
  const payablesQuery = useCashPayables(member?.id ?? null);

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [donation, setDonation] = useState<DonationEntry | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState<CashReceiptDTO | null>(null);
  // One key per distinct receipt: a pure retry reuses it (so it can't credit twice), an edited receipt gets a fresh one.
  const keyRef = useRef<{ signature: string; key: string }>({ signature: '', key: '' });
  const back = () => router.back();

  const rows = useMemo(() => (payablesQuery.data ? payableRows(payablesQuery.data) : []), [payablesQuery.data]);
  const draft = useMemo(() => buildReceiptDraft(rows, { amounts, donation }), [rows, amounts, donation]);
  const problemByLabel = useMemo(() => new Map(draft.problems.map((p) => [p.split(':')[0], p.slice(p.indexOf(':') + 2)])), [draft.problems]);

  if (!canCollect) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Collect cash" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (collectionQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Collect cash" onBack={back} />
        <Skeleton width="100%" height={120} radius="md" />
      </Screen>
    );
  }

  if (collectionQuery.isError || !collectionQuery.data) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Collect cash" onBack={back} />
        <ErrorState error={collectionQuery.error} onRetry={() => collectionQuery.refetch()} />
      </Screen>
    );
  }

  if (collectionQuery.data.status !== 'OPEN') {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Collect cash" onBack={back} />
        <ErrorState title="This collection is closed." description="Open a new collection to take more cash." />
      </Screen>
    );
  }

  const reset = () => {
    setAmounts({});
    setDonation(null);
    setFailure(null);
    setDone(null);
    setValue('member', null);
    keyRef.current = { signature: '', key: '' };
  };

  const submit = () => {
    if (!member || draft.items.length === 0 || draft.problems.length > 0) return;
    const signature = JSON.stringify({ memberId: member.id, items: draft.items });
    if (keyRef.current.signature !== signature) keyRef.current = { signature, key: newIdempotencyKey() };

    setFailure(null);
    record.mutate(
      { memberId: member.id, idempotencyKey: keyRef.current.key, items: draft.items },
      {
        onSuccess: (receipt) => {
          setDone(receipt);
        },
        onError: (error) => {
          const partial = error instanceof ApiError && error.code === 'PARTIALLY_RECORDED';
          setFailure({ message: error instanceof ApiError ? error.message : 'We could not reach the server. Nothing was saved.', partial });
          if (!(error instanceof ApiError) || error.isNetwork || error.isTimeout) toast.error('Not saved — check your connection and retry');
        },
      },
    );
  };

  // ---------------------------------------------------------------- the receipt, once saved
  if (done) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Receipt" onBack={back} />
        <View className="items-center gap-3 pb-6 pt-4" testID="cash-receipt-done">
          <CheckCircle2 size={56} color={color.success} strokeWidth={1.5} />
          <Text variant="h2" align="center">
            Cash received
          </Text>
          <Money value={done.total} size="display" />
          <Text variant="body" tone="secondary" align="center">
            {`${done.member.name} · ${done.receiptNumber}`}
          </Text>
        </View>
        <View className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent">
          {done.items.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text variant="body-strong" numberOfLines={2}>
                  {item.label}
                </Text>
                <Text variant="caption" tone="secondary">
                  {ITEM_KIND_LABELS[item.kind]}
                </Text>
              </View>
              <Money value={item.amount} size="body-strong" />
            </View>
          ))}
        </View>
        <Text variant="caption" tone="secondary" className="mt-3">
          The member has been credited and told. Keep the cash safe until you lodge it.
        </Text>
        <View className="mt-6 gap-3">
          <Button variant="primary" onPress={reset} testID="cash-collect-another">
            Collect from another member
          </Button>
          <Button variant="secondary" onPress={back} testID="cash-collect-finish">
            Back to collection
          </Button>
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------- the form
  const payables = payablesQuery.data;
  const grouped = (['charges', 'loans', 'savings', 'welfare'] as const)
    .map((group) => ({ group, rows: rows.filter((r) => r.group === group) }))
    .filter((g) => g.rows.length > 0);
  const donationCategories = payables?.donations.categories ?? [];
  const donationAllocations = payables?.donations.allocations ?? [];
  const hasAnythingToPay = rows.length > 0 || donationCategories.length > 0;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Collect cash" onBack={back} docsKey="CA5" />

      <View className="gap-6 pb-6">
        <Text variant="body" tone="secondary">
          {`Taking cash into “${collectionQuery.data.title}”. Choose the member, then enter what they hand over.`}
        </Text>

        <MemberPickerField
          control={control}
          name="member"
          label="Member"
          helper="Search by name, member ID, email or phone."
          testID="cash-member"
        />

        {member ? (
          payablesQuery.isPending ? (
            <View className="gap-3">
              <Skeleton width="100%" height={72} radius="md" />
              <Skeleton width="100%" height={72} radius="md" />
            </View>
          ) : payablesQuery.isError ? (
            <ErrorState error={payablesQuery.error} onRetry={() => payablesQuery.refetch()} />
          ) : !hasAnythingToPay ? (
            <Text variant="body" tone="secondary">
              This member has nothing outstanding and no savings, welfare fund or donation category to pay into.
            </Text>
          ) : (
            <View className="gap-6">
              {grouped.map(({ group, rows: groupRows }) => (
                <Section key={group} title={GROUP_TITLES[group]}>
                  <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
                    {groupRows.map((row, index) => (
                      <View key={row.key} className={index > 0 ? 'border-t border-border' : undefined}>
                        <PayableAmountRow
                          label={row.label}
                          hint={row.hint}
                          value={amounts[row.key] ?? ''}
                          onChange={(text) => setAmounts((current) => ({ ...current, [row.key]: text }))}
                          suggested={row.suggested}
                          error={problemByLabel.get(row.label)}
                          testID={`cash-row-${row.key.replace(':', '-')}`}
                        />
                      </View>
                    ))}
                  </View>
                </Section>
              ))}

              {donationCategories.length > 0 ? (
                <Section title="Donation">
                  <View className="gap-3">
                    {donationCategories.length > 1 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {donationCategories.map((category) => (
                          <FilterChip
                            key={category.id}
                            label={category.name}
                            active={donation?.categoryId === category.id}
                            onPress={() => setDonation((d) => ({ categoryId: category.id, allocationId: d?.allocationId ?? null, amount: d?.amount ?? '' }))}
                          />
                        ))}
                      </ScrollView>
                    ) : null}
                    {donationAllocations.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        <FilterChip
                          label="General fund"
                          active={!donation?.allocationId}
                          onPress={() => setDonation((d) => ({ categoryId: d?.categoryId ?? donationCategories[0]!.id, allocationId: null, amount: d?.amount ?? '' }))}
                        />
                        {donationAllocations.map((allocation) => (
                          <FilterChip
                            key={allocation.id}
                            label={allocation.name}
                            active={donation?.allocationId === allocation.id}
                            onPress={() => setDonation((d) => ({ categoryId: d?.categoryId ?? donationCategories[0]!.id, allocationId: allocation.id, amount: d?.amount ?? '' }))}
                          />
                        ))}
                      </ScrollView>
                    ) : null}
                    <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
                      <PayableAmountRow
                        label={donationCategories.find((c) => c.id === (donation?.categoryId ?? donationCategories[0]!.id))?.name ?? 'Donation'}
                        hint="A gift, not a debt"
                        value={donation?.amount ?? ''}
                        onChange={(text) =>
                          setDonation((d) => ({ categoryId: d?.categoryId ?? donationCategories[0]!.id, allocationId: d?.allocationId ?? null, amount: text }))
                        }
                        error={problemByLabel.get('Donation')}
                        testID="cash-row-donation"
                      />
                    </View>
                  </View>
                </Section>
              ) : null}
            </View>
          )
        ) : null}

        {failure ? (
          <View className="gap-1 rounded-lg bg-danger-soft p-4" testID="cash-failure">
            <Text variant="label" tone="danger">
              {failure.partial ? 'Part of this receipt was saved' : 'Not saved'}
            </Text>
            <Text variant="body">{failure.message}</Text>
            {failure.partial ? (
              <Button variant="secondary" onPress={back} testID="cash-failure-check">
                Check the collection
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1 justify-center">
          <Text variant="caption" tone="secondary">
            Total received
          </Text>
          <Money value={draft.total} size="h3" />
        </View>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            loading={record.isPending}
            disabled={!member || draft.items.length === 0 || draft.problems.length > 0 || (failure?.partial ?? false)}
            onPress={submit}
            testID="cash-record"
          >
            {failure && !failure.partial ? 'Not saved — Retry' : 'Record receipt'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
