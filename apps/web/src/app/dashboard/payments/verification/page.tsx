'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  LoadingOverlay,
  Modal,
  Textarea,
  Image,
  Tabs,
  ActionIcon,
  Pagination,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  CheckCircle,
  X,
  Eye,
  FileText,
  Clock,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import {
  nigerianPaymentsApi,
  type PaymentProof,
  type BankTransfer,
} from '@/lib/api/nigerian-payments';
import { notifications } from '@mantine/notifications';
import { PERMISSIONS } from '@/lib/permissions';

export default function VerificationPage() {
  const [loading, setLoading] = useState(true);
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [bankTransfers, setBankTransfers] = useState<BankTransfer[]>([]);
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [verifyModal, setVerifyModal] = useState(false);
  const [action, setAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const form = useForm({
    initialValues: {
      notes: '',
      rejectionReason: '',
    },
  });

  const accessDeniedFallback = (
    <Stack align="center" gap="lg" py="xl">
      <Card withBorder padding="xl" w="100%" maw={600}>
        <Stack align="center" gap="md">
          <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'var(--mantine-color-red-1)' }}>
            <X size={48} color="var(--mantine-color-red-6)" />
          </div>
          <Title order={2} ta="center">Access Denied</Title>
          <Text size="sm" c="dimmed" ta="center">
            You don't have permission to access the payment verification page. 
            Please contact your administrator if you believe you should have access.
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Required permission: PAYMENT_CONFIRM (payments.approve)
          </Text>
        </Stack>
      </Card>
    </Stack>
  );

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proofsRes, transfersRes] = await Promise.all([
        nigerianPaymentsApi.getPaymentProofs({ status: 'PENDING', page, limit: 20 }),
        nigerianPaymentsApi.getBankTransfers({ status: 'PENDING', limit: 100 }),
      ]);

      setPaymentProofs(proofsRes.proofs || []);
      setTotal(proofsRes.pagination?.totalCount || 0);
      setBankTransfers(transfersRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load verification queue',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerifyModal = (proof: PaymentProof, actionType: 'APPROVED' | 'REJECTED') => {
    setSelectedProof(proof);
    setAction(actionType);
    form.reset();
    setVerifyModal(true);
  };

  const handleVerify = async (values: typeof form.values) => {
    if (!selectedProof) return;

    try {
      setSubmitting(true);

      await nigerianPaymentsApi.verifyPaymentProof(selectedProof.id, {
        status: action,
        rejectionReason: action === 'REJECTED' ? values.rejectionReason : undefined,
        notes: values.notes || undefined,
      });

      notifications.show({
        title: 'Success',
        message: `Payment proof ${action.toLowerCase()} successfully`,
        color: 'green',
      });

      setVerifyModal(false);
      setSelectedProof(null);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to verify payment proof',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(num);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <Can permission={PERMISSIONS.PAYMENT_CONFIRM} fallback={accessDeniedFallback}>
      <Stack gap="lg">
        <div>
          <Title order={2}>Payment Verification</Title>
          <Text size="sm" c="dimmed">
            Review and verify payment proofs and bank transfers
          </Text>
        </div>

        {/* Stats */}
        <Group grow>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Pending Proofs</Text>
              <FileText size={20} color="blue" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {paymentProofs.length}
            </Text>
          </Card>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Pending Transfers</Text>
              <Clock size={20} color="orange" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {bankTransfers.length}
            </Text>
          </Card>
        </Group>

        {/* Tabs */}
        <Tabs defaultValue="proofs">
          <Tabs.List>
            <Tabs.Tab value="proofs">
              Payment Proofs ({paymentProofs.length})
            </Tabs.Tab>
            <Tabs.Tab value="transfers">
              Bank Transfers ({bankTransfers.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* Payment Proofs Tab */}
          <Tabs.Panel value="proofs" pt="md">
            <Card withBorder padding="lg">
              <LoadingOverlay visible={loading} />

              {paymentProofs.length === 0 ? (
                <Stack align="center" py="xl">
                  <CheckCircle size={48} color="green" />
                  <Text size="sm" c="dimmed" ta="center">
                    No pending payment proofs. Great job!
                  </Text>
                </Stack>
              ) : (
                <>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Uploaded</Table.Th>
                        <Table.Th>Member</Table.Th>
                        <Table.Th>Method</Table.Th>
                        <Table.Th>Transaction(s)</Table.Th>
                        <Table.Th>Evidence</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {paymentProofs.map((proof) => {
                        const ids = proof.transactionIds?.length > 0 ? proof.transactionIds : (proof.transactionId ? [proof.transactionId] : []);
                        return (
                        <Table.Tr key={proof.id}>
                          <Table.Td>
                            {new Date(proof.uploadedAt).toLocaleDateString()}
                          </Table.Td>
                          <Table.Td>
                            {proof.member ? (
                              <Text size="sm" fw={500}>
                                {proof.member.firstName} {proof.member.lastName} ({proof.member.memberId})
                              </Text>
                            ) : (
                              'N/A'
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" className="capitalize">{proof.paymentMethod?.replace('_', ' ') || '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            {ids.length > 0 ? (
                              <Text size="sm" fw={500}>
                                {ids.length} item{ids.length > 1 ? 's' : ''} (#{ids.join(', #')})
                              </Text>
                            ) : (
                              'N/A'
                            )}
                          </Table.Td>
                          <Table.Td>
                            {proof.filename ? (
                              <Group gap="xs">
                                <Text size="sm">{proof.filename}</Text>
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  component="a"
                                  href={`${process.env.NEXT_PUBLIC_API_URL}/${proof.filepath?.replace(/\\/g, '/')}`}
                                  target="_blank"
                                >
                                  <Eye size={14} />
                                </ActionIcon>
                              </Group>
                            ) : (
                              <Text size="sm" c="dimmed" lineClamp={2} maw={240}>
                                {proof.declarationNote || 'No evidence provided'}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Button
                                size="xs"
                                color="green"
                                leftSection={<CheckCircle size={14} />}
                                onClick={() => handleOpenVerifyModal(proof, 'APPROVED')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                color="red"
                                variant="light"
                                leftSection={<X size={14} />}
                                onClick={() => handleOpenVerifyModal(proof, 'REJECTED')}
                              >
                                Reject
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>

                  {totalPages > 1 && (
                    <Group justify="center" mt="lg">
                      <Pagination value={page} onChange={setPage} total={totalPages} />
                    </Group>
                  )}
                </>
              )}
            </Card>
          </Tabs.Panel>

          {/* Bank Transfers Tab */}
          <Tabs.Panel value="transfers" pt="md">
            <Card withBorder padding="lg">
              {bankTransfers.length === 0 ? (
                <Stack align="center" py="xl">
                  <CheckCircle size={48} color="green" />
                  <Text size="sm" c="dimmed" ta="center">
                    No pending bank transfers
                  </Text>
                </Stack>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Reference</Table.Th>
                      <Table.Th>Sender</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Bank</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {bankTransfers.map((transfer) => (
                      <Table.Tr key={transfer.id}>
                        <Table.Td>
                          {new Date(transfer.transferDate).toLocaleDateString()}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {transfer.reference}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {transfer.senderAccountName || transfer.senderAccountNumber}
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500}>{formatCurrency(transfer.amount)}</Text>
                        </Table.Td>
                        <Table.Td>{transfer.senderBankName}</Table.Td>
                        <Table.Td>
                          <Badge color="yellow" size="sm">
                            PENDING
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>

        {/* Verification Modal */}
        <Modal
          opened={verifyModal}
          onClose={() => {
            setVerifyModal(false);
            setSelectedProof(null);
            form.reset();
          }}
          title={`${action === 'APPROVED' ? 'Approve' : 'Reject'} Payment Proof`}
          size="lg"
        >
          {selectedProof && (
            <form onSubmit={form.onSubmit(handleVerify)}>
              <Stack>
                {/* Proof Preview */}
                {selectedProof.filename && selectedProof.mimeType?.includes('image') && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Payment Proof
                    </Text>
                    <Image
                      src={`${process.env.NEXT_PUBLIC_API_URL}/${selectedProof.filepath?.replace(/\\/g, '/')}`}
                      alt="Payment proof"
                      radius="md"
                      fit="contain"
                      h={300}
                    />
                  </div>
                )}

                {/* Details */}
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Details
                  </Text>
                  <Stack gap="xs">
                    {selectedProof.member && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Member
                        </Text>
                        <Text size="sm">
                          {selectedProof.member.firstName} {selectedProof.member.lastName} ({selectedProof.member.memberId})
                        </Text>
                      </Group>
                    )}
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Method
                      </Text>
                      <Text size="sm" className="capitalize">{selectedProof.paymentMethod?.replace('_', ' ') || '—'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Transaction(s)
                      </Text>
                      <Text size="sm">
                        {(selectedProof.transactionIds?.length > 0 ? selectedProof.transactionIds : selectedProof.transactionId ? [selectedProof.transactionId] : []).join(', ') || 'N/A'}
                      </Text>
                    </Group>
                    {selectedProof.filename ? (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          File
                        </Text>
                        <Text size="sm">{selectedProof.filename}</Text>
                      </Group>
                    ) : (
                      <div>
                        <Text size="sm" c="dimmed" mb={4}>
                          Declaration
                        </Text>
                        <Text size="sm">{selectedProof.declarationNote}</Text>
                      </div>
                    )}
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Uploaded
                      </Text>
                      <Text size="sm">
                        {new Date(selectedProof.uploadedAt).toLocaleString()}
                      </Text>
                    </Group>
                  </Stack>
                </div>

                {/* Form */}
                {action === 'REJECTED' && (
                  <Textarea
                    label="Rejection Reason"
                    placeholder="Explain why this proof is being rejected"
                    required
                    rows={3}
                    {...form.getInputProps('rejectionReason')}
                  />
                )}

                <Textarea
                  label="Notes (Optional)"
                  placeholder="Add any additional notes"
                  rows={2}
                  {...form.getInputProps('notes')}
                />

                <Group justify="flex-end">
                  <Button
                    variant="light"
                    onClick={() => {
                      setVerifyModal(false);
                      setSelectedProof(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={submitting}
                    color={action === 'APPROVED' ? 'green' : 'red'}
                  >
                    {action === 'APPROVED' ? 'Approve' : 'Reject'}
                  </Button>
                </Group>
              </Stack>
            </form>
          )}
        </Modal>
      </Stack>
    </Can>
  );
}
