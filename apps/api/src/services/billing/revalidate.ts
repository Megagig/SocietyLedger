/**
 * Tell the public website that pricing changed so its cached pages refresh now instead of at the next timed refresh.
 *
 * Best effort: if the website is unreachable or the variables are not set, the pages still pick the change up within their short cache
 * window (see apps/web pricing fetch), so a failure here never blocks publishing.
 */
export async function requestPublicRevalidation(): Promise<void> {
  const url = process.env.WEB_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags: ['pricing'] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.warn(`[pricing] The website refused the refresh request (${response.status}). Pages refresh on their own within a minute.`);
  } catch (error) {
    console.warn('[pricing] Could not reach the website to refresh pricing. Pages refresh on their own within a minute.', error instanceof Error ? error.message : error);
  }
}
