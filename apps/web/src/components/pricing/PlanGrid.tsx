'use client';

import type { ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';
import type { BillingCycle, PricingPlan } from '@/types/pricing';
import { formatKobo, planCardContent } from '@/lib/pricing';

interface PlanGridProps {
  plans: PricingPlan[];
  cycle: BillingCycle;
  /** The call to action on each card (a link on the marketing pages, a button inside the app). */
  renderAction: (plan: PricingPlan, cycle: BillingCycle) => ReactNode;
  /** Highlights the plan the association is on now. */
  currentPlanId?: number | null;
  /** compact: the homepage teaser (fewer bullets). full: the pricing page and the plan chooser. */
  variant?: 'full' | 'compact';
  tone?: 'marketing' | 'app';
}

/**
 * The plan cards. Everything shown (name, copy, prices, limits, what is included, the recommended flag) is read from the plan the
 * server sent. Nothing about a plan is written in this file.
 */
export function PlanGrid({ plans, cycle, renderAction, currentPlanId = null, variant = 'full', tone = 'marketing' }: PlanGridProps) {
  const cols = plans.length >= 3 ? 'md:grid-cols-3' : plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md mx-auto';
  const marketing = tone === 'marketing';

  return (
    <div className={`grid grid-cols-1 ${cols} gap-6 lg:gap-8`}>
      {plans.map((plan) => {
        const highlighted = plan.isRecommended;
        const isCurrent = currentPlanId === plan.id;
        const price = cycle === 'ANNUAL' ? plan.prices.annual : plan.prices.monthly;
        const per = cycle === 'ANNUAL' ? '/year' : '/month';
        const badge = isCurrent ? 'Your current plan' : plan.badgeLabel ?? (highlighted ? 'Recommended' : null);
        const perMonth = cycle === 'ANNUAL' && plan.prices.annualKobo > 0 ? formatKobo(Math.round(plan.prices.annualKobo / 12)) : null;

        const card = marketing
          ? `glass-strong p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] relative ${highlighted ? 'border-primary-500 shadow-xl shadow-primary-500/20' : 'border-gray-200/50 dark:border-gray-700/50'}`
          : `bg-white dark:bg-gray-800 rounded-xl p-6 border-2 relative ${isCurrent || highlighted ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`;

        return (
          <div key={plan.id} className={card} data-testid={`plan-card-${plan.code}`}>
            {badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full bg-gradient-to-r from-primary-500 to-green-500 text-white text-sm font-semibold whitespace-nowrap">{badge}</span>
              </div>
            )}
            <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{plan.name}</h3>
            <div className="mb-1">
              <span className="text-4xl font-bold text-primary-600 dark:text-primary-400" data-testid="plan-price">
                {price}
              </span>
              <span className="text-gray-600 dark:text-gray-400">{per}</span>
            </div>
            <div className="mb-4 min-h-[1.25rem] text-sm text-gray-500 dark:text-gray-400">
              {cycle === 'ANNUAL' && perMonth ? (
                <>
                  {perMonth}/month
                  {plan.prices.annualSavingsKobo > 0 && <span className="ml-2 text-green-600 dark:text-green-400">Save {plan.prices.annualSavings}</span>}
                </>
              ) : null}
            </div>
            {plan.description && <p className="text-gray-600 dark:text-gray-300 mb-6">{plan.description}</p>}
            <ul className="space-y-3 mb-8">
              {planCardContent(plan, variant).bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <IconCheck size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{bullet}</span>
                </li>
              ))}
            </ul>
            {planCardContent(plan, variant).features.length > 0 && (
              <p className="mb-8 -mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-600 dark:text-gray-300">Also includes: </span>
                {planCardContent(plan, variant).features.join(', ')}
              </p>
            )}
            {renderAction(plan, cycle)}
          </div>
        );
      })}
    </div>
  );
}
