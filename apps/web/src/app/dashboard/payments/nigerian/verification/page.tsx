'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack,
  Table,
  Loader,
  Alert,
  Pagination,
  Modal,
  Textarea,
  SimpleGrid,
  Badge,
  TextInput,
  Select
} from '@mantine/core';
import { 
  IconRefresh, 
  IconCheck, 
  IconX, 
  IconAlertTriangle,
  IconEye,
  IconFileText,
  IconSearch
} from '@tabler/icons-react';
import nigerianPaymentsApi, { PaymentProof } from '@/lib/api/nigerian-payments';
import { HelpLink } from '@/components/docs/HelpLink';

export default function PaymentVerificationQueue() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const pageSize = 10;
  
  useEffect(() => {
    loadProofs();
  }, [page, statusFilter]);
  
  const loadProofs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await nigerianPaymentsApi.getPaymentProofs({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
      });

      setProofs(response.proofs || []);
      setTotal(response.pagination?.totalCount || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payment proofs');
      setProofs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStatusFilter = (value: string | null) => {
    setStatusFilter(value);
    setPage(1);
  };
  
  const handleViewProof = (proof: PaymentProof) => {
    setSelectedProof(proof);
  };
  
  const handleVerify = () => {
    if (!selectedProof) return;
    setShowVerifyModal(true);
  };
  
  const confirmVerify = async () => {
    if (!selectedProof) return;
    
    try {
      await nigerianPaymentsApi.verifyPaymentProof(selectedProof.id, {
        status: 'APPROVED',
      });
      setShowVerifyModal(false);
      setSelectedProof(null);
      loadProofs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify payment proof');
    }
  };
  
  const handleReject = () => {
    if (!selectedProof) return;
    setShowRejectModal(true);
  };
  
  const confirmReject = async () => {
    if (!selectedProof) return;
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    
    try {
      await nigerianPaymentsApi.verifyPaymentProof(selectedProof.id, {
        status: 'REJECTED',
        rejectionReason: rejectReason,
      });
      setShowRejectModal(false);
      setSelectedProof(null);
      setRejectReason('');
      loadProofs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject payment proof');
    }
  };
  
  const totalPages = Math.ceil(total / pageSize);
  
  const statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];
  
  if (loading && proofs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Title order={2}>Payment Verification Queue</Title>
          <HelpLink />
        </Group>
        <Button onClick={loadProofs} variant="subtle" leftSection={<IconRefresh size={18} />}>
          Refresh
        </Button>
      </Group>
      
      {error && (
        <Alert color="red" title="Error" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Filters */}
      <Card shadow="sm" padding="md" withBorder mb="md">
        <Group gap="md">
          <Select
            placeholder="Filter by status"
            data={statusOptions}
            value={statusFilter}
            onChange={handleStatusFilter}
            clearable
            w={200}
          />
        </Group>
      </Card>
      
      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 4 }} spacing="md" mb="xl">
        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="yellow">
              {proofs?.filter(p => p.status === 'PENDING').length || 0}
            </Text>
            <Text size="sm" c="dimmed">Pending</Text>
          </Stack>
        </Card>
        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="green">
              {proofs?.filter(p => p.status === 'APPROVED').length || 0}
            </Text>
            <Text size="sm" c="dimmed">Approved</Text>
          </Stack>
        </Card>
        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="red">
              {proofs?.filter(p => p.status === 'REJECTED').length || 0}
            </Text>
            <Text size="sm" c="dimmed">Rejected</Text>
          </Stack>
        </Card>
        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="blue">{total}</Text>
            <Text size="sm" c="dimmed">Total</Text>
          </Stack>
        </Card>
      </SimpleGrid>
      
      {/* Proofs Table */}
      {(!proofs || proofs.length === 0) && !loading ? (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <IconFileText size={48} className="text-gray-400" />
            <Text c="dimmed" ta="center">
              No payment proofs found.
            </Text>
          </Stack>
        </Card>
      ) : (
        <>
          <Card shadow="sm" padding="0" withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Evidence</Table.Th>
                  <Table.Th>Uploaded</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {proofs && proofs.map((proof) => (
                  <Table.Tr key={proof.id}>
                    <Table.Td>
                      <Text size="sm" className="capitalize">{proof.paymentMethod?.replace('_', ' ') || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      {proof.filename ? (
                        <>
                          <Text size="sm" fw={500}>{proof.filename}</Text>
                          {proof.fileSize != null && (
                            <Text size="xs" c="dimmed">({Math.round(proof.fileSize / 1024)} KB)</Text>
                          )}
                        </>
                      ) : (
                        <Text size="xs" c="dimmed" lineClamp={2} maw={220}>{proof.declarationNote}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>{new Date(proof.uploadedAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          proof.status === 'PENDING' ? 'yellow' :
                          proof.status === 'APPROVED' ? 'green' : 'red'
                        }
                      >
                        {proof.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="subtle" onClick={() => handleViewProof(proof)}>
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
      
      {/* Proof Detail Modal */}
      {selectedProof && (
        <Modal
          opened={!!selectedProof && !showVerifyModal && !showRejectModal}
          onClose={() => setSelectedProof(null)}
          title="Payment Proof Details"
          size="lg"
        >
          <Stack gap="md">
            {selectedProof.member && (
              <Group gap="sm">
                <Text size="sm" c="dimmed">Member:</Text>
                <Text fw={500}>{selectedProof.member.firstName} {selectedProof.member.lastName} ({selectedProof.member.memberId})</Text>
              </Group>
            )}
            <Group gap="sm">
              <Text size="sm" c="dimmed">Method:</Text>
              <Text fw={500} className="capitalize">{selectedProof.paymentMethod?.replace('_', ' ') || '—'}</Text>
            </Group>
            <Group gap="sm">
              <Text size="sm" c="dimmed">Transaction(s):</Text>
              <Text fw={500}>
                {(selectedProof.transactionIds?.length > 0 ? selectedProof.transactionIds : selectedProof.transactionId ? [selectedProof.transactionId] : []).join(', ') || 'N/A'}
              </Text>
            </Group>
            {selectedProof.filename ? (
              <Group gap="sm">
                <Text size="sm" c="dimmed">File:</Text>
                <Text
                  fw={500}
                  component="a"
                  href={`${process.env.NEXT_PUBLIC_API_URL}/${selectedProof.filepath?.replace(/\\/g, '/')}`}
                  target="_blank"
                  className="underline"
                >
                  {selectedProof.filename}
                </Text>
              </Group>
            ) : (
              <div>
                <Text size="sm" c="dimmed" mb={4}>Declaration:</Text>
                <Text>{selectedProof.declarationNote}</Text>
              </div>
            )}
            <Group gap="sm">
              <Text size="sm" c="dimmed">Uploaded:</Text>
              <Text>{new Date(selectedProof.uploadedAt).toLocaleString()}</Text>
            </Group>
            <Group gap="sm">
              <Text size="sm" c="dimmed">Status:</Text>
              <Badge color={selectedProof.status === 'PENDING' ? 'yellow' : selectedProof.status === 'APPROVED' ? 'green' : 'red'}>
                {selectedProof.status}
              </Badge>
            </Group>

            {selectedProof.status === 'PENDING' && (
              <Group gap="sm" mt="md">
                <Button color="green" onClick={handleVerify} fullWidth leftSection={<IconCheck size={18} />}>
                  Verify Payment
                </Button>
                <Button color="red" onClick={handleReject} variant="light" fullWidth leftSection={<IconX size={18} />}>
                  Reject
                </Button>
              </Group>
            )}
            
            {selectedProof.rejectionReason && (
              <Text size="sm" c="dimmed" mt="md">
                Rejection Reason: {selectedProof.rejectionReason}
              </Text>
            )}
          </Stack>
        </Modal>
      )}
      
      {/* Verify Confirmation Modal */}
      <Modal
        opened={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Verify Payment"
        size="sm"
      >
        <Stack gap="md">
          <Text>Are you sure you want to verify this payment proof?</Text>
          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={() => setShowVerifyModal(false)}>Cancel</Button>
            <Button color="green" onClick={confirmVerify}>Verify</Button>
          </Group>
        </Stack>
      </Modal>
      
      {/* Reject Modal */}
      <Modal
        opened={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
        title="Reject Payment Proof"
        size="sm"
      >
        <Stack gap="md">
          <Text>Are you sure you want to reject this payment proof?</Text>
          <Textarea
            label="Rejection Reason"
            placeholder="Please provide a reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button color="red" onClick={confirmReject} disabled={!rejectReason.trim()}>Reject</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
