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
  Tabs,
} from '@mantine/core';
import { IconDownload, IconArrowBack, IconEye, IconUsers, IconCoin, IconReceipt, IconGift } from '@tabler/icons-react';
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

type ReportType = 'members' | 'transactions' | 'payments' | 'welfare' | 'donations' | 'levies' | 'penalties' | 'accounting';

export default function CustomExportPage() {
  const [reportType, setReportType] = useState<ReportType>('members');
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
        let result;
        
        // Call appropriate API based on report type
        if (reportType === 'members') {
          result = await exportsApi.exportCustomMembersExcel({
            fields: selectedFields,
            status: 'all'
          });
        } else {
          // For other report types, use the general custom export API
          result = await exportsApi.exportCustomReportExcel({
            reportType,
            fields: selectedFields,
          });
        }
        
        clearInterval(progressInterval);
        setProgress(100);
        setExportStatus('completed');
        setProgressMessage('Export completed successfully!');
        
        // Trigger download using the export ID
        if (result?.data?.id) {
          const downloadUrl = exportsApi.getDownloadUrl(result.data.id);
          window.open(downloadUrl, '_blank');
        } else if (result?.downloadUrl) {
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
      // Transaction fields
      transactionId: 'TXN001',
      amount: 25000,
      dueDate: '2024-01-15',
      categoryName: 'Monthly Dues',
      categoryType: 'due',
      // Payment fields
      paymentId: 'PAY001',
      paymentMethod: 'bank_transfer',
      paymentDate: '2024-01-10',
      // Welfare fields
      contributionAmount: 5000,
      payoutAmount: 15000,
      fundName: 'Emergency Fund',
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
      // Transaction fields
      transactionId: 'TXN002',
      amount: 50000,
      dueDate: '2024-01-15',
      categoryName: 'Development Levy',
      categoryType: 'levy',
      // Payment fields
      paymentId: 'PAY002',
      paymentMethod: 'cash',
      paymentDate: '2024-01-12',
      // Welfare fields
      contributionAmount: 10000,
      payoutAmount: 0,
      fundName: 'Medical Fund',
    },
  ];

  const getFieldsForReportType = (type: ReportType): string[] => {
    const fieldSets = {
      members: [
        'memberNumber', 'firstName', 'lastName', 'email', 'category', 'status',
        'totalDues', 'totalPaid', 'balance'
      ],
      transactions: [
        'transactionId', 'memberNumber', 'firstName', 'lastName', 'categoryName',
        'categoryType', 'amount', 'dueDate', 'status'
      ],
      payments: [
        'paymentId', 'memberNumber', 'firstName', 'lastName', 'amount',
        'paymentMethod', 'paymentDate', 'status'
      ],
      welfare: [
        'memberNumber', 'firstName', 'lastName', 'fundName', 'contributionAmount',
        'payoutAmount', 'date', 'status'
      ],
      donations: [
        'memberNumber', 'firstName', 'lastName', 'categoryName', 'amount',
        'donationDate', 'allocationName', 'status'
      ],
      levies: [
        'memberNumber', 'firstName', 'lastName', 'categoryName', 'amount',
        'dueDate', 'campaignName', 'status'
      ],
      penalties: [
        'memberNumber', 'firstName', 'lastName', 'penaltyType', 'amount',
        'appliedDate', 'reason', 'status'
      ],
      accounting: [
        'entryId', 'entryType', 'category', 'subcategory', 'amount',
        'description', 'date', 'reference'
      ],
    };
    return fieldSets[type] || fieldSets.members;
  };

  const handleReportTypeChange = (newType: ReportType) => {
    setReportType(newType);
    setSelectedFields(getFieldsForReportType(newType));
    setShowPreview(false);
  };

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
    setSelectedFields(getFieldsForReportType(reportType));
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
            title={`Custom ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Export Preview`}
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
          <Stack gap="xl">
            {/* Report Type Selection */}
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <div>
                  <Title order={4} mb="md">Select Report Type</Title>
                  <Text size="sm" c="dimmed" mb="md">
                    Choose the type of data you want to export
                  </Text>
                </div>

                <Tabs value={reportType} onChange={(value) => handleReportTypeChange(value as ReportType)}>
                  <Tabs.List>
                    <Tabs.Tab value="members" leftSection={<IconUsers size={16} />}>
                      Members
                    </Tabs.Tab>
                    <Tabs.Tab value="transactions" leftSection={<IconReceipt size={16} />}>
                      Transactions
                    </Tabs.Tab>
                    <Tabs.Tab value="payments" leftSection={<IconCoin size={16} />}>
                      Payments
                    </Tabs.Tab>
                    <Tabs.Tab value="welfare" leftSection={<IconGift size={16} />}>
                      Welfare
                    </Tabs.Tab>
                    <Tabs.Tab value="donations" leftSection={<IconGift size={16} />}>
                      Donations
                    </Tabs.Tab>
                    <Tabs.Tab value="levies" leftSection={<IconReceipt size={16} />}>
                      Levies
                    </Tabs.Tab>
                    <Tabs.Tab value="penalties" leftSection={<IconReceipt size={16} />}>
                      Penalties
                    </Tabs.Tab>
                    <Tabs.Tab value="accounting" leftSection={<IconReceipt size={16} />}>
                      Accounting
                    </Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="members" pt="md">
                    <Text size="sm" c="dimmed">
                      Export member information including personal details, contact info, and financial balances.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="transactions" pt="md">
                    <Text size="sm" c="dimmed">
                      Export transaction records including dues, levies, donations, and penalties.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="payments" pt="md">
                    <Text size="sm" c="dimmed">
                      Export payment records showing all member payments and payment methods.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="welfare" pt="md">
                    <Text size="sm" c="dimmed">
                      Export welfare contributions and payouts from various welfare funds.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="donations" pt="md">
                    <Text size="sm" c="dimmed">
                      Export donation records and allocation details.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="levies" pt="md">
                    <Text size="sm" c="dimmed">
                      Export levy campaigns and member assignments.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="penalties" pt="md">
                    <Text size="sm" c="dimmed">
                      Export penalty records including late payment fees and other penalties.
                    </Text>
                  </Tabs.Panel>
                  <Tabs.Panel value="accounting" pt="md">
                    <Text size="sm" c="dimmed">
                      Export accounting entries for financial reporting and analysis.
                    </Text>
                  </Tabs.Panel>
                </Tabs>
              </Stack>
            </Card>

            <Grid>
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <div>
                      <Title order={4} mb="md">Select Fields</Title>
                      <Text size="sm" c="dimmed" mb="md">
                        Choose the fields you want to include in your {reportType} export
                      </Text>
                    </div>

                    <ExportFieldSelector
                      selectedFields={selectedFields}
                      onChange={setSelectedFields}
                      reportType={reportType}
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
                        Report Type: {reportType.charAt(0).toUpperCase() + reportType.slice(1)}
                      </Text>
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
                      <strong>Tip:</strong> You can preview your export before generating to ensure you have selected the correct fields for your {reportType} report.
                    </Text>
                  </Alert>
                </Stack>
              </Grid.Col>
            </Grid>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
