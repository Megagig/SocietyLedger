'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Image, Loader, Modal, Stack, Table, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CheckCircle, ExternalLink, X } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';
import { nigerianPaymentsApi, type PaymentProof, type PaymentProofFileLink } from '@/lib/api/nigerian-payments';

const formatMoney = (value: string | number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(typeof value === 'string' ? parseFloat(value) : value);

const methodLabel = (method: string | null | undefined) => (method ? method.replace(/_/g, ' ') : 'Not stated');

const STATUS_COLOR: Record<string, string> = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' };
const STATUS_LABEL: Record<string, string> = { PENDING: 'Waiting', APPROVED: 'Verified', REJECTED: 'Rejected' };

interface ProofReviewModalProps {
  proofId: number | null;
  onClose: () => void;
  /** Called after a verify or reject, so the list behind the modal reloads. */
  onDecided: () => void;
}

type Mode = 'review' | 'verifying' | 'rejecting';

/**
 * Review one payment proof: the receipt, the charges to match against the bank statement, then Verify or Reject.
 * Verifying records each declared charge's remaining balance and can't be undone; rejecting needs a reason, which the member is sent.
 */
export function ProofReviewModal({ proofId, onClose, onDecided }: ProofReviewModalProps) {
  const myUserId = useAuthStore((s) => s.user?.id);
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [link, setLink] = useState<PaymentProofFileLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('review');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await nigerianPaymentsApi.getPaymentProof(String(id));
      setProof(detail);
      if (detail.hasFile) {
        try {
          setLink(await nigerianPaymentsApi.getPaymentProofFileUrl(id));
        } catch {
          setLink(null);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load this payment proof');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setProof(null);
    setLink(null);
    setMode('review');
    setReason('');
    if (proofId !== null) load(proofId);
  }, [proofId]);

  const decide = async (status: 'APPROVED' | 'REJECTED') => {
    if (!proof) return;
    setSubmitting(true);
    try {
      await nigerianPaymentsApi.verifyPaymentProof(proof.id, { status, rejectionReason: status === 'REJECTED' ? reason.trim() : undefined });
      notifications.show({
        title: status === 'APPROVED' ? 'Payment verified' : 'Proof rejected',
        message: status === 'APPROVED' ? 'The payments have been recorded.' : 'The member has been told why.',
        color: 'green',
      });
      onDecided();
      onClose();
    } catch (err: any) {
      // e.g. someone else decided it first — show where it really stands.
      notifications.show({ title: 'Could not save your decision', message: err.response?.data?.message || 'Try again.', color: 'red' });
      setMode('review');
      if (proofId !== null) load(proofId);
    } finally {
      setSubmitting(false);
    }
  };

  const declared = proof?.declaredItems ?? [];
  const pending = proof?.status === 'PENDING';
  const isOwn = Boolean(proof?.member?.userId && myUserId !== undefined && proof.member.userId === myUserId);
  const nothingToApply = Boolean(proof && declared.length === 0 && !proof.bankTransferId);
  const recordsNothing = declared.length > 0 && Number(proof?.declaredBalance ?? 0) <= 0;
  const chargesPaid = declared.filter((item) => Number(item.balance) > 0).length;

  const itemNote = (item: (typeof declared)[number]) => {
    if (item.isVoided) return 'Voided';
    if (item.status === 'waived') return 'Waived';
    if (Number(item.balance) <= 0) return 'Already settled';
    return null;
  };

  return (
    <Modal opened={proofId !== null} onClose={onClose} title="Payment proof" size="lg">
      {loading && !proof ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : error ? (
        <Alert color="red">{error}</Alert>
      ) : proof ? (
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={600}>
                {proof.member?.firstName} {proof.member?.lastName}
              </Text>
              <Text size="sm" c="dimmed">
                {proof.member?.memberId} · <span className="capitalize">{methodLabel(proof.paymentMethod)}</span> · {new Date(proof.uploadedAt).toLocaleString()}
              </Text>
            </div>
            <Badge color={STATUS_COLOR[proof.status]}>{STATUS_LABEL[proof.status]}</Badge>
          </Group>

          {isOwn && pending && <Alert color="yellow">You submitted this proof yourself, so another officer needs to verify or reject it.</Alert>}
          {proof.status === 'REJECTED' && proof.rejectionReason && <Alert color="red" title="Rejected">{proof.rejectionReason}</Alert>}

          {/* Receipt */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Receipt
            </Text>
            {proof.hasFile ? (
              link ? (
                link.mimeType?.startsWith('image/') ? (
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <Image src={link.url} alt="Payment receipt" radius="md" fit="contain" h={320} />
                  </a>
                ) : (
                  <Button component="a" href={link.url} target="_blank" rel="noopener noreferrer" variant="light" leftSection={<ExternalLink size={16} />}>
                    Open {link.filename ?? 'receipt'}
                  </Button>
                )
              ) : (
                <Alert color="red">We couldn&apos;t load the receipt. Close this and try again.</Alert>
              )
            ) : proof.declarationNote ? (
              <Alert color="gray" title="No receipt — the member wrote this instead">
                {proof.declarationNote}
              </Alert>
            ) : (
              <Text size="sm" c="dimmed">
                The member attached no receipt or note.
              </Text>
            )}
          </div>

          {/* Charges to match */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Charges to match
            </Text>
            {declared.length > 0 ? (
              <>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Charge</Table.Th>
                      <Table.Th>Due</Table.Th>
                      <Table.Th ta="right">Charged</Table.Th>
                      <Table.Th ta="right">Paid</Table.Th>
                      <Table.Th ta="right">Verifying records</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {declared.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          {item.category.name}
                          {item.referenceNumber && (
                            <Text size="xs" c="dimmed">
                              {item.referenceNumber}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</Table.Td>
                        <Table.Td ta="right">{formatMoney(item.amount)}</Table.Td>
                        <Table.Td ta="right">{formatMoney(item.paid)}</Table.Td>
                        <Table.Td ta="right">{itemNote(item) ?? <b>{formatMoney(item.balance)}</b>}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                  <Table.Tfoot>
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <b>Total to compare with your bank statement</b>
                      </Table.Td>
                      <Table.Td ta="right">
                        <b>{formatMoney(proof.declaredBalance ?? 0)}</b>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tfoot>
                </Table>
                {recordsNothing && pending && (
                  <Text size="xs" c="dimmed" mt="xs">
                    These charges are already settled, voided or waived, so verifying records no new payment.
                  </Text>
                )}
              </>
            ) : (
              <Alert color={nothingToApply && pending ? 'yellow' : 'gray'}>
                {proof.bankTransferId
                  ? 'This proof is linked to a bank transfer. Verifying confirms that transfer.'
                  : "This proof isn't linked to any charge, so verifying it would record no payment. Reject it with a reason, and ask the member to submit it again."}
              </Alert>
            )}
          </div>

          {proof.notes && (
            <div>
              <Text size="sm" fw={500} mb={4}>
                Note from the member
              </Text>
              <Text size="sm">{proof.notes}</Text>
            </div>
          )}

          {/* Decision */}
          {pending && !isOwn && (
            <Can permission={PERMISSIONS.PAYMENT_CONFIRM}>
              {mode === 'review' && (
                <Group justify="flex-end">
                  <Button color="red" variant="light" leftSection={<X size={16} />} onClick={() => setMode('rejecting')}>
                    Reject
                  </Button>
                  <Button color="green" leftSection={<CheckCircle size={16} />} disabled={nothingToApply} onClick={() => setMode('verifying')}>
                    Verify payment
                  </Button>
                </Group>
              )}
              {mode === 'verifying' && (
                <Alert color="green" title="Verify this payment?">
                  <Text size="sm" mb="sm">
                    {recordsNothing || declared.length === 0
                      ? 'This marks the proof verified. No new payment is recorded. You can’t undo it.'
                      : `This records ${formatMoney(proof.declaredBalance ?? 0)} across ${chargesPaid} charge${chargesPaid === 1 ? '' : 's'} and marks them paid. You can’t undo it.`}
                  </Text>
                  <Group justify="flex-end">
                    <Button variant="subtle" onClick={() => setMode('review')} disabled={submitting}>
                      Not yet
                    </Button>
                    <Button color="green" loading={submitting} onClick={() => decide('APPROVED')}>
                      Verify payment
                    </Button>
                  </Group>
                </Alert>
              )}
              {mode === 'rejecting' && (
                <Alert color="red" title="Reject this proof?">
                  <Text size="sm" mb="sm">
                    Nothing is recorded. {proof.member?.firstName} is told why and can submit it again. You can’t undo this.
                  </Text>
                  <Textarea
                    label="Reason"
                    placeholder="Why can't you verify this payment? For example, how much you actually received."
                    required
                    minRows={3}
                    value={reason}
                    onChange={(e) => setReason(e.currentTarget.value)}
                    mb="sm"
                  />
                  <Group justify="flex-end">
                    <Button variant="subtle" onClick={() => setMode('review')} disabled={submitting}>
                      Keep it
                    </Button>
                    <Button color="red" loading={submitting} disabled={reason.trim().length < 3} onClick={() => decide('REJECTED')}>
                      Reject proof
                    </Button>
                  </Group>
                </Alert>
              )}
            </Can>
          )}
        </Stack>
      ) : null}
    </Modal>
  );
}
