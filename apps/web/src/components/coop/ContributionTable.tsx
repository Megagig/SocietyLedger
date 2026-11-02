import { Naira } from './Naira';
import type { CellStatus, CoopDashboard } from '@/lib/coop/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CELL: Record<CellStatus, string> = {
  PAID: 'bg-success-soft text-success-strong font-semibold',
  PARTIAL: 'bg-warning-soft text-warning-strong font-semibold',
  DEFAULTED: 'bg-danger-soft text-danger-strong',
  DUE: 'text-ink-faint',
  NONE: 'text-ink-faint',
};

const STATUS_WORD: Record<CellStatus, string> = {
  PAID: 'paid',
  PARTIAL: 'part paid',
  DEFAULTED: 'defaulted',
  DUE: 'due',
  NONE: 'nothing expected',
};

/** The legend's swatches use the same classes as the cells, so what the colour means is always the thing it is next to. */
function Legend() {
  const items: Array<[CellStatus, string]> = [
    ['PAID', 'Paid'],
    ['PARTIAL', 'Part paid'],
    ['DEFAULTED', 'Defaulted'],
  ];
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-4 p-0 text-xs text-ink-muted">
      {items.map(([status, label]) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm border border-line ${CELL[status].split(' ')[0]}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * What was paid FOR each month, against what the member is expected to pay. A month is only called Defaulted once it is over; the
 * current month is just still due. Each cell says its status in words for screen readers, so colour is never the only signal.
 */
export function ContributionTable({ table }: { table: CoopDashboard['contributionTable'] }) {
  if (table.rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No contributions are expected or recorded for {table.year} yet.</p>;
  }

  const rows = [...table.rows.map((row) => ({ key: String(row.accountTypeId), name: row.name, months: row.months })), ...(table.rows.length > 1 ? [{ key: 'total', name: 'All types', months: table.total }] : [])];

  return (
    <div className="space-y-3">
      <Legend />
      <div className="relative overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead className="bg-surface-muted text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                {table.year}
              </th>
              {MONTHS.map((m) => (
                <th key={m} scope="col" className="px-2 py-2 text-center font-semibold">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line-soft">
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink">
                  {row.name}
                </th>
                {row.months.map((cell) => {
                  const hasAmount = Number(cell.paid) > 0;
                  return (
                    <td key={cell.month} className={`px-2 py-2 text-center tabular-nums ${CELL[cell.status]}`}>
                      {hasAmount ? <Naira value={cell.paid} /> : <span aria-hidden="true">–</span>}
                      <span className="sr-only">
                        {MONTHS[cell.month - 1]} {table.year}: {STATUS_WORD[cell.status]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
