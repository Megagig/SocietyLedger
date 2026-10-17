'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PricingCard from '@/components/subscription/PricingCard';
import { PlanWithFeatures, BillingCycle } from '@/types/subscription';
import { getTenantHeaders } from '@/utils/tenant';

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [trialLoadingPlanId, setTrialLoadingPlanId] = useState<number | null>(null);
  const [hasSubscription, setHasSubscription] = useState(true); // assume yes until confirmed otherwise, so the trial CTA doesn't flash in for existing subscribers
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
    checkExistingSubscription();
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/current`, {
        credentials: 'include',
        headers: getTenantHeaders(),
      });
      setHasSubscription(response.ok);
    } catch {
      setHasSubscription(true);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/plans`, {
        credentials: 'include',
        headers: getTenantHeaders(),
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
    // Redirect to checkout page with plan details
    router.push(`/dashboard/subscription/checkout?planId=${planId}&billingCycle=${cycle}`);
  };

  const handleStartTrial = async (planId: number) => {
    setError('');
    setTrialLoadingPlanId(planId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/start-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start trial');
      }

      router.push('/dashboard/subscription?trialStarted=1');
    } catch (err: any) {
      setError(err.message || 'Failed to start trial');
      setTrialLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Choose Your Plan
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
            Select the perfect plan for your association
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-4 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                billingCycle === 'MONTHLY'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-4 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                billingCycle === 'ANNUAL'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Annual
              <span className="ml-1 sm:ml-2 text-xs text-green-600 dark:text-green-400">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 sm:mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-center text-sm sm:text-base">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">
            Loading plans...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                onSelectPlan={handleSelectPlan}
                onStartTrial={hasSubscription ? undefined : handleStartTrial}
                isLoading={loadingPlanId === plan.id}
                isTrialLoading={trialLoadingPlanId === plan.id}
              />
            ))}
          </div>
        )}

        <div className="mt-8 sm:mt-12 text-center">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
