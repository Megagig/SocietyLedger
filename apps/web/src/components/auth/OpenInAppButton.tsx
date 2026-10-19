'use client';

import { useEffect, useState } from 'react';
import { isMobileBrowser } from '@/utils/device';

interface OpenInAppButtonProps {
  /** Matches architecture.md §8.3's deep-link paths exactly. */
  scheme: 'invite' | 'reset-password';
  token: string;
  tenant?: string;
}

/**
 * F0.6 — "Open in the SocietyLedger app" button on /auth/activate and
 * /auth/reset-password, visible on mobile user agents only. Renders nothing
 * until mounted (avoids an SSR/client mismatch, since there's no real UA to
 * check on the server here) and nothing at all on desktop.
 */
export function OpenInAppButton({ scheme, token, tenant }: OpenInAppButtonProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileBrowser());
  }, []);

  if (!isMobile || !token) return null;

  const params = new URLSearchParams({ token });
  if (tenant) params.set('tenant', tenant);
  const appLink = `societyledger://${scheme}?${params.toString()}`;

  return (
    <a
      href={appLink}
      className="inline-flex items-center justify-center w-full gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-4"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="7" y="2" width="10" height="20" rx="2" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M11 18h2" />
      </svg>
      Open in the SocietyLedger app
    </a>
  );
}
