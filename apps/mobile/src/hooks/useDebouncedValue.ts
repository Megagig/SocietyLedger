import { useEffect, useState } from 'react';

/** ui-rules.md §5.6's 300ms debounce pattern, extracted as a reusable hook (F2.1 — `SearchField`
 * has its own inline copy of this same idea, but the Association Code screen needs the debounced
 * value itself, not just a debounced callback). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
