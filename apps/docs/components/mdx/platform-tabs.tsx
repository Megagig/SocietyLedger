'use client';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { useState, type ReactNode } from 'react';

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = '__sl_docs_storage_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function defaultIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Tabs "Web" / "Mobile"; remembers the reader's choice across pages
 * (`ui-rules.md §11.5`). Uses Fumadocs' built-in `groupId`+`persist`
 * (shares one localStorage-backed value across every `PlatformTabs`
 * instance on the site) — wrapped in a feature check, since Fumadocs'
 * own implementation calls `localStorage` directly without a try/catch.
 * Default tab = device type, until mobile docs exist (D7) content authors
 * only reach for this when a Web step genuinely differs from Mobile.
 */
export function PlatformTabs({ children }: { children: ReactNode }) {
  const [persist] = useState(isStorageAvailable);
  const [defaultIndex] = useState(() => (defaultIsMobile() ? 1 : 0));

  return (
    <Tabs items={['Web', 'Mobile']} defaultIndex={defaultIndex} groupId="docs-platform" persist={persist}>
      {children}
    </Tabs>
  );
}

export { Tab as PlatformTab };
