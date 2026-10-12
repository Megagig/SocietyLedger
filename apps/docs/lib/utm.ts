/**
 * Tags an outbound link to the main app with `utm_source=docs&utm_medium=<medium>`
 * so the app's own analytics can attribute the traffic (build-plan.md D1.5's
 * "outbound UTM helper"). Falls back to the plain URL if it doesn't parse.
 */
export function withUtm(url: string, medium: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('utm_source', 'docs');
    parsed.searchParams.set('utm_medium', medium);
    return parsed.toString();
  } catch {
    return url;
  }
}
