import { Table, ActionIcon, Group, Text, Checkbox } from '@mantine/core';
import { IconDownload, IconTrash, IconRefresh } from '@tabler/icons-react';
import { ExportHistoryItem } from '@/lib/api/exports';
import { ExportStatusBadge } from './ExportStatusBadge';
import { ExpirationCountdown } from './ExpirationCountdown';

interface ExportHistoryTableProps {
  data: ExportHistoryItem[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  onSelectAll: () => void;
  onDownload: (id: number) => void;
  onDelete?: (id: number) => void; // Optional since backend doesn't support it
  onRegenerate?: (id: number) => void; // Optional since backend doesn't support it
}

export function ExportHistoryTable({
  data,
  selectedIds,
  onSelect,
  onSelectAll,
  onDownload,
  onDelete,
  onRegenerate,
}: ExportHistoryTableProps) {
  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];
  const allSelected = safeData.length > 0 && selectedIds.length === safeData.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < safeData.length;

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
      hour: '2-digit',
      minute: '2-digit',
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
    <Table.ScrollContainer minWidth={800}>
      <Table verticalSpacing="sm" striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={50}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={onSelectAll}
                aria-label="Select all"
              />
            </Table.Th>
            <Table.Th>Filename</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Format</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th>Expires</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={100}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {safeData.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No export history found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            safeData.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Checkbox
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onSelect(item.id)}
                  aria-label={`Select ${item.filename}`}
                />
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {item.filename}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{getExportTypeLabel(item.type)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" style={{ textTransform: 'uppercase' }}>
                  {item.format}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatDate(item.createdAt)}</Text>
              </Table.Td>
              <Table.Td>
                <ExpirationCountdown expiresAt={item.expiresAt} />
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatFileSize(item.fileSize)}</Text>
              </Table.Td>
              <Table.Td>
                <ExportStatusBadge status={getStatus(item.expiresAt)} />
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="sm"
                    onClick={() => onDownload(item.id)}
                    aria-label="Download"
                  >
                    <IconDownload size={16} />
                  </ActionIcon>
                  {/* Regenerate and Delete buttons disabled - backend endpoints not implemented
                  <ActionIcon
                    variant="light"
                    color="orange"
                    size="sm"
                    onClick={() => onRegenerate(item.id)}
                    aria-label="Regenerate"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                  */}
                </Group>
              </Table.Td>
            </Table.Tr>
          )))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
