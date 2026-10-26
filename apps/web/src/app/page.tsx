import { HomeContent } from '@/components/home/HomeContent';
import { PublicPlans } from '@/components/pricing/PublicPlans';
import { fetchPublicPricing, lowestMonthlyPrice, onboardingSentence, PRICING_REVALIDATE_SECONDS } from '@/lib/pricing';

// The plans on this page come from the pricing API and are cached briefly. Publishing in the admin console refreshes it at once.
export const revalidate = PRICING_REVALIDATE_SECONDS;

export default async function HomePage() {
  const pricing = await fetchPublicPricing();
  const lowest = pricing ? lowestMonthlyPrice(pricing.plans) : null;
  const trial = pricing?.onboarding.policy === 'TRIAL' ? `${pricing.onboarding.days}-day free trial, then ` : '';
  const offerDescription = lowest ? `${trial}from ${lowest.monthly}/month` : 'Association management for Nigerian communities';
  const lead = onboardingSentence(pricing?.onboarding);
  const o = pricing?.onboarding;
  const startBadges = !o ? [] : o.policy === 'TRIAL' ? [`${o.days}-day free trial`, 'No credit card required'] : o.policy === 'COMPLIMENTARY' ? [`${o.days} days of complimentary access`] : [];

  return (
    <HomeContent
      offerDescription={offerDescription}
      startBadges={startBadges}
      pricingSlot={
        <>
          {lead && <p className="text-center text-gray-600 dark:text-gray-300 mb-8">{lead}</p>}
          <PublicPlans initial={pricing} variant="compact" />
        </>
      }
    />
  );
}
