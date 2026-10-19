/**
 * F0.6 — detects a mobile user agent so web-only UI (like the "Open in app"
 * button) can hide itself on desktop. Client-side only (reads
 * `navigator.userAgent`); never trust this for anything security-relevant.
 */
const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod/i;

export function isMobileUserAgent(userAgent: string): boolean {
  return MOBILE_UA_PATTERN.test(userAgent);
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isMobileUserAgent(navigator.userAgent);
}
