'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { verifySubscriptionPayment, type VerifyOutcome } from '@/lib/api/subscriptions';

interface VerifyPaymentProps {
  /** Where to go after a successful payment. The API may tell us the association's subdomain. */
  successHref: (subdomain?: string) => string;
  /** The button shown when verification fails. */
  fallback: { label: string; href: string };
  retryHref: string;
}

const MAX_CHECKS = 8;
const WAIT_MS = 2500;

/**
 * Landing page after the payment provider redirects back. It asks the API to confirm the payment; the API activates the subscription
 * only if the provider confirms it for the exact amount that was quoted. Coming back to this page never grants access by itself.
 */
export function VerifyPayment({ successHref, fallback, retryHref }: VerifyPaymentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [outcome, setOutcome] = useState<VerifyOutcome | { state: 'loading'; message: string }>({ state: 'loading', message: 'Verifying your payment...' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!reference) {
      setOutcome({ state: 'error', message: 'No payment reference found.' });
      return;
    }
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < MAX_CHECKS; attempt += 1) {
        const result = await verifySubscriptionPayment(reference);
        if (cancelled) return;
        if (result.state !== 'pending') {
          setOutcome(result);
          if (result.state === 'success') setTimeout(() => router.push(successHref(result.subdomain)), 2000);
          return;
        }
        await new Promise((r) => setTimeout(r, WAIT_MS));
      }
      if (!cancelled) setOutcome({ state: 'pending', message: 'Your payment is still being processed. Your subscription is activated as soon as it is confirmed, and we will email you.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, router, successHref]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center" role="status" aria-live="polite">
        {outcome.state === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifying Payment</h2>
            <p className="text-gray-600 dark:text-gray-400">{outcome.message}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Please wait while we confirm your payment...</p>
          </>
        )}

        {outcome.state === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{outcome.message}</p>
            <div className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting...</p>
            </div>
          </>
        )}

        {(outcome.state === 'pending' || outcome.state === 'review') && (
          <>
            <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{outcome.state === 'review' ? 'We are checking your payment' : 'Payment is processing'}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{outcome.message}</p>
            <button onClick={() => router.push(fallback.href)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
              {fallback.label}
            </button>
          </>
        )}

        {(outcome.state === 'failed' || outcome.state === 'error') && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{outcome.state === 'failed' ? 'Payment Not Completed' : 'Verification Failed'}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{outcome.message}</p>
            <div className="space-y-3">
              {outcome.state === 'failed' && (
                <button onClick={() => router.push(retryHref)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                  Try again
                </button>
              )}
              <button onClick={() => router.push(fallback.href)} className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-2 px-6 rounded-lg transition-colors">
                {fallback.label}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
