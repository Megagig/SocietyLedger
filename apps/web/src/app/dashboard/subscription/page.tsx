'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SubscriptionWithPlan } from '@/types/subscription';
import { CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { getTenantHeaders } from '@/utils/tenant';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import { HelpLink } from '@/components/docs/HelpLink';

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSubscription();

    if (searchParams.get('trialStarted') === '1') {
      toast.success('Your 14-day free trial has started — no payment needed until it ends.');
      router.replace('/dashboard/subscription');
    }
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/current`,
        {
          credentials: 'include',
          headers: getTenantHeaders(),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setSubscription(data.data);
      } else if (response.status === 404) {
        // No subscription found
        setSubscription(null);
      } else {
        throw new Error(data.message || 'Failed to fetch subscription');
      }
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    modals.openConfirmModal({
      title: 'Cancel Subscription',
      children: <Text size="sm">Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.</Text>,
      labels: { confirm: 'Cancel Subscription', cancel: 'Keep Subscription' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/cancel`,
            {
              method: 'POST',
              credentials: 'include',
              headers: getTenantHeaders(),
            }
          );

          const data = await response.json();

          if (response.ok && data.success) {
            toast.success('Subscription cancelled successfully');
            fetchSubscription();
          } else {
            throw new Error(data.message || 'Failed to cancel subscription');
          }
        } catch (error: any) {
          toast.error(error.message || 'Failed to cancel subscription');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleReactivateSubscription = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/reactivate`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getTenantHeaders(),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Subscription reactivated successfully');
        fetchSubscription();
      } else {
        throw new Error(data.message || 'Failed to reactivate subscription');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reactivate subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      ACTIVE: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
      TRIALING: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: AlertCircle },
      PAST_DUE: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertCircle },
      CANCELLED: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
      EXPIRED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: XCircle },
    };

    const badge = badges[status as keyof typeof badges] || badges.ACTIVE;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading subscription...</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 text-center">
          <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            No Active Subscription
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
            You don't have an active subscription. Choose a plan to get started.
          </p>
          <button
            onClick={() => router.push('/dashboard/subscription/plans')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 px-5 sm:px-6 rounded-lg transition-colors text-sm sm:text-base w-full sm:w-auto"
          >
            View Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Subscription Details
          </h1>
          <HelpLink />
        </div>
        <button
          onClick={() => router.push('/dashboard/subscription/plans')}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium text-sm sm:text-base"
        >
          Change Plan
        </button>
      </div>

      {/* Current Plan */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              {subscription.plan.name}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {subscription.plan.description}
            </p>
          </div>
          {getStatusBadge(subscription.status)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
          <div className="flex items-start p-3 sm:p-0 bg-gray-50 dark:bg-gray-700/50 sm:bg-transparent rounded-lg">
            <CreditCard className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Billing Cycle</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                {subscription.billingCycle === 'MONTHLY' ? 'Monthly' : 'Annual'}
              </div>
              <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                ₦{(subscription.billingCycle === 'MONTHLY' 
                  ? Number(subscription.plan.priceMonthly) 
                  : Number(subscription.plan.priceAnnual)
                ).toLocaleString('en-NG')}
              </div>
            </div>
          </div>

          <div className="flex items-start p-3 sm:p-0 bg-gray-50 dark:bg-gray-700/50 sm:bg-transparent rounded-lg">
            <Calendar className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {subscription.status === 'TRIALING' ? 'Trial Ends' : 'Next Billing Date'}
              </div>
              <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                {new Date(
                  subscription.status === 'TRIALING' && subscription.trialEndsAt
                    ? subscription.trialEndsAt
                    : subscription.currentPeriodEnd
                ).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200">
              Your subscription will be cancelled on{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          </div>
        )}

        {subscription.pendingPlan && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm sm:text-base text-blue-800 dark:text-blue-200">
              Switching to <strong>{subscription.pendingPlan.name}</strong> on{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. Choose your current plan
              again on the Change Plan page to cancel this.
            </p>
          </div>
        )}

        <div className="mt-4 sm:mt-6">
          {subscription.cancelAtPeriodEnd ? (
            <button
              onClick={handleReactivateSubscription}
              disabled={actionLoading}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              {actionLoading ? 'Processing...' : 'Reactivate Subscription'}
            </button>
          ) : (
            <button
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              {actionLoading ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Payment History */}
      {subscription.payments && subscription.payments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Payment History
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {subscription.payments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                    ₦{Number(payment.amount).toLocaleString('en-NG')}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                  payment.status === 'SUCCESS'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
