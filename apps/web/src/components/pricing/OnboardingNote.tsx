'use client';

import { useEffect, useState } from 'react';
import type { OnboardingInfo } from '@/types/pricing';
import { fetchPublicPricingInBrowser, onboardingSentence } from '@/lib/pricing';

/** "What do I get when I register?" - read from the platform's onboarding settings, so it is never wrong about the trial length or plan. */
export function OnboardingNote({ initial = null }: { initial?: OnboardingInfo | null }) {
  const [onboarding, setOnboarding] = useState<OnboardingInfo | null>(initial);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetchPublicPricingInBrowser().then((p) => {
      if (!cancelled && p) setOnboarding(p.onboarding);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const sentence = onboardingSentence(onboarding);
  if (!sentence) return null;
  return (
    <p className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-4 py-3 text-sm text-teal-900 dark:text-teal-100" role="note">
      {sentence}
      {onboarding && onboarding.policy !== 'BILLABLE' ? ' It ends on a fixed date, and your records are never deleted.' : ''}
    </p>
  );
}
