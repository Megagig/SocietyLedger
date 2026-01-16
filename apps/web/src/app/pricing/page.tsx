'use client';

import { Container, Button } from '@mantine/core';
import { IconUsers, IconCheck, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '₦5,000',
      period: '/month',
      description: 'Perfect for small associations getting started',
      features: [
        'Up to 50 members',
        'Basic financial tracking',
        'Member management',
        'Dues and levies tracking',
        'Email notifications',
        'Basic reports',
        'Email support',
        'Mobile responsive'
      ],
      highlighted: false,
      cta: 'Start Free Trial'
    },
    {
      name: 'Professional',
      price: '₦15,000',
      period: '/month',
      description: 'Most popular for growing associations',
      features: [
        'Up to 200 members',
        'Advanced financial tracking',
        'Welfare fund management',
        'SMS notifications (credits separate)',
        'Advanced reporting & analytics',
        'Document storage',
        'Meeting management',
        'Priority support',
        'Custom branding',
        'Role-based permissions'
      ],
      highlighted: true,
      cta: 'Start Free Trial'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations with complex needs',
      features: [
        'Unlimited members',
        'All Professional features',
        'Multiple associations',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'Custom training sessions',
        'SLA guarantee',
        'White-label options',
        'Priority feature requests'
      ],
      highlighted: false,
      cta: 'Contact Sales'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Simple, Transparent Pricing
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Choose a plan that fits your association size and needs. All plans include a 14-day free trial.
            </p>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div 
                key={idx}
                className={`glass-strong p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                  plan.highlighted 
                    ? 'border-teal-500 shadow-xl shadow-teal-500/20 relative' 
                    : 'border-gray-200/50 dark:border-gray-700/50'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-teal-500 to-green-500 text-white text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-teal-600 dark:text-teal-400">
                    {plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {plan.period}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {plan.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2">
                      <IconCheck size={20} className="text-teal-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  component={Link}
                  href={plan.name === 'Enterprise' ? '/contact' : '/signup'}
                  fullWidth
                  size="lg"
                  className={
                    plan.highlighted
                      ? 'bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white'
                      : 'border-2 border-teal-500 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                  }
                  variant={plan.highlighted ? 'filled' : 'outline'}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-16 glass-strong p-10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Is there a free trial?</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Yes! All plans include a 14-day free trial with full access to features. No credit card required.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Can I change plans?</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Absolutely! You can upgrade or downgrade at any time. Changes take effect immediately.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">What payment methods?</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  We accept bank transfers, card payments via Paystack, and USSD payments.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Are there setup fees?</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  No setup fees, no hidden charges. You only pay the monthly subscription fee.
                </p>
              </div>
            </div>
            <div className="text-center mt-8">
              <Button 
                component={Link}
                href="/faq"
                size="lg"
                variant="outline"
                className="border-2 border-teal-500 text-teal-600 dark:text-teal-400"
                rightSection={<IconArrowRight size={20} />}
              >
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
