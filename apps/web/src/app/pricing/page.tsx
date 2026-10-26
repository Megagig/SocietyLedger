import { Container, Button } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { PublicPlans } from '@/components/pricing/PublicPlans';
import { AddonList } from '@/components/pricing/AddonList';
import { fetchPublicPricing, onboardingSentence, PRICING_REVALIDATE_SECONDS } from '@/lib/pricing';

// Pricing is read from the API (published plans only) and cached briefly. Publishing in the admin console refreshes this page at once.
export const revalidate = PRICING_REVALIDATE_SECONDS;

export default async function PricingPage() {
  const pricing = await fetchPublicPricing();
  const planNames = Object.fromEntries((pricing?.plans ?? []).map((p) => [p.code, p.name]));
  const onboarding = onboardingSentence(pricing?.onboarding);

  const faqs = [
    {
      q: 'Is there a free trial?',
      a: onboarding ? `${onboarding} When it ends, access pauses until you choose a plan. Your records are never deleted.` : 'Choose a plan to get started.',
    },
    {
      q: 'Can I change plans?',
      a: 'Yes. Moving to a higher plan takes effect straight away, and you are credited for the unused time on your current plan. Moving to a cheaper plan starts at the end of your current period.',
    },
    { q: 'What payment methods?', a: 'We accept cards, bank transfer and USSD payments through Paystack.' },
    { q: 'Are there setup fees?', a: 'No setup fees and no hidden charges. You pay the price of your plan for the period you choose, plus any add-ons you pick.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">Simple, Transparent Pricing</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Choose a plan that fits your association size and needs.
              {onboarding ? ` ${onboarding}` : ''}
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="xl">
          <PublicPlans initial={pricing} showComparison />
          {pricing && <AddonList addons={pricing.addons} planNames={planNames} />}

          <div className="mt-16 glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{f.q}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{f.a}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button component={Link} href="/faq" size="lg" variant="outline" className="border-2 border-teal-500 text-teal-600 dark:text-teal-400" rightSection={<IconArrowRight size={20} />}>
                View All FAQs
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
