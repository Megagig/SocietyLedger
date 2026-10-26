'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import { HelpLink } from '@/components/docs/HelpLink';
import { subscriptionsApi, type CurrentSubscription } from '@/lib/api/subscriptions';
import { formatKobo } from '@/lib/pricing';

const date = (iso: string | Date) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

const SOURCE_LABEL: Record<CurrentSubscription['source'], string> = {
  ONBOARDING: 'Welcome subscription',
  PURCHASE: 'Paid',
  MANUAL: 'Activated by SocietyLedger',
  COMPLIMENTARY: 'Complimentary',
};

function StatusBadge({ sub }: { sub: CurrentSubscription }) {
  const ended = !sub.access.allowed;
  const key = ended ? 'EXPIRED' : sub.access.inGrace ? 'PAST_DUE' : sub.status;
  const label = ended ? 'Ended' : sub.access.inGrace ? 'Renew now' : sub.status === 'TRIALING' ? 'Free trial' : sub.source === 'COMPLIMENTARY' ? 'Complimentary' : sub.status === 'ACTIVE' ? 'Active' : sub.status === 'CANCELLED' ? 'Cancelled' : sub.status;
  const badges: Record<string, { color: string; Icon: typeof CheckCircle2 }> = {
    ACTIVE: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', Icon: CheckCircle2 },
    TRIALING: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', Icon: AlertCircle },
    PAST_DUE: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', Icon: AlertCircle },
    CANCELLED: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', Icon: XCircle },
    EXPIRED: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', Icon: XCircle },
  };
  const { color, Icon } = badges[key] ?? badges.ACTIVE;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4 mr-1" />
      {label}
    </span>
  );
}

function SubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSubscription(await subscriptionsApi.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch subscription');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (searchParams.get('updated') === '1') toast.success('Your subscription has been updated.');
    if (searchParams.get('scheduled') === '1') toast.success('Your plan change is scheduled for the end of your current period.');
    if (searchParams.get('updated') || searchParams.get('scheduled')) router.replace('/dashboard/subscription');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSubscription = () => {
    modals.openConfirmModal({
      title: 'Cancel Subscription',
      children: <Text size="sm">Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.</Text>,
      labels: { confirm: 'Cancel Subscription', cancel: 'Keep Subscription' },
      confirmProps: { color: 'red' },
      onConfirm: () => run(subscriptionsApi.cancel, 'Subscription cancelled successfully'),
    });
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">{error ? 'Could not load your subscription' : 'No Subscription'}</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">{error || 'You do not have a subscription yet. Choose a plan to get started.'}</p>
          <button onClick={() => router.push('/dashboard/subscription/plans')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 px-5 sm:px-6 rounded-lg transition-colors text-sm sm:text-base w-full sm:w-auto">
            View Plans
          </button>
        </div>
      </div>
    );
  }

  const ended = !subscription.access.allowed;
  const priceKobo = subscription.terms ? (subscription.billingCycle === 'MONTHLY' ? subscription.terms.prices.monthlyKobo : subscription.terms.prices.annualKobo) : null;
  const endsOn = subscription.status === 'TRIALING' && subscription.trialEndsAt ? subscription.trialEndsAt : subscription.currentPeriodEnd;
  const unpaid = subscription.source !== 'PURCHASE';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Subscription Details</h1>
          <HelpLink />
        </div>
        <div className="flex gap-4">
          {!ended && (
            <button onClick={() => router.push('/dashboard/subscription/addons')} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium text-sm sm:text-base">
              Add-ons
            </button>
          )}
          <button onClick={() => router.push('/dashboard/subscription/plans')} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium text-sm sm:text-base">
            {ended ? 'Resubscribe' : 'Change Plan'}
          </button>
        </div>
      </div>

      {ended && (
        <div role="alert" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
          <p className="font-semibold">Your subscription ended on {date(subscription.currentPeriodEnd)}.</p>
          <p className="text-sm mt-1">Access is paused until you choose a plan and pay. Your records are safe.</p>
          <button onClick={() => router.push('/dashboard/subscription/plans')} className="mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">
            Resubscribe Now
          </button>
        </div>
      )}
      {!ended && subscription.access.inGrace && subscription.access.graceEndsAt && (
        <div role="status" className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4 text-yellow-900 dark:text-yellow-100">
          <p className="font-semibold">Your subscription period has ended.</p>
          <p className="text-sm mt-1">You can keep using SocietyLedger until {date(subscription.access.graceEndsAt)}. Renew before then to avoid a pause.</p>
          <button onClick={() => router.push('/dashboard/subscription/plans')} className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">
            Renew now
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">{subscription.plan.name}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{subscription.plan.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {SOURCE_LABEL[subscription.source]}
              {subscription.terms ? ` · plan terms version ${subscription.terms.version}` : ''}
            </p>
          </div>
          <StatusBadge sub={subscription} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
          <div className="flex items-start p-3 sm:p-0 bg-gray-50 dark:bg-gray-700/50 sm:bg-transparent rounded-lg">
            <CreditCard className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Billing Cycle</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{subscription.billingCycle === 'MONTHLY' ? 'Monthly' : 'Annual'}</div>
              <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                {unpaid ? 'No charge for this period' : priceKobo !== null ? `${formatKobo(priceKobo)}/${subscription.billingCycle === 'MONTHLY' ? 'month' : 'year'}` : ''}
              </div>
              {unpaid && priceKobo !== null && <div className="text-xs text-gray-500 dark:text-gray-400">Renews at {formatKobo(priceKobo)}/{subscription.billingCycle === 'MONTHLY' ? 'month' : 'year'}</div>}
            </div>
          </div>

          <div className="flex items-start p-3 sm:p-0 bg-gray-50 dark:bg-gray-700/50 sm:bg-transparent rounded-lg">
            <Calendar className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{ended ? 'Ended on' : subscription.status === 'TRIALING' ? 'Trial Ends' : 'Next Renewal'}</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{date(endsOn)}</div>
            </div>
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200">Your subscription will be cancelled on {date(subscription.currentPeriodEnd)}</p>
          </div>
        )}

        {subscription.pendingPlan && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm sm:text-base text-blue-800 dark:text-blue-200">
              Switching to <strong>{subscription.pendingPlan.name}</strong> on {date(subscription.currentPeriodEnd)}. Choose your current plan again on the Change Plan page to cancel this.
            </p>
          </div>
        )}

        {!ended && subscription.status !== 'TRIALING' && (
          <div className="mt-4 sm:mt-6">
            {subscription.cancelAtPeriodEnd ? (
              <button onClick={() => run(subscriptionsApi.reactivate, 'Subscription reactivated successfully')} disabled={busy} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base">
                {busy ? 'Processing...' : 'Reactivate Subscription'}
              </button>
            ) : (
              <button onClick={handleCancelSubscription} disabled={busy} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base">
                {busy ? 'Processing...' : 'Cancel Subscription'}
              </button>
            )}
          </div>
        )}
      </div>

      {subscription.addons.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Add-ons</h3>
          <div className="space-y-2 sm:space-y-3">
            {subscription.addons.map((addon) => (
              <div key={addon.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{addon.name}</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {addon.cancelAtPeriodEnd ? `Ends ${date(addon.endsAt)}, will not renew` : `Renews with your plan on ${date(addon.endsAt)}`}
                  </div>
                </div>
                <button
                  onClick={() => run(() => subscriptionsApi.setAddonRenewal(addon.id, !addon.cancelAtPeriodEnd), addon.cancelAtPeriodEnd ? 'This add-on will renew with your plan.' : 'This add-on will not renew.')}
                  disabled={busy}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 text-left sm:text-right"
                >
                  {addon.cancelAtPeriodEnd ? 'Keep this add-on' : 'Do not renew'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subscription.payments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Payment History</h3>
          <div className="space-y-2 sm:space-y-3">
            {subscription.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{formatKobo(Math.round(Number(payment.amount) * 100))}</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {date(payment.createdAt)} · {payment.purpose === 'ADDON' ? 'Add-on' : payment.purpose === 'PLAN_CHANGE' ? 'Plan change' : 'Subscription'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                {payment.status === 'SUCCESS' && !payment.needsReview && (
                  <a href={`/dashboard/subscription/receipt/${payment.id}`} className="text-xs sm:text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
                    Receipt
                  </a>
                )}
                <span
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                    payment.needsReview ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : payment.status === 'SUCCESS' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : payment.status === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }`}
                >
                  {payment.needsReview ? 'Being checked' : payment.status === 'SUCCESS' ? 'Paid' : payment.status === 'PENDING' ? 'Pending' : payment.status === 'FAILED' ? 'Failed' : payment.status}
                </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-600 dark:text-gray-400">Loading subscription...</div>}>
      <SubscriptionContent />
    </Suspense>
  );
}
