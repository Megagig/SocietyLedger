'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Button,
  Group,
  TextInput,
  Select,
  Pagination,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { IconSearch, IconFilter, IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { exportsApi, ExportHistoryItem } from '@/lib/api/exports';
import { ExportHistoryTable } from '@/components/exports/ExportHistoryTable';
import { notifications } from '@mantine/notifications';

export default function ExportHistoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ['export-history', page, typeFilter, formatFilter],
    queryFn: () => exportsApi.getExportHistory({
      page,
      limit: 20,
      type: typeFilter || undefined,
      format: (formatFilter as 'pdf' | 'excel') || undefined,
    }),
  });

  const exports = (() => {
    console.log('Export history data:', historyData);
    console.log('Export history data.data:', historyData?.data);
    
    if (!historyData) return [];
    if (historyData.data && Array.isArray(historyData.data.exports)) {
      return historyData.data.exports;
    }
    if (Array.isArray(historyData.data)) return historyData.data;
    if (Array.isArray(historyData)) return historyData;
    return [];
  })();
  
  const totalPages = historyData?.data?.pagination?.totalPages || 
                    Math.ceil((historyData?.data?.pagination?.totalCount || 0) / 20) || 1;

  const handleDownload = (id: number) => {
    exportsApi.downloadExport(id);
  };

  const handleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(exports.map((item: ExportHistoryItem) => item.id));
  };

  const handleSearch = () => {
    refetch();
  };

  const handleClearFilters = () => {
    setSearch('');
    setTypeFilter(null);
    setFormatFilter(null);
    setPage(1);
  };

  const exportTypes = [
    { value: 'financial_summary', label: 'Financial Summary' },
    { value: 'member_balances', label: 'Member Balances' },
    { value: 'member_statement', label: 'Member Statement' },
    { value: 'aging_analysis', label: 'Aging Analysis' },
    { value: 'collection_rate', label: 'Collection Rate' },
    { value: 'category_report', label: 'Category Report' },
    { value: 'all_members', label: 'All Members' },
  ];

  const formatOptions = [
    { value: 'pdf', label: 'PDF' },
    { value: 'excel', label: 'Excel' },
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Export History</Title>
            <Text size="sm" c="dimmed" mt="xs">
              View and manage all your exports
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
          </Group>
        </Group>

        {/* Filters */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap="md">
            <TextInput
              placeholder="Search exports..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by type"
              leftSection={<IconFilter size={16} />}
              data={exportTypes}
              value={typeFilter}
              onChange={setTypeFilter}
              clearable
              style={{ minWidth: 200 }}
            />
            <Select
              placeholder="Filter by format"
              leftSection={<IconFilter size={16} />}
              data={formatOptions}
              value={formatFilter}
              onChange={setFormatFilter}
              clearable
              style={{ minWidth: 150 }}
            />
            <Button variant="light" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </Group>
        </Card>

        {/* Export List */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <LoadingOverlay visible={isLoading} />
          
          {exports.length === 0 && !isLoading ? (
            <Alert color="blue" variant="light">
              <Text size="sm">No exports found. Create your first export using the Quick Export button.</Text>
            </Alert>
          ) : (
            <Stack gap="md">
              <ExportHistoryTable
                data={exports}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onDownload={handleDownload}
              />

              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={totalPages}
                    value={page}
                    onChange={setPage}
                    boundaries={1}
                    siblings={1}
                  />
                </Group>
              )}
            </Stack>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
