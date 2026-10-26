import type { PublicPricing } from '@/types/pricing';

/**
 * Pricing for the public website. Every page that shows a plan or a price reads it through here, from the API's single pricing
 * endpoint (published plans only). There is no plan definition anywhere in the web app.
 */

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Seconds a rendered page may serve cached pricing. A publish also refreshes it at once (see app/api/revalidate). */
export const PRICING_REVALIDATE_SECONDS = 60;
export const PRICING_TAG = 'pricing';

/**
 * Server-side fetch used by the landing page, homepage and pricing page. Never throws: if the API is unreachable the pages render
 * without prices and the browser loads them itself (see PlanCards), instead of failing the page or caching an error.
 */
export async function fetchPublicPricing(): Promise<PublicPricing | null> {
  try {
    const response = await fetch(`${apiBase()}/api/public/pricing`, {
      next: { revalidate: PRICING_REVALIDATE_SECONDS, tags: [PRICING_TAG] },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success: boolean; data?: PublicPricing };
    return body.success && body.data ? body.data : null;
  } catch {
    return null;
  }
}

/** Browser-side fetch (sign-up page, and the fallback when the server could not load pricing). */
export async function fetchPublicPricingInBrowser(): Promise<PublicPricing | null> {
  try {
    const response = await fetch(`${apiBase()}/api/public/pricing`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { success: boolean; data?: PublicPricing };
    return body.success && body.data ? body.data : null;
  } catch {
    return null;
  }
}

// Pure display helpers live in ./pricing-text (no network, easy to test) and are re-exported here for the pages.
export { addonsForPlan, formatKobo, lowestMonthlyPrice, onboardingSentence, signupLabel } from './pricing-text';
