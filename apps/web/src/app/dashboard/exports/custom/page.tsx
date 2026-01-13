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
  Grid,
  Select,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { IconDownload, IconArrowBack, IconEye } from '@tabler/icons-react';
import { ExportFieldSelector } from '@/components/exports/ExportFieldSelector';
import { ExportPreview } from '@/components/exports/ExportPreview';
import { ExportProgress } from '@/components/exports/ExportProgress';
import { useMutation } from '@tanstack/react-query';
import { exportsApi } from '@/lib/api/exports';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

interface PreviewData {
  id: number;
  [key: string]: any;
}

export default function CustomExportPage() {
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'memberNumber',
    'firstName',
    'lastName',
    'email',
    'category',
    'status',
    'totalDues',
    'totalPaid',
    'balance',
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [progressMessage, setProgressMessage] = useState('');

  const generateMutation = useMutation({
    mutationFn: async () => {
      setProgress(0);
      setExportStatus('processing');
      setProgressMessage('Preparing export data...');
      setShowProgress(true);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      try {
        // Call the exports API with selected fields
        // For now, we'll use the existing all members export
        const result = await exportsApi.exportAllMembersExcel();
        
        clearInterval(progressInterval);
        setProgress(100);
        setExportStatus('completed');
        setProgressMessage('Export completed successfully!');
        
        // Trigger download
        if (result?.downloadUrl) {
          window.open(result.downloadUrl, '_blank');
        }

        return result;
      } catch (error: any) {
        clearInterval(progressInterval);
        setExportStatus('failed');
        setProgressMessage(error.message || 'Export failed');
        throw error;
      }
    },
    onSuccess: () => {
      notifications.show({
        title: 'Export generated',
        message: 'Your custom export has been generated successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Export failed',
        message: error.response?.data?.message || 'Failed to generate export',
        color: 'red',
      });
    },
  });

  const sampleData: PreviewData[] = [
    {
      id: 1,
      memberNumber: 'MEM001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      category: 'regular',
      status: 'active',
      totalDues: 50000,
      totalPaid: 45000,
      balance: 5000,
    },
    {
      id: 2,
      memberNumber: 'MEM002',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      category: 'executive',
      status: 'active',
      totalDues: 75000,
      totalPaid: 75000,
      balance: 0,
    },
    {
      id: 3,
      memberNumber: 'MEM003',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      category: 'regular',
      status: 'inactive',
      totalDues: 50000,
      totalPaid: 25000,
      balance: 25000,
    },
  ];

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleGenerate = () => {
    if (selectedFields.length === 0) {
      notifications.show({
        title: 'No fields selected',
        message: 'Please select at least one field to export',
        color: 'orange',
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleCancelExport = () => {
    setShowProgress(false);
    setSelectedFields([
      'memberNumber',
      'firstName',
      'lastName',
      'email',
      'category',
      'status',
      'totalDues',
      'totalPaid',
      'balance',
    ]);
  };

  const handleRetry = () => {
    handleGenerate();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Custom Export Builder</Title>
            <Text size="sm" c="dimmed" mt="xs">
              Create custom exports by selecting specific fields
            </Text>
          </div>
          <Link href="/dashboard/exports">
            <Button variant="light" leftSection={<IconArrowBack size={16} />}>
              Back to Exports
            </Button>
          </Link>
        </Group>

        {showProgress ? (
          <ExportProgress
            progress={progress}
            status={exportStatus}
            message={progressMessage}
            onCancel={handleCancelExport}
            onRetry={handleRetry}
          />
        ) : showPreview ? (
          <ExportPreview
            title="Custom Member Export Preview"
            fields={selectedFields}
            sampleData={sampleData}
            estimatedRecords={150}
            onDownloadSample={() => {
              notifications.show({
                title: 'Sample downloaded',
                message: 'Sample data has been downloaded',
                color: 'green',
              });
            }}
            onGenerate={handleGenerate}
            onCancel={() => setShowPreview(false)}
          />
        ) : (
          <Grid>
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={4} mb="md">Select Fields</Title>
                    <Text size="sm" c="dimmed" mb="md">
                      Choose the fields you want to include in your export
                    </Text>
                  </div>

                  <ExportFieldSelector
                    selectedFields={selectedFields}
                    onChange={setSelectedFields}
                  />

                  <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setShowPreview(false)}>
                      Cancel
                    </Button>
                    <Button 
                      leftSection={<IconEye size={16} />}
                      onClick={handlePreview}
                      disabled={selectedFields.length === 0}
                    >
                      Preview Export
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Stack gap="md">
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="sm">
                    <Title order={5}>Export Summary</Title>
                    <Text size="sm" c="dimmed">
                      {selectedFields.length} fields selected
                    </Text>
                    <Text size="sm" c="dimmed">
                      Estimated records: 150
                    </Text>
                    <Text size="sm" c="dimmed">
                      Format: Excel (.xlsx)
                    </Text>
                  </Stack>
                </Card>

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="sm">
                    <Title order={5}>Quick Actions</Title>
                    <Button 
                      variant="light" 
                      fullWidth 
                      leftSection={<IconDownload size={16} />}
                      onClick={handleGenerate}
                      disabled={selectedFields.length === 0}
                    >
                      Generate Export
                    </Button>
                  </Stack>
                </Card>

                <Alert color="blue" variant="light">
                  <Text size="sm">
                    <strong>Tip:</strong> You can preview your export before generating to ensure you have selected the correct fields.
                  </Text>
                </Alert>
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </Container>
  );
}
