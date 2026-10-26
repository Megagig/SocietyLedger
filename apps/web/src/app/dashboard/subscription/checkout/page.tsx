'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Shield, Lock, CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { subscriptionsApi, type PurchasableCatalog } from '@/lib/api/subscriptions';
import type { BillingCycle, CheckoutQuote } from '@/types/pricing';

type PaymentProvider = 'paystack' | 'nomba';

// How each provider is presented. Whether it is OFFERED is decided by the server (catalog.providers), never by this list.
const PROVIDER_CARDS: Record<PaymentProvider, { name: string; description: string; logo: string; features: string[]; color: string; borderColor: string; bgColor: string }> = {
  paystack: {
    name: 'Paystack',
    description: 'Pay with card, bank transfer, or USSD',
    logo: '/images/paystack-logo.jpeg',
    features: ['Cards (Visa, Mastercard)', 'Bank Transfer', 'USSD'],
    color: 'from-cyan-500 to-blue-500',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
  },
  nomba: {
    name: 'Nomba',
    description: 'Pay with card or bank transfer',
    logo: '/images/nomba-logo.png',
    features: ['Cards (Visa, Mastercard)', 'Bank Transfer', 'QR Payment'],
    color: 'from-indigo-500 to-purple-500',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
  },
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = Number(searchParams.get('planId'));
  const cycleParam = searchParams.get('billingCycle');
  const billingCycle: BillingCycle | null = cycleParam === 'MONTHLY' || cycleParam === 'ANNUAL' ? cycleParam : null;

  const [catalog, setCatalog] = useState<PurchasableCatalog | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  // null = "whatever the server includes by default" (the add-ons the association already has); an array = the person's own choice
  const [addonIds, setAddonIds] = useState<number[] | null>(null);
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [pricing, setPricing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planId || !billingCycle) router.push('/dashboard/subscription/plans');
  }, [planId, billingCycle, router]);

  useEffect(() => {
    subscriptionsApi
      .catalog()
      .then((c) => {
        setCatalog(c);
        if (c.providers.length === 1) setProvider(c.providers[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load payment options'));
  }, []);

  // Every change to the plan, the billing interval or the add-ons is priced again by the server. The page never works out an amount.
  const reprice = useCallback(async () => {
    if (!planId || !billingCycle) return;
    setPricing(true);
    setError('');
    try {
      const q = await subscriptionsApi.quote({ planId, billingCycle, addonIds: addonIds ?? undefined });
      setQuote(q);
      if (addonIds === null) setAddonIds(q.addons.map((a) => a.addonId));
    } catch (e) {
      setQuote(null);
      setError(e instanceof Error ? e.message : 'Failed to price this order');
    } finally {
      setPricing(false);
    }
  }, [planId, billingCycle, addonIds]);

  useEffect(() => {
    void reprice();
  }, [reprice]);

  const eligibleAddons = useMemo(() => (catalog && quote ? catalog.addons.filter((a) => a.eligiblePlanCodes.length === 0 || a.eligiblePlanCodes.includes(quote.planCode)) : []), [catalog, quote]);

  const toggleAddon = (id: number) => {
    const current = addonIds ?? [];
    setAddonIds(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const handlePayment = async () => {
    if (!planId || !billingCycle || !quote) return;
    setPaying(true);
    setError('');
    try {
      const result = await subscriptionsApi.pay({ planId, billingCycle, addonIds: addonIds ?? undefined, provider: provider ?? undefined });
      if (result.type === 'PAYMENT') {
        window.location.href = result.authorizationUrl;
        return;
      }
      router.push(result.type === 'DEFERRED' ? '/dashboard/subscription?scheduled=1' : '/dashboard/subscription?updated=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the payment');
      setPaying(false);
    }
  };

  const providers = catalog?.providers ?? [];
  const canPay = !!quote && !pricing && !paying && (providers.length === 0 ? false : provider !== null || providers.length === 1);
  const actionLabel = quote?.deferred ? 'Schedule this change' : quote?.totalKobo === 0 ? 'Confirm' : `Pay ${quote?.total ?? ''}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/dashboard/subscription/plans')} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 sm:mb-6 transition-colors text-sm sm:text-base">
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Back to Plans
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
          {/* Order summary: every figure comes from the server's quote */}
          <div className="lg:col-span-2 lg:order-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-8" aria-live="polite">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Order Summary</h2>

              {quote ? (
                <>
                  <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                    {quote.lines.map((line, i) => (
                      <div key={`${line.type}-${i}`} className="flex justify-between items-start gap-3 text-sm">
                        <span className={line.type === 'CREDIT' ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'}>{line.label}</span>
                        <span className={`font-semibold whitespace-nowrap ${line.type === 'CREDIT' ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>{line.amount}</span>
                      </div>
                    ))}
                  </div>

                  {quote.deferred ? (
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
                      This is a move to a lower plan. Nothing is charged now: it takes effect when your current period ends on{' '}
                      {quote.deferredEffectiveAt ? new Date(quote.deferredEffectiveAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'its end date'}.
                    </div>
                  ) : (
                    <div className="pt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                        <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="checkout-total">
                          {quote.total}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {quote.billingCycle === 'MONTHLY' ? 'Billed monthly' : 'Billed annually'}. Your access runs until{' '}
                        {new Date(quote.periodEndsAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.
                      </p>
                    </div>
                  )}
                </>
              ) : error ? null : (
                <div className="animate-pulse" aria-label="Pricing your order">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 lg:order-1 space-y-4 sm:space-y-6">
            {eligibleAddons.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Add-ons</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Optional extras. They renew together with your plan.</p>
                <div className="space-y-3">
                  {eligibleAddons.map((addon) => {
                    const on = (addonIds ?? []).includes(addon.id);
                    return (
                      <label key={addon.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${on ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                        <input type="checkbox" className="mt-1" checked={on} onChange={() => toggleAddon(addon.id)} disabled={pricing || paying} />
                        <span className="flex-1">
                          <span className="block font-medium text-gray-900 dark:text-white">{addon.name}</span>
                          {addon.description && <span className="block text-sm text-gray-600 dark:text-gray-400">{addon.description}</span>}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{billingCycle === 'ANNUAL' ? `${addon.prices.annual}/year` : `${addon.prices.monthly}/month`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">{quote?.deferred ? 'Confirm your change' : providers.length > 1 ? 'Choose Payment Method' : 'Payment'}</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
                {quote?.deferred ? 'Review the change on the right, then confirm.' : providers.length > 1 ? 'Select your preferred payment provider to complete your subscription' : 'You will be taken to Paystack to pay securely, then brought back here.'}
              </p>

              {error && (
                <div role="alert" className="mb-4 sm:mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* The provider picker only appears when the server offers more than one. */}
              {!quote?.deferred && providers.length > 1 && (
                <div className="space-y-3 sm:space-y-4">
                  {providers.map((id) => {
                    const card = PROVIDER_CARDS[id];
                    const selected = provider === id;
                    return (
                      <div
                        key={id}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        onClick={() => setProvider(id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setProvider(id)}
                        className={`relative cursor-pointer rounded-xl border-2 p-4 sm:p-5 transition-all duration-200 ${selected ? `${card.borderColor} ${card.bgColor} shadow-md` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                      >
                        <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
                          {selected ? (
                            <div className={`h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gradient-to-r ${card.color} flex items-center justify-center`}>
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                            </div>
                          ) : (
                            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          )}
                        </div>
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <div className="flex-shrink-0 w-20 sm:w-28 h-10 sm:h-12 relative bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-1.5 sm:p-2">
                            <Image src={card.logo} alt={`${card.name} logo`} width={100} height={40} className="object-contain" />
                          </div>
                          <div className="flex-1 min-w-0 pr-6 sm:pr-8">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{card.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">{card.description}</p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {card.features.map((feature) => (
                                <span key={feature} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!quote?.deferred && providers.length === 1 && (
                <div className="flex items-center gap-4 rounded-xl border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 p-4">
                  <div className="flex-shrink-0 w-24 h-10 relative bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-1.5">
                    <Image src={PROVIDER_CARDS[providers[0]].logo} alt={`${PROVIDER_CARDS[providers[0]].name} logo`} width={100} height={40} className="object-contain" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{PROVIDER_CARDS[providers[0]].name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{PROVIDER_CARDS[providers[0]].features.join(', ')}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={!canPay && !(quote?.deferred && !paying)}
                className={`w-full mt-6 sm:mt-8 py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${
                  canPay || (quote?.deferred && !paying) ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    {actionLabel}
                  </>
                )}
              </button>

              <div className="mt-4 sm:mt-6 flex items-center justify-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  SSL Encrypted
                </div>
                <div className="flex items-center">
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  Secure Payment
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
