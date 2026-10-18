'use client';

import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconDashboard,
  IconBuilding,
  IconUsers,
  IconChartBar,
  IconWallet,
  IconPuzzle,
  IconClipboardList,
  IconSettings,
  IconWebhook,
  IconClock,
  IconArticle,
  IconHelp,
  IconHeadset,
  IconShieldCheck,
  IconUser,
} from '@tabler/icons-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: IconDashboard },
  { label: 'Associations', href: '/associations', icon: IconBuilding },
  { label: 'Tenants', href: '/tenants', icon: IconBuilding },
  { label: 'Approvals', href: '/approvals', icon: IconUsers },
  { label: 'Analytics', href: '/analytics', icon: IconChartBar },
  { label: 'Settlements', href: '/settlements', icon: IconWallet },
  { label: 'Modules', href: '/modules', icon: IconPuzzle },
  { label: 'Action Logs', href: '/logs/actions', icon: IconClipboardList },
  { label: 'Audit Logs', href: '/logs/audit', icon: IconClipboardList },
  { label: 'Settings', href: '/settings', icon: IconSettings },
  { label: 'Webhooks', href: '/webhooks', icon: IconWebhook },
  { label: 'Jobs', href: '/jobs', icon: IconClock },
  { label: 'Blog', href: '/blog', icon: IconArticle },
  { label: 'Help Content', href: '/help', icon: IconHelp },
  { label: 'Support', href: '/support', icon: IconHeadset },
  { label: 'Impersonation', href: '/impersonation', icon: IconShieldCheck },
  { label: 'Account', href: '/account', icon: IconUser },
];

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();

  return (
    <MantineAppShell
      header={{ height: 56 }}
      navbar={{ width: 248, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="xl"
    >
      <MantineAppShell.Header
        style={{ backgroundColor: 'var(--admin-chrome-bg)', borderBottom: 'none' }}
      >
        <Group h="100%" px="lg" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="var(--admin-chrome-fg)" />
            <Text fw={700} size="md" c="white">SocietyLedger Admin</Text>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar
        style={{ backgroundColor: 'var(--admin-chrome-bg)', borderRight: 'none' }}
        p="sm"
      >
        <Stack gap={2}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                label={item.label}
                leftSection={<item.icon size={16} />}
                active={isActive}
                styles={{
                  root: {
                    color: isActive ? 'var(--admin-chrome-fg)' : 'var(--admin-chrome-fg-muted)',
                    backgroundColor: isActive ? 'var(--admin-chrome-active-bg)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--admin-chrome-active-marker)' : '3px solid transparent',
                    borderRadius: 6,
                    '&:hover': { backgroundColor: 'var(--admin-chrome-active-bg)' },
                  },
                  label: { fontSize: 13 },
                }}
              />
            );
          })}
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main style={{ backgroundColor: 'var(--admin-page-bg)' }}>
        {children}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
