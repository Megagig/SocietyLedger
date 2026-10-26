'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subscriptionsApi, type CurrentSubscription, type PurchasableCatalog } from '@/lib/api/subscriptions';
import { BillingToggle } from '@/components/pricing/BillingToggle';
import { PlanGrid } from '@/components/pricing/PlanGrid';
import { PlanComparison } from '@/components/pricing/PlanComparison';
import type { BillingCycle } from '@/types/pricing';

export default function PlansPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PurchasableCatalog | null>(null);
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, sub] = await Promise.all([subscriptionsApi.catalog(), subscriptionsApi.current().catch(() => null)]);
        if (cancelled) return;
        setCatalog(c);
        setCurrent(sub);
        if (sub) setCycle(sub.billingCycle);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load subscription plans');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ended = !!current && !current.access.allowed;
  const inGrace = !!current && current.access.allowed && current.access.inGrace;

  const choose = (planId: number, billingCycle: BillingCycle) => {
    router.push(`/dashboard/subscription/checkout?planId=${planId}&billingCycle=${billingCycle}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Choose Your Plan</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
            {ended
              ? 'Your subscription has ended. Choose a plan to restore access. Nothing you entered has been deleted.'
              : inGrace
                ? 'Your subscription period has ended. Renew now to keep access without a break.'
                : 'Select the plan that fits your association. Switch between monthly and annual billing below.'}
          </p>
          {catalog && <BillingToggle cycle={cycle} onChange={setCycle} plans={catalog.plans} tone="app" />}
        </div>

        {error && (
          <div role="alert" className="mb-6 sm:mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-center text-sm sm:text-base">
            {error}
          </div>
        )}

        {!catalog && !error ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading plans...</div>
        ) : catalog && catalog.plans.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">No plans are available right now. Please contact support.</div>
        ) : catalog ? (
          <>
            <PlanGrid
              plans={catalog.plans}
              cycle={cycle}
              tone="app"
              currentPlanId={current?.access.allowed ? current.planId : null}
              renderAction={(plan, c) => {
                const isCurrent = current?.access.allowed && current.planId === plan.id && current.billingCycle === c && !current.access.inGrace;
                const label = ended || inGrace ? (ended ? 'Resubscribe' : 'Renew') : current?.planId === plan.id && current.billingCycle === c ? 'Renew' : current ? 'Switch to this plan' : 'Choose plan';
                return (
                  <button
                    type="button"
                    onClick={() => choose(plan.id, c)}
                    className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors ${isCurrent ? 'border-2 border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    {label}
                  </button>
                );
              }}
            />
            <div className="mt-12">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Compare plans</h2>
              <PlanComparison plans={catalog.plans} />
            </div>
          </>
        ) : null}

        <p className="mt-8 sm:mt-12 text-center text-sm sm:text-base text-gray-600 dark:text-gray-400">
          You will review the exact amount before you pay. Prices are set by SocietyLedger and are confirmed again when you check out.
        </p>
      </div>
    </div>
  );
}
