'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { subscriptionsApi, type CurrentSubscription, type PurchasableCatalog } from '@/lib/api/subscriptions';
import type { CheckoutQuote } from '@/types/pricing';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AddonsPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PurchasableCatalog | null>(null);
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [pricing, setPricing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([subscriptionsApi.catalog(), subscriptionsApi.current().catch(() => null)])
      .then(([c, s]) => {
        setCatalog(c);
        setCurrent(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load add-ons'))
      .finally(() => setLoaded(true));
  }, []);

  const running = !!current && current.access.allowed && !current.access.inGrace && current.status !== 'TRIALING' && new Date(current.currentPeriodEnd).getTime() > Date.now();
  const heldIds = useMemo(() => new Set((current?.addons ?? []).filter((a) => !a.cancelAtPeriodEnd).map((a) => a.addonId)), [current]);
  const available = useMemo(
    () => (catalog && current ? catalog.addons.filter((a) => (a.eligiblePlanCodes.length === 0 || a.eligiblePlanCodes.includes(current.plan.code)) && !heldIds.has(a.id)) : []),
    [catalog, current, heldIds],
  );

  // Priced by the server every time the selection changes, pro rata to the plan's renewal date.
  const reprice = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      setQuote(null);
      return;
    }
    setPricing(true);
    setError('');
    try {
      setQuote(await subscriptionsApi.quoteAddons(ids));
    } catch (e) {
      setQuote(null);
      setError(e instanceof Error ? e.message : 'Failed to price these add-ons');
    } finally {
      setPricing(false);
    }
  }, []);

  const toggle = (id: number) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    void reprice(next);
  };

  const pay = async () => {
    if (selected.length === 0) return;
    setPaying(true);
    setError('');
    try {
      const result = await subscriptionsApi.payAddons({ addonIds: selected, provider: catalog?.providers.length === 1 ? catalog.providers[0] : undefined });
      if (result.type === 'PAYMENT') {
        window.location.href = result.authorizationUrl;
        return;
      }
      router.push('/dashboard/subscription?updated=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the payment');
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/dashboard/subscription')} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 sm:mb-6 text-sm sm:text-base">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Subscription
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">Add-ons</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
            Add-ons run until your plan&apos;s renewal date and renew together with your plan, so you only pay for the days left in this period.
          </p>

          {error && (
            <div role="alert" className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-3 py-2.5 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!loaded ? (
            <p className="text-gray-600 dark:text-gray-400">Loading add-ons...</p>
          ) : !running ? (
            <div className="text-gray-700 dark:text-gray-300">
              <p>Add-ons can be bought while you have an active paid subscription.</p>
              <button onClick={() => router.push('/dashboard/subscription/plans')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm">
                Choose a plan
              </button>
            </div>
          ) : available.length === 0 ? (
            <p className="text-gray-700 dark:text-gray-300">There are no more add-ons available for your plan right now.</p>
          ) : (
            <>
              <div className="space-y-3">
                {available.map((addon) => {
                  const on = selected.includes(addon.id);
                  const price = current!.billingCycle === 'ANNUAL' ? `${addon.prices.annual}/year` : `${addon.prices.monthly}/month`;
                  return (
                    <label key={addon.id} className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${on ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                      <input type="checkbox" className="mt-1" checked={on} onChange={() => toggle(addon.id)} disabled={paying} />
                      <span className="flex-1">
                        <span className="block font-medium text-gray-900 dark:text-white">{addon.name}</span>
                        {addon.description && <span className="block text-sm text-gray-600 dark:text-gray-400">{addon.description}</span>}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{price}</span>
                    </label>
                  );
                })}
              </div>

              {quote && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4" aria-live="polite">
                  {quote.lines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-3 text-sm py-1">
                      <span className="text-gray-700 dark:text-gray-300">{l.label}</span>
                      <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{l.amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center mt-3">
                    <span className="font-semibold text-gray-900 dark:text-white">Total today</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{quote.total}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Runs until {date(quote.periodEndsAt)}, then renews with your plan.</p>
                </div>
              )}

              <button
                onClick={pay}
                disabled={!quote || pricing || paying}
                className={`w-full mt-6 py-3 px-6 rounded-xl font-semibold text-white flex items-center justify-center ${quote && !pricing && !paying ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                {paying || pricing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {paying ? 'Processing...' : quote ? `Pay ${quote.total}` : 'Choose an add-on'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
