'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Tabs, SimpleGrid, Stack, Card, Group, Text, Badge,
  TextInput, Skeleton, Alert,
} from '@mantine/core';
import { IconSearch, IconPuzzle, IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformModule {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isCore: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface PlatformFeature {
  id: number;
  code: string;
  name: string;
  description: string | null;
  moduleCode: string;
  isActive: boolean;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('modules');

  const modulesQ = useQuery({
    queryKey: ['platform-modules'],
    queryFn: () => bff<PlatformModule[]>('admin/modules'),
  });

  const featuresQ = useQuery({
    queryKey: ['platform-features'],
    queryFn: () => bff<PlatformFeature[]>('admin/features'),
  });

  const modules = (modulesQ.data ?? []).filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase()),
  );

  const features = (featuresQ.data ?? []).filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase()) ||
      f.moduleCode.toLowerCase().includes(search.toLowerCase()),
  );

  const featuresByModule = features.reduce<Record<string, PlatformFeature[]>>((acc, f) => {
    const key = f.moduleCode || 'core';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const allModules = modulesQ.data ?? [];
  const allFeatures = featuresQ.data ?? [];

  const isLoading = modulesQ.isLoading || featuresQ.isLoading;
  const isError = modulesQ.isError || featuresQ.isError;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Modules & Features"
        description="Read-only catalogue of all platform modules and features. Configure per-tenant in Associations."
      />

      {isLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard label="Total Modules" value={allModules.length} icon={<IconPuzzle size={16} />} />
          <StatCard label="Core Modules" value={allModules.filter((m) => m.isCore).length} />
          <StatCard label="Total Features" value={allFeatures.length} />
          <StatCard
            label="Active Features"
            value={allFeatures.filter((f) => f.isActive).length}
          />
        </SimpleGrid>
      )}

      <TextInput
        placeholder="Search modules or features…"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        size="sm"
        maw={320}
      />

      {isError ? (
        <ErrorState
          message="Failed to load modules"
          onRetry={() => { modulesQ.refetch(); featuresQ.refetch(); }}
        />
      ) : (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="lg">
            <Tabs.Tab value="modules">
              Modules ({modules.length})
            </Tabs.Tab>
            <Tabs.Tab value="features">
              Features ({features.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="modules">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              {modulesQ.isLoading
                ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={100} radius="md" />)
                : modules.map((m) => (
                    <Card
                      key={m.id}
                      style={{
                        backgroundColor: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                      }}
                      p="md"
                      radius="md"
                    >
                      <Group justify="space-between" mb="xs">
                        <Text fw={600} size="sm">{m.name}</Text>
                        <Group gap="xs">
                          <Badge
                            variant="light"
                            size="xs"
                            color={m.isCore ? 'blue' : 'gray'}
                          >
                            {m.isCore ? 'Core' : 'Optional'}
                          </Badge>
                          <Badge
                            variant="light"
                            size="xs"
                            color={m.isActive ? 'green' : 'red'}
                          >
                            {m.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </Group>
                      </Group>
                      <Text size="xs" ff="monospace" c="dimmed" mb="xs">{m.code}</Text>
                      {m.description && <Text size="xs" c="dimmed">{m.description}</Text>}
                      <Text size="xs" c="dimmed" mt="xs">
                        {(featuresQ.data ?? []).filter((f) => f.moduleCode === m.code).length} features
                      </Text>
                    </Card>
                  ))}
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="features">
            <Stack gap="md">
              {featuresQ.isLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={120} radius="md" />)
                : Object.entries(featuresByModule).map(([moduleCode, moduleFeatures]) => (
                    <Card
                      key={moduleCode}
                      style={{
                        backgroundColor: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                      }}
                      p={0}
                      radius="md"
                    >
                      <Text
                        fw={600}
                        size="xs"
                        tt="uppercase"
                        c="dimmed"
                        px="md"
                        py="sm"
                        style={{ borderBottom: '1px solid var(--admin-border)' }}
                      >
                        {moduleCode} · {moduleFeatures.length} features
                      </Text>
                      <Stack gap={0}>
                        {moduleFeatures.map((f, i) => (
                          <Group
                            key={f.id}
                            justify="space-between"
                            px="md"
                            py="xs"
                            style={{
                              borderTop: i > 0 ? '1px solid var(--admin-border)' : undefined,
                            }}
                          >
                            <Stack gap={2}>
                              <Text size="sm" fw={500}>{f.name}</Text>
                              <Text size="xs" ff="monospace" c="dimmed">{f.code}</Text>
                              {f.description && (
                                <Text size="xs" c="dimmed">{f.description}</Text>
                              )}
                            </Stack>
                            <Badge
                              variant="light"
                              size="xs"
                              color={f.isActive ? 'green' : 'red'}
                            >
                              {f.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Group>
                        ))}
                      </Stack>
                    </Card>
                  ))}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}

      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          This is a read-only catalogue. To configure modules for a specific tenant, go to{' '}
          <Text component={Link} href="/associations" size="sm" c="blue" td="underline">
            Associations
          </Text>{' '}
          and open the tenant's Modules & features tab.
        </Text>
      </Alert>
    </Stack>
  );
}
