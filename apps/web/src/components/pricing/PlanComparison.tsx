'use client';

import { IconCheck, IconMinus } from '@tabler/icons-react';
import type { PricingPlan } from '@/types/pricing';

/** Side-by-side view of what each plan includes. The rows are the modules the plans actually contain, so it can never go out of date. */
export function PlanComparison({ plans }: { plans: PricingPlan[] }) {
  if (plans.length < 2) return null;

  const rows: { code: string; name: string }[] = [];
  for (const plan of plans) {
    for (const m of plan.modules) {
      if (!m.isCore && !rows.some((r) => r.code === m.code)) rows.push({ code: m.code, name: m.name });
    }
  }
  const members = (plan: PricingPlan) => (typeof plan.limits.members === 'number' ? plan.limits.members.toLocaleString('en-NG') : 'Unlimited');

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="w-full text-sm">
        <caption className="sr-only">Compare what each plan includes</caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th scope="col" className="text-left font-semibold text-gray-900 dark:text-white px-4 py-3">
              What is included
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className="text-center font-semibold text-gray-900 dark:text-white px-4 py-3">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100 dark:border-gray-700/60">
            <th scope="row" className="text-left font-normal text-gray-700 dark:text-gray-300 px-4 py-3">
              Active members
            </th>
            {plans.map((p) => (
              <td key={p.id} className="text-center text-gray-900 dark:text-white px-4 py-3">
                {members(p)}
              </td>
            ))}
          </tr>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
              <th scope="row" className="text-left font-normal text-gray-700 dark:text-gray-300 px-4 py-3">
                {row.name}
              </th>
              {plans.map((p) => {
                const included = p.modules.some((m) => m.code === row.code);
                return (
                  <td key={p.id} className="text-center px-4 py-3">
                    {included ? (
                      <IconCheck size={18} className="inline text-teal-600" aria-label="Included" />
                    ) : (
                      <IconMinus size={18} className="inline text-gray-300 dark:text-gray-600" aria-label="Not included" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
