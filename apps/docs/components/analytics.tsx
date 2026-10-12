'use client';
import Script from 'next/script';
import { useEffect } from 'react';
import { appUrl } from '@/lib/shared';
import { trackEvent } from '@/lib/analytics';

const gaId = process.env.NEXT_PUBLIC_GA_ID;

/**
 * GA4, consent-mode defaults (`analytics_storage`/`ad_storage` denied until
 * changed), no visible banner (owner decision, D1.5 — a strict improvement
 * over `apps/web`'s `GoogleAnalytics`, which loads with no consent gating
 * at all; revisit before the docs launch if NDPR guidance calls for a
 * banner). Renders nothing if `NEXT_PUBLIC_GA_ID` is unset.
 *
 * Also tracks `docs_outbound` (`architecture.md §14.8`) via a single
 * delegated click listener, rather than wrapping every link to the app.
 */
export function Analytics() {
  useEffect(() => {
    if (!gaId) return;

    let appOrigin: string;
    try {
      appOrigin = new URL(appUrl).origin;
    } catch {
      return;
    }

    function handleClick(event: MouseEvent) {
      const link = (event.target as Element).closest?.('a');
      if (!link?.href) return;

      try {
        if (new URL(link.href).origin === appOrigin) {
          trackEvent('docs_outbound', { url: link.href });
        }
      } catch {
        // malformed href — ignore
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!gaId) return null;

  return (
    <>
      {/*
        Both `afterInteractive`, in this order: gtag.js always drains the
        dataLayer queue from the start once it loads, so the consent-init
        script only needs to run *before* the library — which rendering
        it first here already guarantees. `beforeInteractive` would be
        equally correct (this is the root layout), but trips
        `@next/next/no-before-interactive-script-outside-document`, a
        lint rule that doesn't know the App Router allows it there.
      */}
      <Script id="ga-consent-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
          });
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
    </>
  );
}
