'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  Modal,
  Select,
  Textarea,
  FileInput,
  TextInput,
  LoadingOverlay,
  Pagination,
  Image,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconUpload,
  IconPhoto,
  IconCheck,
  IconX,
  IconEye,
  IconAlertCircle,
  IconDownload,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  getPaymentProofs,
  uploadPaymentProof,
  verifyPaymentProof,
  PaymentProof,
} from '@/lib/api/nigerian-payments';

export default function PaymentProofsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: proofsData, isLoading } = useQuery({
    queryKey: ['payment-proofs', page, statusFilter],
    queryFn: () =>
      getPaymentProofs({
        page,
        limit: 20,
        status: statusFilter || undefined,
      }),
  });

  const proofs = proofsData?.data?.proofs || [];
  const pagination = proofsData?.data?.pagination;

  const uploadForm = useForm({
    initialValues: {
      transactionId: '',
      notes: '',
    },
  });

  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadPaymentProof,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
      notifications.show({
        title: 'Success',
        message: 'Payment proof uploaded successfully',
        color: 'green',
      });
      setUploadModalOpen(false);
      setUploadFile(null);
      uploadForm.reset();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to upload payment proof',
        color: 'red',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string } }) =>
      verifyPaymentProof(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
      notifications.show({
        title: 'Success',
        message: 'Payment proof verified successfully',
        color: 'green',
      });
      setVerifyModalOpen(false);
      setSelectedProof(null);
      setRejectionReason('');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to verify payment proof',
        color: 'red',
      });
    },
  });

  const handleUpload = () => {
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadForm.values.transactionId) {
      formData.append('transactionId', uploadForm.values.transactionId);
    }
    if (uploadForm.values.notes) {
      formData.append('notes', uploadForm.values.notes);
    }

    uploadMutation.mutate(formData);
  };

  const handleVerify = (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedProof) return;

    if (status === 'REJECTED' && !rejectionReason) {
      notifications.show({
        title: 'Error',
        message: 'Please provide a rejection reason',
        color: 'red',
      });
      return;
    }

    verifyMutation.mutate({
      id: selectedProof.id,
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
      },
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'yellow';
      case 'APPROVED':
        return 'green';
      case 'REJECTED':
        return 'red';
      default:
        return 'gray';
    }
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            component={Link}
            href="/dashboard/finance/payments/nigerian"
          >
            Back
          </Button>
          <div>
            <Title order={2}>Payment Proofs</Title>
            <Text c="dimmed">Review and verify uploaded payment proofs</Text>
          </div>
        </Group>
        <Button leftSection={<IconUpload size={16} />} onClick={() => setUploadModalOpen(true)}>
          Upload Proof
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Pending Review
              </Text>
              <Text size="xl" fw={700}>
                {proofs.filter((p: PaymentProof) => p.status === 'PENDING').length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
              <IconAlertCircle size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Approved
              </Text>
              <Text size="xl" fw={700}>
                {proofs.filter((p: PaymentProof) => p.status === 'APPROVED').length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="green">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Rejected
              </Text>
              <Text size="xl" fw={700}>
                {proofs.filter((p: PaymentProof) => p.status === 'REJECTED').length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="red">
              <IconX size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Filters */}
      <Paper p="md" radius="md" withBorder>
        <Group>
          <Select
            placeholder="Filter by status"
            data={[
              { value: '', label: 'All Statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
          />
        </Group>
      </Paper>

      <Card padding="lg" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        {proofs.length > 0 ? (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Transaction</Table.Th>
                  <Table.Th>Uploaded</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {proofs.map((proof: PaymentProof) => (
                  <Table.Tr key={proof.id}>
                    <Table.Td>
                      <Text size="sm">
                        {proof.member?.firstName} {proof.member?.lastName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {proof.filename}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatFileSize(proof.fileSize)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {proof.transaction?.referenceNumber || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(proof.uploadedAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(proof.status)}>{proof.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEye size={14} />}
                          onClick={() => {
                            setSelectedProof(proof);
                            setViewModalOpen(true);
                          }}
                        >
                          View
                        </Button>
                        {proof.status === 'PENDING' && (
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            onClick={() => {
                              setSelectedProof(proof);
                              setVerifyModalOpen(true);
                            }}
                          >
                            Review
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {pagination && pagination.totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination value={page} onChange={setPage} total={pagination.totalPages} />
              </Group>
            )}
          </>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No payment proofs found.
          </Text>
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        opened={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadFile(null);
          uploadForm.reset();
        }}
        title="Upload Payment Proof"
        size="md"
      >
        <Stack gap="md">
          <FileInput
            label="Payment Proof"
            placeholder="Select image or PDF"
            accept="image/*,.pdf"
            value={uploadFile}
            onChange={setUploadFile}
            leftSection={<IconPhoto size={16} />}
            required
          />

          <TextInput
            label="Transaction ID (Optional)"
            placeholder="Enter transaction ID if known"
            {...uploadForm.getInputProps('transactionId')}
          />

          <Textarea
            label="Notes"
            placeholder="Additional notes about this payment"
            {...uploadForm.getInputProps('notes')}
          />

          <Alert color="blue">
            Supported formats: JPEG, PNG, GIF, PDF. Maximum size: 5MB
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              loading={uploadMutation.isPending}
              disabled={!uploadFile}
            >
              Upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Modal */}
      <Modal
        opened={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedProof(null);
        }}
        title="Payment Proof Details"
        size="lg"
      >
        {selectedProof && (
          <Stack gap="md">
            <Paper p="md" withBorder>
              <SimpleGrid cols={2}>
                <div>
                  <Text size="sm" c="dimmed">Member</Text>
                  <Text size="sm" fw={500}>
                    {selectedProof.member?.firstName} {selectedProof.member?.lastName}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Status</Text>
                  <Badge color={getStatusColor(selectedProof.status)}>{selectedProof.status}</Badge>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Filename</Text>
                  <Text size="sm">{selectedProof.filename}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">File Size</Text>
                  <Text size="sm">{formatFileSize(selectedProof.fileSize)}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Uploaded</Text>
                  <Text size="sm">{new Date(selectedProof.uploadedAt).toLocaleString()}</Text>
                </div>
                {selectedProof.transaction && (
                  <div>
                    <Text size="sm" c="dimmed">Transaction</Text>
                    <Text size="sm" ff="monospace">{selectedProof.transaction.referenceNumber}</Text>
                  </div>
                )}
              </SimpleGrid>
            </Paper>

            {selectedProof.notes && (
              <div>
                <Text size="sm" c="dimmed">Notes</Text>
                <Text size="sm">{selectedProof.notes}</Text>
              </div>
            )}

            {selectedProof.rejectionReason && (
              <Alert color="red">
                <Text size="sm" fw={500}>Rejection Reason:</Text>
                <Text size="sm">{selectedProof.rejectionReason}</Text>
              </Alert>
            )}

            {/* Preview */}
            <Paper p="md" withBorder>
              <Text size="sm" c="dimmed" mb="sm">Preview</Text>
              {isImageFile(selectedProof.mimeType) ? (
                <Image
                  src={`/api/uploads/payment-proofs/${selectedProof.filepath.split('/').pop()}`}
                  alt="Payment proof"
                  fit="contain"
                  h={300}
                  fallbackSrc="https://placehold.co/400x300?text=Preview+Not+Available"
                />
              ) : (
                <Group justify="center" py="xl">
                  <Stack align="center" gap="xs">
                    <IconPhoto size={48} color="gray" />
                    <Text c="dimmed">PDF file - click to download</Text>
                    <Button
                      variant="light"
                      leftSection={<IconDownload size={16} />}
                      component="a"
                      href={`/api/uploads/payment-proofs/${selectedProof.filepath.split('/').pop()}`}
                      download
                    >
                      Download PDF
                    </Button>
                  </Stack>
                </Group>
              )}
            </Paper>
          </Stack>
        )}
      </Modal>

      {/* Verify Modal */}
      <Modal
        opened={verifyModalOpen}
        onClose={() => {
          setVerifyModalOpen(false);
          setSelectedProof(null);
          setRejectionReason('');
        }}
        title="Verify Payment Proof"
        size="md"
      >
        {selectedProof && (
          <Stack gap="md">
            <Paper p="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Member</Text>
                  <Text size="sm" fw={500}>
                    {selectedProof.member?.firstName} {selectedProof.member?.lastName}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">File</Text>
                  <Text size="sm">{selectedProof.filename}</Text>
                </Group>
                {selectedProof.transaction && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Transaction</Text>
                    <Text size="sm" ff="monospace">{selectedProof.transaction.referenceNumber}</Text>
                  </Group>
                )}
              </Stack>
            </Paper>

            <Textarea
              label="Rejection Reason (required if rejecting)"
              placeholder="Enter reason for rejection"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />

            <Alert color="blue">
              Approving this proof will mark the linked transaction as paid.
            </Alert>

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => handleVerify('REJECTED')}
                loading={verifyMutation.isPending}
              >
                Reject
              </Button>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => handleVerify('APPROVED')}
                loading={verifyMutation.isPending}
              >
                Approve
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
