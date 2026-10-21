/**
 * Merges conditional NativeWind classNames (library-docs.md's NativeWind section —
 * "the cn() helper (lib/cn.ts, added at F1.6)"). **Not** `clsx`-based (no new dependency) and no
 * dedupe/conflict-resolution logic (that's Tailwind's `tailwind-merge`, not needed here) — just a
 * clsx-style join that replaces the small local `joinClasses`/`.filter(Boolean).join(' ')`
 * helpers F1.4/F1.5 duplicated across `components/ui`, `components/forms` and `components/layout`.
 */
export type ClassValue = string | number | null | undefined | false;

export function cn(...values: ClassValue[]): string {
  return values.filter((value) => typeof value === 'string' && value.length > 0).join(' ');
}
