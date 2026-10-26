'use client';

import { Suspense } from 'react';
import { VerifyPayment } from '@/components/subscription/VerifyPayment';

export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={null}>
      <VerifyPayment successHref={() => '/dashboard/subscription/success'} fallback={{ label: 'Go to Subscription', href: '/dashboard/subscription' }} retryHref="/dashboard/subscription/plans" />
    </Suspense>
  );
}
