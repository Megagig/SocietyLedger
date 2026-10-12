import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import type { ReactNode } from 'react';

/**
 * Tabs per role ("Members", "Treasurers & admins") — only when content
 * truly differs (`ui-rules.md §11.5`). One `<Tab>` child per `roles` entry,
 * in order.
 */
export function RoleTabs({ roles, children }: { roles: string[]; children: ReactNode }) {
  return (
    <Tabs items={roles} label="View as">
      {children}
    </Tabs>
  );
}

export { Tab as RoleTab };
