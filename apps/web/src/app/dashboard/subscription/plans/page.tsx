'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PricingCard from '@/components/subscription/PricingCard';
import { PlanWithFeatures, BillingCycle } from '@/types/subscription';

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/plans`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setError('Failed to load subscription plans');
    }
  };

  const handleSelectPlan = async (planId: number, cycle: BillingCycle) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          billingCycle: cycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      // Redirect to Paystack checkout
      if (data.data?.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      }
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      setError(error.message || 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Select the perfect plan for your association
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'MONTHLY'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'ANNUAL'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Annual
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                Save up to 20%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">
            Loading plans...
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                onSelectPlan={handleSelectPlan}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
