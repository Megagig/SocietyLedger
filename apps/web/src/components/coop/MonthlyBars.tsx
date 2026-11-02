'use client';

import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAxisNaira, formatNairaFull } from '@/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Tone = 'success' | 'info';
// A var() colour only works as a CSS style, not as an SVG attribute, so the bars are drawn with a style fill: they then follow light and dark mode.
const FILL: Record<Tone, string> = { success: 'var(--c-success-solid)', info: 'var(--c-info-text)' };

/**
 * Twelve bars, one per month. The axis always shows the full figure (₦300,000.00), never 300k, and the chart's data is also available as a
 * visually hidden table so it can be read without seeing the picture.
 */
export function MonthlyBars({
  title,
  subtitle,
  data,
  tone = 'success',
}: {
  title: string;
  subtitle: string;
  data: string[];
  tone?: Tone;
}) {
  const rows = MONTHS.map((month, i) => ({ month, amount: Number(data[i] ?? 0) }));
  const empty = rows.every((r) => r.amount === 0);

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-muted">{subtitle}</p>
      <div className="relative mt-3 h-64">
        {empty ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">No activity recorded for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--c-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--c-ink-faint)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis width={104} tick={{ fill: 'var(--c-ink-faint)', fontSize: 12 }} tickFormatter={formatAxisNaira} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: number) => formatNairaFull(value)} cursor={{ fill: 'var(--c-surface-sunken)' }} />
              <Bar dataKey="amount" isAnimationActive={false} radius={[4, 4, 0, 0]} shape={(props: any /* TODO(type): recharts does not type a custom bar shape's props */) => <Rectangle {...props} style={{ fill: FILL[tone] }} />} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <th scope="row">{r.month}</th>
              <td>{formatNairaFull(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
