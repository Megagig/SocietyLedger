'use client';

import { useEffect, useState } from 'react';
import type { PublicPricing } from '@/types/pricing';
import { fetchPublicPricingInBrowser } from '@/lib/pricing';

/** The public pricing, loaded in the browser, for pages that are client components (FAQ and the like). Null until it arrives or if it cannot. */
export function usePublicPricing(): PublicPricing | null {
  const [pricing, setPricing] = useState<PublicPricing | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPublicPricingInBrowser().then((p) => {
      if (!cancelled) setPricing(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return pricing;
}
