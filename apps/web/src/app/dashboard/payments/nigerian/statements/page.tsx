'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack,
  Table,
  Badge,
  Loader,
  Alert,
  Progress,
  SimpleGrid,
  Pagination
} from '@mantine/core';
import { 
  IconUpload, 
  IconRefresh, 
  IconDownload, 
  IconFileText, 
  IconCheck,
  IconX,
  IconAlertCircle
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankStatementImport } from '@/lib/api/nigerian-payments';

export default function StatementImportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 10;

  const loadImports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await nigerianPaymentsApi.getStatementImports({
        page,
        limit: pageSize,
      });
      
      // Handle different response structures
      if (Array.isArray(response)) {
        // Response is directly an array
        setImports(response);
        setTotal(response.length);
      } else if (response && typeof response === 'object' && 'data' in response) {
        // Response has a data property
        setImports(Array.isArray(response.data) ? response.data : []);
        setTotal(response.total || 0);
      } else {
        // Fallback
        setImports([]);
        setTotal(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load statement imports');
      setImports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are supported');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const result = await nigerianPaymentsApi.importStatement(file);
      
      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (progress >= 90) {
          clearInterval(progressInterval);
        }
        setUploadProgress(progress);
      }, 100);

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setFile(null);
      setUploadProgress(100);
      loadImports();
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import statement');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadTemplate = () => {
    const template = `Bank Statement Import Template
Date,Description,Amount,Reference,Balance
${new Date().toISOString().split('T')[0]},Example transaction,1000.00,REF123,5000.00
${new Date().toISOString().split('T')[0]},Example payment,-500.00,REF456,4500.00`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank-statement-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Title order={2}>Import Bank Statements</Title>
        <Button
          leftSection={<IconDownload size={20} />}
          onClick={handleDownloadTemplate}
          variant="subtle"
        >
          Download Template
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" icon={<IconAlertCircle />} mb="md" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Upload Section */}
      <Card shadow="sm" padding="xl" withBorder mb="xl">
        <Title order={3} mb="md">Upload Statement</Title>
        <Stack gap="md">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="statement-upload"
            />
            <label htmlFor="statement-upload" className="cursor-pointer">
              <Stack align="center" gap="md">
                <div className="text-blue-600">
                  <IconUpload size={48} />
                </div>
                <div>
                  <Text fw={600} mb="xs">Click to upload</Text>
                  <Text size="sm" c="dimmed">
                    or drag and drop your CSV file
                  </Text>
                </div>
                {file && (
                  <Badge color="blue" variant="light" mt="sm">
                    <IconFileText size={14} className="mr-2" />
                    {file.name}
                  </Badge>
                )}
              </Stack>
            </label>
          </div>

          {file && (
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setFile(null)}>
                Clear
              </Button>
              <Button onClick={handleUpload} loading={uploading} disabled={!file}>
                {uploading ? 'Uploading...' : 'Upload Statement'}
              </Button>
            </Group>
          )}

          {uploading && (
            <Stack mt="md">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Uploading...</Text>
                <Text size="sm" fw={500}>{uploadProgress}%</Text>
              </Group>
              <Progress value={uploadProgress} color="blue" />
            </Stack>
          )}
        </Stack>
      </Card>

      {/* Import History */}
      <Title order={3} mb="md">Import History</Title>
      {loading && (!imports || imports.length === 0) ? (
        <div className="flex items-center justify-center">
          <Loader size="xl" />
        </div>
      ) : (!imports || imports.length === 0) ? (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <IconFileText size={48} className="text-gray-400" />
            <Text c="dimmed" ta="center">
              No statement imports found. Upload your first bank statement to get started.
            </Text>
            <Button onClick={() => router.push('/dashboard/payments/nigerian/statement-entries')} variant="light">
              View Statement Entries
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Card shadow="sm" padding="0" withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Total Entries</Table.Th>
                  <Table.Th>Matched</Table.Th>
                  <Table.Th>Unmatched</Table.Th>
                  <Table.Th>Import Date</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {imports && imports.map((imp) => (
                  <Table.Tr key={imp.id}>
                    <Table.Td>{imp.fileName}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          imp.status === 'COMPLETED' ? 'green' :
                          imp.status === 'PROCESSING' ? 'blue' :
                          'red'
                        }
                        variant="light"
                      >
                        {imp.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{imp.totalEntries}</Table.Td>
                    <Table.Td fw={600} c="green">{imp.matchedEntries}</Table.Td>
                    <Table.Td fw={600} c="red">{imp.unmatchedEntries}</Table.Td>
                    <Table.Td>{new Date(imp.importedAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="subtle">
                        View
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              mt="md"
            />
          )}
        </>
      )}
    </div>
  );
}
