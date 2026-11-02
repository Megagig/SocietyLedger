'use client';

import { useState } from 'react';
import { Button, Modal } from '@mantine/core';
import { CoopButton } from '@/components/coop/CoopButton';
import { IconInfoCircle } from '@tabler/icons-react';
import { downloadXlsx } from '@/lib/coop/exportXlsx';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { RangeBar } from '@/components/coop/RangeBar';
import { StatTile } from '@/components/coop/StatTile';
import { toast } from '@/lib/toast';
import { formatDate } from '@/utils/format';
import { useCoopCashbook, useMemberCashbook } from '@/lib/coop/hooks';
import type { CashbookRow } from '@/lib/coop/types';

const today = () => new Date().toISOString().slice(0, 10);

const group = 'border border-line bg-surface-muted px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted';
const sub = 'border border-line bg-surface-muted px-2 py-1.5 text-center text-xs font-semibold uppercase text-ink-muted';
const cell = 'border border-line px-2 py-1.5 text-right tabular-nums';
const text = 'border border-line px-2 py-1.5 text-left';

/**
 * The cashbook statement, for a member's own page and for an officer opening one member's. The statement in cooperative bookkeeping form. Shares, savings, loans and loan interest each get their own
 * debit / credit / balance columns, and a date range starts from the true opening balance rather than from zero. Printing opens the
 * browser's print dialog (Save as PDF); only the statement is printed, not the menus around it.
 */
export function CashbookScreen({
  title,
  subtitle,
  filename,
  memberId,
}: {
  title: string;
  subtitle: string;
  filename: string;
  /** An officer opening one member's cashbook. Left out, it is the signed-in member's own. */
  memberId?: number;
}) {
  const [range, setRange] = useState({ from: '', to: today() });
  // Both are always called (hooks can't be conditional); only the one that applies is enabled.
  const own = useCoopCashbook(range, memberId === undefined);
  const theirs = useMemberCashbook(memberId ?? 0, range);
  const book = memberId === undefined ? own : theirs;
  const [open, setOpen] = useState<CashbookRow | null>(null);

  const exportExcel = async () => {
    if (!book.data) return;
    const m = (v: string | null | undefined) => v ?? '';
    try {
      await downloadXlsx(
        filename,
        'Cashbook',
        [
          { header: 'Date' }, { header: 'Narration', width: 28 }, { header: 'Shares', money: true },
          { header: 'Savings desc', width: 20 }, { header: 'Savings DR', money: true }, { header: 'Savings CR', money: true }, { header: 'Savings balance', money: true },
          { header: 'Loans desc', width: 20 }, { header: 'Loans DR', money: true }, { header: 'Loans CR', money: true }, { header: 'Loans balance', money: true },
          { header: 'Interest charged', money: true }, { header: 'Interest paid', money: true }, { header: 'Interest still to pay', money: true },
        ],
        book.data.rows.map((r) => [
          formatDate(r.date), r.narration, m(r.shares),
          r.savings?.desc ?? '', m(r.savings?.dr), m(r.savings?.cr), m(r.savings?.balance),
          r.loans?.desc ?? '', m(r.loans?.dr), m(r.loans?.cr), m(r.loans?.balance),
          m(r.interest?.dr), m(r.interest?.cr), m(r.interest?.balance),
        ]),
      );
    } catch {
      toast.error('We could not create the Excel file.');
    }
  };

  const d = book.data;

  return (
    <div className="space-y-6">
      <style>{`@media print { aside, nav, [data-no-print] { display: none !important; } main { margin: 0 !important; padding: 0 !important; } }`}</style>
      <div data-no-print>
        <PageHead
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Button variant="default" onClick={() => window.print()} disabled={!d}>
                Print PDF
              </Button>
              <CoopButton tone="primary" onClick={exportExcel} disabled={!d}>
                Export Excel
              </CoopButton>
            </>
          }
        />
      </div>

      <div data-no-print>
        <RangeBar from={range.from} to={range.to} onApply={setRange} />
      </div>

      {book.isLoading ? (
        <CoopLoading rows={3} height={96} />
      ) : book.isError || !d ? (
        <CoopError error={book.error} onRetry={() => book.refetch()} />
      ) : (
        <>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink">
              Member: {d.member?.name ?? ''} {d.member ? `(${d.member.memberNumber})` : ''}
            </h2>
            <p className="text-sm text-ink-muted">
              Period: {d.period.from ? formatDate(d.period.from) : 'from the beginning'} – {d.period.to ? formatDate(d.period.to) : 'today'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total shares" value={d.tiles.totalShares} tone="info" />
            <StatTile label="Total savings" value={d.tiles.totalSavings} tone="success" />
            <StatTile label="Total loans" value={d.tiles.totalLoans} tone="neutral" />
            <StatTile label="Interest still to pay" value={d.tiles.totalLoanInterest} tone="warning" hint="Charged when each loan was paid out, less what you have repaid" />
          </div>

          <p data-no-print className="flex items-center gap-2 text-sm text-ink-muted">
            <IconInfoCircle size={16} aria-hidden="true" /> Click or tap any date or narration to view details. <span className="ml-auto">{d.rows.length} transaction{d.rows.length === 1 ? '' : 's'}</span>
          </p>

          {d.rows.length === 0 ? (
            <CoopEmpty title="No cashbook entries for this period." hint="Entries appear here once your payments are confirmed." />
          ) : (
            <div className="relative overflow-x-auto">
              <table aria-label="Cashbook" className="w-full min-w-[72rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th rowSpan={2} scope="col" className={group}>Date</th>
                    <th colSpan={2} scope="colgroup" className={group}>Shares</th>
                    <th colSpan={4} scope="colgroup" className={group}>Savings</th>
                    <th colSpan={4} scope="colgroup" className={group}>Loans</th>
                    <th colSpan={3} scope="colgroup" className={group}>Loan interest (charged, then paid)</th>
                  </tr>
                  <tr>
                    {['Shares', 'Desc.', 'Desc.', 'Savings DR', 'Savings CR', 'Balance', 'Desc.', 'Loans DR', 'Loans CR', 'Balance', 'Charged', 'Paid', 'Still to pay'].map((h, i) => (
                      <th key={i} scope="col" className={sub}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r, i) => (
                    <tr key={i}>
                      <td className={text}>
                        <button type="button" onClick={() => setOpen(r)} className="border-0 bg-transparent p-0 text-left text-info-text underline decoration-dotted underline-offset-2 hover:decoration-solid">
                          {formatDate(r.date)}
                        </button>
                      </td>
                      <td className={cell}>{r.shares ? <Naira value={r.shares} /> : '–'}</td>
                      <td className={text}>
                        {r.shares ? <button type="button" onClick={() => setOpen(r)} className="border-0 bg-transparent p-0 text-left hover:underline">{r.narration}</button> : null}
                      </td>
                      <td className={text}>
                        {r.savings ? <button type="button" onClick={() => setOpen(r)} className="border-0 bg-transparent p-0 text-left hover:underline">{r.savings.desc}</button> : null}
                      </td>
                      <td className={cell}>{r.savings?.dr ? <Naira value={r.savings.dr} /> : '–'}</td>
                      <td className={cell}>{r.savings?.cr ? <Naira value={r.savings.cr} /> : '–'}</td>
                      <td className={`${cell} bg-info-soft`}>{r.savings ? <Naira value={r.savings.balance} /> : ''}</td>
                      <td className={text}>{r.loans?.desc ?? ''}</td>
                      <td className={cell}>{r.loans?.dr ? <Naira value={r.loans.dr} /> : '–'}</td>
                      <td className={cell}>{r.loans?.cr ? <Naira value={r.loans.cr} /> : '–'}</td>
                      <td className={`${cell} bg-danger-soft`}>{r.loans ? <Naira value={r.loans.balance} /> : ''}</td>
                      <td className={cell}>{r.interest?.dr ? <Naira value={r.interest.dr} /> : '–'}</td>
                      <td className={cell}>{r.interest?.cr ? <Naira value={r.interest.cr} /> : '–'}</td>
                      <td className={`${cell} bg-warning-soft`}>{r.interest ? <Naira value={r.interest.balance} /> : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-sunken font-semibold text-ink">
                    <th scope="row" className={text} colSpan={2}>Totals</th>
                    <td className={cell}><Naira value={d.totals.shares} /></td>
                    <td className={text} />
                    <td className={cell}><Naira value={d.totals.savingsDr} /></td>
                    <td className={cell}><Naira value={d.totals.savingsCr} /></td>
                    <td className={cell}><Naira value={d.tiles.totalSavings} /></td>
                    <td className={text} />
                    <td className={cell}><Naira value={d.totals.loansDr} /></td>
                    <td className={cell}><Naira value={d.totals.loansCr} /></td>
                    <td className={cell}><Naira value={d.tiles.totalLoans} /></td>
                    <td className={cell}><Naira value={d.totals.interestDr} /></td>
                    <td className={cell}><Naira value={d.totals.interestCr} /></td>
                    <td className={cell}><Naira value={d.tiles.totalLoanInterest} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      <Modal opened={!!open} onClose={() => setOpen(null)} title="Entry details" centered>
        {open && (
          <dl className="space-y-2 text-sm">
            <Row label="Date" value={formatDate(open.date)} />
            <Row label="Narration" value={open.narration} />
            {open.shares && <Row label="Shares" value={<Naira value={open.shares} />} />}
            {open.savings && (
              <>
                <Row label="Savings" value={open.savings.desc} />
                {open.savings.dr && <Row label="Savings debit" value={<Naira value={open.savings.dr} />} />}
                {open.savings.cr && <Row label="Savings credit" value={<Naira value={open.savings.cr} />} />}
                <Row label="Savings balance" value={<Naira value={open.savings.balance} />} />
              </>
            )}
            {open.loans && (
              <>
                <Row label="Loan" value={open.loans.desc} />
                {open.loans.dr && <Row label="Loan debit" value={<Naira value={open.loans.dr} />} />}
                {open.loans.cr && <Row label="Loan credit" value={<Naira value={open.loans.cr} />} />}
                <Row label="Loan balance" value={<Naira value={open.loans.balance} />} />
              </>
            )}
            {open.interest && (
              <>
                {open.interest.dr && <Row label="Interest charged" value={<Naira value={open.interest.dr} />} />}
                {open.interest.cr && <Row label="Interest paid" value={<Naira value={open.interest.cr} />} />}
                <Row label="Interest balance" value={<Naira value={open.interest.balance} />} />
              </>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
