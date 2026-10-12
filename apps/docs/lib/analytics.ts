/**
 * GA4 event dispatch — stubbed until D1.5 wires up `NEXT_PUBLIC_GA_ID` and
 * the consent-mode `gtag` loader (`architecture.md §14.8`/§14.9). Components
 * built now (`Feedback`) call this rather than `window.gtag` directly, so
 * D1.5 only has to fill this one function in.
 */
export function trackEvent(name: string, params: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}
