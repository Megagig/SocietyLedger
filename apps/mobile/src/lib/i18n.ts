import en from './en.json';

export type TranslationKey = keyof typeof en;

/**
 * architecture.md §4/code-standards.md §17.1 — flat `domain.screen.element` string keys
 * (code-standards.md §2), `en.json` only (no other locale yet — nothing in the build plan asks
 * for one before launch). `{{param}}` placeholders, the common i18next-style convention.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const template: string = en[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.replaceAll(`{{${paramKey}}}`, String(value)),
    template,
  );
}
