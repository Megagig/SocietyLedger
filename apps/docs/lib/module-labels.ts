/**
 * Plain-language names for module codes (`project-overview.md §9.6.2`'s
 * "plans-and-modules" list). Sparse by design, same reasoning as
 * `permission-labels.ts` — grows as pages reference a module during authoring.
 */
const moduleLabels: Partial<Record<string, string>> = {
  ai: 'AI assistant',
  payments: 'Payments',
  finance: 'Finance',
  accounting: 'Accounting',
  cooperatives: 'Cooperatives',
  welfare: 'Welfare',
  meetings: 'Meetings',
  voting: 'Elections & polls',
  sms: 'SMS',
};

function humanizeKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ');
}

export function moduleLabel(code: string): string {
  return moduleLabels[code] ?? humanizeKey(code);
}
