import { Card, Stack, Title, Text, Table, Badge, Group, Button } from '@mantine/core';
import { IconDownload, IconX } from '@tabler/icons-react';

interface PreviewData {
  id: number;
  [key: string]: any;
}

interface ExportPreviewProps {
  title: string;
  fields: string[];
  sampleData: PreviewData[];
  estimatedRecords: number;
  onDownloadSample: () => void;
  onGenerate: () => void;
  onCancel: () => void;
}

export function ExportPreview({
  title,
  fields,
  sampleData,
  estimatedRecords,
  onDownloadSample,
  onGenerate,
  onCancel,
}: ExportPreviewProps) {
  const getFieldLabel = (fieldId: string) => {
    const fieldLabels: Record<string, string> = {
      memberNumber: 'Member Number',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      category: 'Category',
      status: 'Status',
      joinDate: 'Join Date',
      totalDues: 'Total Dues',
      totalPaid: 'Total Paid',
      balance: 'Balance',
      lastPaymentDate: 'Last Payment Date',
      paymentMethod: 'Payment Method',
      emergencyContact: 'Emergency Contact',
      emergencyPhone: 'Emergency Phone',
    };
    return fieldLabels[fieldId] || fieldId;
  };

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  };

  return (
    <Stack gap="md">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>{title}</Title>
              <Text size="sm" c="dimmed" mt="xs">
                Preview of selected fields and sample data
              </Text>
            </div>
            <Badge variant="light" size="lg">
              {estimatedRecords.toLocaleString()} records
            </Badge>
          </Group>

          <div>
            <Text size="sm" fw={500} mb="xs">
              Selected Fields ({fields.length}):
            </Text>
            <Group gap="xs" style={{ flexWrap: 'wrap' }}>
              {fields.map(field => (
                <Badge key={field} variant="outline" size="sm">
                  {getFieldLabel(field)}
                </Badge>
              ))}
            </Group>
          </div>

          <div>
            <Text size="sm" fw={500} mb="xs">
              Sample Data (First 5 records):
            </Text>
            <Card withBorder padding="xs" radius="sm">
              <Table.ScrollContainer minWidth={600}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {fields.map(field => (
                        <Table.Th key={field}>
                          {getFieldLabel(field)}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sampleData.slice(0, 5).map((row, rowIndex) => (
                      <Table.Tr key={rowIndex}>
                        {fields.map(field => (
                          <Table.Td key={field}>
                            {formatCellValue(row[field])}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onCancel} leftSection={<IconX size={16} />}>
              Cancel
            </Button>
            <Button 
              variant="light" 
              onClick={onDownloadSample} 
              leftSection={<IconDownload size={16} />}
            >
              Download Sample
            </Button>
            <Button onClick={onGenerate} leftSection={<IconDownload size={16} />}>
              Generate Export
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
