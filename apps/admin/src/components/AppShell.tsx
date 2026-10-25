'use client';

import { useState } from 'react';
import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Stack, Divider } from '@mantine/core';
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
  IconLogout,
  IconUserShield,
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
  { label: 'Admins', href: '/admins', icon: IconUserShield },
  { label: 'Account', href: '/account', icon: IconUser },
];

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/bff/session', { method: 'DELETE' });
    } finally {
      // Full navigation, not router.push() — guarantees middleware re-checks
      // against the now-cleared session cookie rather than a stale cached
      // response (same class of bug as the tenant-side impersonation fix).
      window.location.href = '/login';
    }
  }

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-horizontal-dark-notag.png" alt="SocietyLedger" height={30} width={121} style={{ height: 30, width: 121 }} />
            <Text fw={600} size="sm" c="dimmed" visibleFrom="xs">Admin</Text>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar
        style={{ backgroundColor: 'var(--admin-chrome-bg)', borderRight: 'none' }}
        p="sm"
      >
        <MantineAppShell.Section grow style={{ overflowY: 'auto' }}>
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
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <Divider color="var(--admin-chrome-fg-muted)" opacity={0.2} mb="xs" />
          <NavLink
            label={loggingOut ? 'Signing out…' : 'Log out'}
            leftSection={<IconLogout size={16} />}
            onClick={handleLogout}
            disabled={loggingOut}
            styles={{
              root: {
                color: 'var(--admin-chrome-fg-muted)',
                borderRadius: 6,
                '&:hover': { backgroundColor: 'var(--admin-chrome-active-bg)' },
              },
              label: { fontSize: 13 },
            }}
          />
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main style={{ backgroundColor: 'var(--admin-page-bg)' }}>
        {children}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
