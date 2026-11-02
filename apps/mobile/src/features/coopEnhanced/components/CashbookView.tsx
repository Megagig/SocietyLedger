import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { CashbookDTO, CashbookRowDTO } from '@/types/api/coopEnhanced';
import { shareCsv } from '../csv';
import { shareCashbookPdf, useCoopCashbookV2 } from '../queries';
import { CoopTile } from './CoopTile';
import { RangeFilter, isoDay } from './RangeFilter';

function Line({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="caption" tone="secondary">{label}</Text>
      <Money value={value} size="caption" />
    </View>
  );
}

/** One entry. Shares, savings, loans and loan interest each show only the columns that moved, with the running balance after it. */
function Entry({ row }: { row: CashbookRowDTO }) {
  return (
    <View className="gap-1 px-4 py-3" accessible>
      <Text variant="body-strong">{row.narration}</Text>
      <Text variant="caption" tone="secondary">{formatDate(row.date, 'short')}</Text>
      <View className="mt-1 gap-0.5">
        <Line label="Shares" value={row.shares} />
        {row.savings ? (
          <>
            <Line label={`${row.savings.desc} · debit`} value={row.savings.dr} />
            <Line label={`${row.savings.desc} · credit`} value={row.savings.cr} />
            <Line label="Savings balance" value={row.savings.balance} />
          </>
        ) : null}
        {row.loans ? (
          <>
            <Line label={`${row.loans.desc} · debit`} value={row.loans.dr} />
            <Line label={`${row.loans.desc} · credit`} value={row.loans.cr} />
            <Line label="Loan balance" value={row.loans.balance} />
          </>
        ) : null}
        {row.interest ? (
          <>
            <Line label="Interest charged" value={row.interest.dr} />
            <Line label="Interest paid" value={row.interest.cr} />
            <Line label="Interest still to pay" value={row.interest.balance} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const cell = (value: string | null | undefined) => value ?? '';

async function exportCashbook(book: CashbookDTO, filename: string) {
  await shareCsv(
    filename,
    ['Date', 'Narration', 'Shares', 'Savings desc', 'Savings DR', 'Savings CR', 'Savings balance', 'Loans desc', 'Loans DR', 'Loans CR', 'Loans balance', 'Interest charged', 'Interest paid', 'Interest still to pay'],
    book.rows.map((r) => [
      isoDay(r.date),
      r.narration,
      cell(r.shares),
      r.savings?.desc ?? '',
      cell(r.savings?.dr),
      cell(r.savings?.cr),
      cell(r.savings?.balance),
      r.loans?.desc ?? '',
      cell(r.loans?.dr),
      cell(r.loans?.cr),
      cell(r.loans?.balance),
      cell(r.interest?.dr),
      cell(r.interest?.cr),
      cell(r.interest?.balance),
    ]),
  );
}

/**
 * The cashbook statement: a member's shares, savings, loans and loan interest in cooperative bookkeeping form, with a date range that starts
 * from the true opening balance (not from zero). The member's own page and an officer's view of one member are this same view.
 */
export function CashbookView({ memberId, filename }: { memberId?: number; filename: string }) {
  const today = isoDay(new Date().toISOString());
  const [range, setRange] = useState({ from: '', to: today });
  const query = useCoopCashbookV2(range, memberId);
  const d = query.data;

  const share = async () => {
    if (!d) return;
    try {
      await exportCashbook(d, filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the file.');
    }
  };

  const sharePdf = async () => {
    try {
      await shareCashbookPdf(range, memberId, filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the PDF.');
    }
  };

  return (
    <View className="gap-4 pb-8">
      <Text variant="body" tone="secondary">
        View cashbook entries and export a report for the selected period.
      </Text>
      <RangeFilter from={range.from} to={range.to} onApply={setRange} />

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={200} radius="lg" />
        </View>
      ) : query.isError || !d ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <View className="items-center">
            <Text variant="h3">{`Member: ${d.member?.name ?? ''}${d.member ? ` (${d.member.memberNumber})` : ''}`}</Text>
            <Text variant="caption" tone="secondary">{`Period: ${d.period.from ? formatDate(d.period.from, 'short') : 'from the beginning'} – ${d.period.to ? formatDate(d.period.to, 'short') : 'today'}`}</Text>
          </View>

          <View className="gap-3">
            <View className="flex-row gap-3">
              <CoopTile label="Total shares" value={d.tiles.totalShares} tone="info" />
              <CoopTile label="Total savings" value={d.tiles.totalSavings} tone="success" />
            </View>
            <View className="flex-row gap-3">
              <CoopTile label="Total loans" value={d.tiles.totalLoans} tone="neutral" />
              <CoopTile label="Interest still to pay" value={d.tiles.totalLoanInterest} tone="warning" hint="Charged when each loan was paid out, less what you have repaid" />
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text variant="caption" tone="secondary">{`${d.rows.length} transaction${d.rows.length === 1 ? '' : 's'}`}</Text>
            <View className="flex-row gap-2">
              <Button variant="secondary" size="sm" onPress={() => void sharePdf()} testID="cashbook-pdf">
                PDF
              </Button>
              <Button variant="secondary" size="sm" onPress={() => void share()} testID="cashbook-export">
                Spreadsheet
              </Button>
            </View>
          </View>

          {d.rows.length === 0 ? (
            <EmptyState icon={Download} title="No cashbook entries for this period." description="Entries appear here once payments are confirmed." />
          ) : (
            <>
              <Card noPadding>
                {d.rows.map((r, i) => (
                  <View key={`${r.date}-${i}`}>
                    {i > 0 ? <Divider /> : null}
                    <Entry row={r} />
                  </View>
                ))}
              </Card>
              <Card>
                <Text variant="h3" className="mb-2">Totals for the period</Text>
                <Line label="Shares" value={d.totals.shares} />
                <Line label="Savings debit" value={d.totals.savingsDr} />
                <Line label="Savings credit" value={d.totals.savingsCr} />
                <Line label="Loans debit" value={d.totals.loansDr} />
                <Line label="Loans credit" value={d.totals.loansCr} />
                <Line label="Interest charged" value={d.totals.interestDr} />
                <Line label="Interest paid" value={d.totals.interestCr} />
              </Card>
            </>
          )}
        </>
      )}
    </View>
  );
}
