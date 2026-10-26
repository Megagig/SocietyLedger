'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import type { BillingCycle, PublicPricing } from '@/types/pricing';
import { fetchPublicPricingInBrowser, signupLabel } from '@/lib/pricing';
import { BillingToggle } from './BillingToggle';
import { PlanGrid } from './PlanGrid';
import { PlanComparison } from './PlanComparison';

interface PublicPlansProps {
  /** Pricing the server loaded for this page. Null when the API could not be reached: the browser then loads it itself. */
  initial: PublicPricing | null;
  variant?: 'full' | 'compact';
  showComparison?: boolean;
}

/**
 * The plans on the public website (landing page, homepage, pricing page). Same component and same data source everywhere, so the three
 * can never disagree with each other or with checkout.
 */
export function PublicPlans({ initial, variant = 'full', showComparison = false }: PublicPlansProps) {
  const [pricing, setPricing] = useState<PublicPricing | null>(initial);
  const [failed, setFailed] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');

  useEffect(() => {
    if (initial) {
      setPricing(initial);
      return;
    }
    let cancelled = false;
    fetchPublicPricingInBrowser().then((p) => {
      if (cancelled) return;
      if (p) setPricing(p);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  if (!pricing) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-400" role="status">
        {failed ? 'Prices are unavailable right now. Please try again in a moment.' : 'Loading prices...'}
      </p>
    );
  }
  if (pricing.plans.length === 0) {
    return <p className="text-center text-gray-600 dark:text-gray-400">Plans are being updated. Please check back shortly.</p>;
  }

  return (
    <div className="space-y-10">
      <div className="text-center">
        <BillingToggle cycle={cycle} onChange={setCycle} plans={pricing.plans} />
      </div>
      <PlanGrid
        plans={pricing.plans}
        cycle={cycle}
        variant={variant}
        renderAction={(plan) => (
          <Button
            component={Link}
            href="/signup"
            fullWidth
            size="lg"
            className={plan.isRecommended ? 'bg-gradient-to-r from-primary-500 to-green-500 hover:from-primary-600 hover:to-green-600 text-white' : 'border-2 border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'}
            variant={plan.isRecommended ? 'filled' : 'outline'}
          >
            {signupLabel(pricing.onboarding)}
          </Button>
        )}
      />
      {showComparison && <PlanComparison plans={pricing.plans} />}
    </div>
  );
}
