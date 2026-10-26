'use client';

import { Suspense } from 'react';
import { VerifyPayment } from '@/components/subscription/VerifyPayment';

// Where the payment provider sends the browser back to (public: the person may not be signed in on this device).
function successHref(subdomain?: string) {
  return subdomain ? `/subscription/success?subdomain=${encodeURIComponent(subdomain)}` : '/subscription/success';
}

export default function VerifySubscriptionPaymentPage() {
  return (
    <Suspense fallback={null}>
      <VerifyPayment successHref={successHref} fallback={{ label: 'Go to Login', href: '/auth/login' }} retryHref="/dashboard/subscription/plans" />
    </Suspense>
  );
}
