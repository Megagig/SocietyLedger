'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Grid,
  Card,
  Stack,
  Button,
  Group,
  Badge,
  ActionIcon,
  Table,
  Loader,
  Alert,
} from '@mantine/core';
import { IconDownload, IconHistory, IconSettings, IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { exportsApi, ExportHistoryItem } from '@/lib/api/exports';
import { ExportTypeCard } from '@/components/exports/ExportTypeCard';
import { QuickExportModal } from '@/components/exports/QuickExportModal';
import { ExportStatusBadge } from '@/components/exports/ExportStatusBadge';
import { ExpirationCountdown } from '@/components/exports/ExpirationCountdown';
import Link from 'next/link';

export default function ExportsPage() {
  const [quickExportOpened, setQuickExportOpened] = useState(false);
  
  const { data: historyData, isLoading: historyLoading, refetch } = useQuery({
    queryKey: ['export-history'],
    queryFn: () => exportsApi.getExportHistory({ limit: 5 }),
  });

  const recentExports = (() => {
    console.log('historyData:', historyData);
    console.log('historyData?.data:', historyData?.data);
    console.log('Array.isArray(historyData?.data):', Array.isArray(historyData?.data));
    
    if (!historyData) return [];
    if (Array.isArray(historyData.data)) return historyData.data;
    if (Array.isArray(historyData)) return historyData;
    return [];
  })();

  const getExportStatus = (expiresAt: string): 'processing' | 'completed' | 'expired' | 'failed' => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    return expiry > now ? 'completed' : 'expired';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getExportTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      financial_summary: 'Financial Summary',
      member_balances: 'Member Balances',
      member_statement: 'Member Statement',
      aging_analysis: 'Aging Analysis',
      collection_rate: 'Collection Rate',
      category_report: 'Category Report',
      all_members: 'All Members',
    };
    return typeMap[type] || type;
  };

  const getStatus = (expiresAt: string) => {
    const now = new Date();
    const expiration = new Date(expiresAt);
    if (expiration < now) {
      return 'expired' as const;
    }
    return 'completed' as const;
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Exports Center</Title>
            <Text size="sm" c="dimmed" mt="xs">
              Generate and download exports of your association data
            </Text>
          </div>
          <Group gap="sm">
            <Button 
              variant="light" 
              leftSection={<IconRefresh size={16} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            <Button 
              leftSection={<IconDownload size={16} />}
              onClick={() => setQuickExportOpened(true)}
            >
              Quick Export
            </Button>
          </Group>
        </Group>

        {/* Quick Export Types */}
        <div>
          <Title order={4} mb="md">Quick Exports</Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <ExportTypeCard
                type="financial_summary"
                title="Financial Summary"
                description="Export financial data including income, expenses, and balances"
                icon="pdf"
                onClick={() => setQuickExportOpened(true)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <ExportTypeCard
                type="all_members"
                title="All Members"
                description="Export complete member list with balances"
                icon="excel"
                onClick={() => setQuickExportOpened(true)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <ExportTypeCard
                type="member_statement"
                title="Member Statement"
                description="Export individual member financial statements"
                icon="pdf"
                onClick={() => setQuickExportOpened(true)}
              />
            </Grid.Col>
          </Grid>
        </div>

        {/* Recent Exports */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="center" mb="md">
            <Title order={4}>Recent Exports</Title>
            <Link href="/dashboard/exports/history">
              <Button variant="subtle" size="xs" rightSection={<IconHistory size={14} />}>
                View All History
              </Button>
            </Link>
          </Group>

          {historyLoading ? (
            <Stack align="center" py="xl">
              <Loader size="md" />
              <Text size="sm" c="dimmed">Loading exports...</Text>
            </Stack>
          ) : !Array.isArray(recentExports) || recentExports.length === 0 ? (
            <Alert color="blue" variant="light">
              <Text size="sm">No exports yet. Create your first export using the Quick Export button.</Text>
            </Alert>
          ) : (
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Filename</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Expires</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Array.isArray(recentExports) ? recentExports.map((item: ExportHistoryItem) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{item.filename}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{getExportTypeLabel(item.type)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{new Date(item.createdAt).toLocaleDateString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ExpirationCountdown expiresAt={item.expiresAt} />
                      </Table.Td>
                      <Table.Td>
                        <ExportStatusBadge 
                          status={getExportStatus(item.expiresAt)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text size="sm" c="dimmed" ta="center">No exports available</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>

        {/* Info Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="sm">
                <Group gap="sm">
                  <IconDownload size={24} color="#228be6" />
                  <div>
                    <Text size="sm" fw={500}>Export History</Text>
                    <Text size="xs" c="dimmed">View all past exports</Text>
                  </div>
                </Group>
                <Link href="/dashboard/exports/history" style={{ textDecoration: 'none' }}>
                  <Button variant="light" fullWidth size="sm">
                    View History
                  </Button>
                </Link>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="sm">
                <Group gap="sm">
                  <IconSettings size={24} color="#40c057" />
                  <div>
                    <Text size="sm" fw={500}>Custom Export Builder</Text>
                    <Text size="xs" c="dimmed">Create custom exports</Text>
                  </div>
                </Group>
                <Link href="/dashboard/exports/custom" style={{ textDecoration: 'none' }}>
                  <Button variant="light" fullWidth size="sm">
                    Build Custom Export
                  </Button>
                </Link>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>

      <QuickExportModal
        opened={quickExportOpened}
        onClose={() => setQuickExportOpened(false)}
      />
    </Container>
  );
}
