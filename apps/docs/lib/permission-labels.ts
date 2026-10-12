/**
 * Plain-language labels for permission alias keys (`apps/api/src/lib/permissions.ts`).
 * Sparse by design — filled in as real pages reference a permission during
 * authoring (D2+). `scripts/gen-reference.ts` (D6.1) reconciles this against
 * the full permission list; `humanizeKey()` covers anything not yet listed.
 */
const permissionLabels: Partial<Record<string, string>> = {
  PAYMENT_VERIFY: 'verify payments',
};

function humanizeKey(key: string): string {
  return key.toLowerCase().replace(/[._]/g, ' ');
}

export function permissionLabel(key: string): string {
  return permissionLabels[key] ?? humanizeKey(key);
}
