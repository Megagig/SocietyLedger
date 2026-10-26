'use client';

import type { BillingCycle, PricingPlan } from '@/types/pricing';

interface BillingToggleProps {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  plans: PricingPlan[];
  tone?: 'marketing' | 'app';
}

/** The biggest saving annual billing gives across the plans on offer, as a whole percentage (0 when annual is not cheaper). */
export function bestAnnualSavingPercent(plans: PricingPlan[]): number {
  let best = 0;
  for (const p of plans) {
    const yearAtMonthly = p.prices.monthlyKobo * 12;
    if (yearAtMonthly > 0 && p.prices.annualKobo < yearAtMonthly) {
      best = Math.max(best, Math.round(((yearAtMonthly - p.prices.annualKobo) / yearAtMonthly) * 100));
    }
  }
  return best;
}

export function BillingToggle({ cycle, onChange, plans, tone = 'marketing' }: BillingToggleProps) {
  const saving = bestAnnualSavingPercent(plans);
  const base = 'px-4 sm:px-6 py-2 rounded-md text-sm font-medium transition-colors';
  const active = tone === 'app' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-300 shadow-sm';
  const idle = 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';

  return (
    <div role="group" aria-label="Billing interval" className="inline-flex items-center bg-gray-200/80 dark:bg-gray-800 rounded-lg p-1">
      <button type="button" aria-pressed={cycle === 'MONTHLY'} onClick={() => onChange('MONTHLY')} className={`${base} ${cycle === 'MONTHLY' ? active : idle}`}>
        Monthly
      </button>
      <button type="button" aria-pressed={cycle === 'ANNUAL'} onClick={() => onChange('ANNUAL')} className={`${base} ${cycle === 'ANNUAL' ? active : idle}`}>
        Annually
        {saving > 0 && <span className="ml-2 text-xs text-green-600 dark:text-green-400">Save up to {saving}%</span>}
      </button>
    </div>
  );
}
