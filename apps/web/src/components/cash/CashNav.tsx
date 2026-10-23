'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Group } from '@mantine/core';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

/** The Cash section's pages, as a row of links. Each link shows only to someone who can use that page. */
export function CashNav() {
  const pathname = usePathname();
  const { canAny } = usePermissions();
  const anyCash = canAny([PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]);

  const links = [
    { href: '/dashboard/cash', label: 'Overview', show: anyCash, exact: true },
    { href: '/dashboard/cash/collections', label: 'Collections', show: anyCash },
    { href: '/dashboard/cash/lodge', label: 'Lodge cash', show: canAny([PERMISSIONS.CASH_LODGE]) },
    { href: '/dashboard/cash/lodgments', label: 'Lodgments', show: anyCash },
  ].filter((link) => link.show);

  return (
    <Group gap="xs">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Button key={link.href} component={Link} href={link.href} size="xs" variant={active ? 'filled' : 'light'} radius="xl">
            {link.label}
          </Button>
        );
      })}
    </Group>
  );
}
