'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Group,
  Button,
  Stack,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Loader
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBuildingBank,
  IconDeviceFloppy,
  IconUser
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankTransfer, BankAccount } from '@/lib/api/nigerian-payments';

export default function CreateBankTransferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    amount: 0,
    transferDate: new Date().toISOString().split('T')[0],
    senderBankName: '',
    senderAccountNumber: '',
    senderAccountName: '',
    reference: '',
    narration: '',
    receivingBankAccountId: '',
    memberId: ''
  });
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Load bank accounts on mount
  const loadBankAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const accounts = await nigerianPaymentsApi.getBankAccounts();
      setBankAccounts(accounts);
    } catch (err: any) {
      console.error('Error loading bank accounts:', err);
      setError('Failed to load bank accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Validate required fields
      if (!formData.amount || formData.amount <= 0) {
        setError('Amount is required and must be greater than 0');
        return;
      }
      
      if (!formData.senderBankName) {
        setError('Sender bank name is required');
        return;
      }
      
      if (!formData.senderAccountNumber) {
        setError('Sender account number is required');
        return;
      }
      
      if (!formData.receivingBankAccountId) {
        setError('Receiving bank account is required');
        return;
      }

      const transferData = {
        amount: formData.amount,
        transferDate: formData.transferDate,
        senderBankName: formData.senderBankName,
        senderAccountNumber: formData.senderAccountNumber,
        senderAccountName: formData.senderAccountName,
        reference: formData.reference,
        narration: formData.narration,
        receivingBankAccountId: formData.receivingBankAccountId,
        memberId: formData.memberId ? parseInt(formData.memberId) : undefined
      };

      const transfer = await nigerianPaymentsApi.createBankTransfer(transferData);
      
      setSuccess('Bank transfer recorded successfully');
      // Redirect to transfer details page after 2 seconds
      setTimeout(() => {
        if (transfer && transfer.id) {
          router.push(`/dashboard/payments/nigerian/transfers/${transfer.id}`);
        }
      }, 2000);
    } catch (err: any) {
      console.error('Error creating bank transfer:', err);
      setError(err.response?.data?.message || 'Failed to record bank transfer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Title order={2}>Create Bank Transfer</Title>
        <Button leftSection={<IconArrowLeft size={20} />} variant="subtle" onClick={() => router.push('/dashboard/payments/nigerian/transfers')}>
          Back to Transfers
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" icon={<IconArrowLeft />} mb="md" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="green" title="Success" icon={<IconDeviceFloppy />} mb="md" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card shadow="sm" padding="lg" withBorder>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Amount */}
            <div>
              <Text size="sm" fw={600} mb="xs">Amount (₦) *</Text>
              <NumberInput
                value={formData.amount}
                onChange={(value) => handleInputChange('amount', value)}
                placeholder="Enter amount"
                min={0}
                step={0.01}
                decimalScale={2}
                required
                size="md"
              />
            </div>

            {/* Transfer Date */}
            <div>
              <Text size="sm" fw={600} mb="xs">Transfer Date *</Text>
              <TextInput
                type="date"
                value={formData.transferDate}
                onChange={(e) => handleInputChange('transferDate', e.target.value)}
                required
                size="md"
              />
            </div>

            {/* Sender Bank Name */}
            <div>
              <Text size="sm" fw={600} mb="xs">Sender Bank Name *</Text>
              <TextInput
                value={formData.senderBankName}
                onChange={(e) => handleInputChange('senderBankName', e.target.value)}
                placeholder="e.g., Access Bank, GTBank"
                required
                size="md"
                leftSection={<IconBuildingBank size={16} />}
              />
            </div>

            {/* Sender Account Number */}
            <div>
              <Text size="sm" fw={600} mb="xs">Sender Account Number *</Text>
              <TextInput
                value={formData.senderAccountNumber}
                onChange={(e) => handleInputChange('senderAccountNumber', e.target.value)}
                placeholder="Enter sender account number"
                required
                size="md"
              />
            </div>

            {/* Sender Account Name */}
            <div>
              <Text size="sm" fw={600} mb="xs">Sender Account Name</Text>
              <TextInput
                value={formData.senderAccountName}
                onChange={(e) => handleInputChange('senderAccountName', e.target.value)}
                placeholder="Enter sender account name (optional)"
                size="md"
              />
            </div>

            {/* Reference */}
            <div>
              <Text size="sm" fw={600} mb="xs">Reference Number</Text>
              <TextInput
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                placeholder="Enter reference number (optional)"
                size="md"
              />
            </div>

            {/* Narration */}
            <div>
              <Text size="sm" fw={600} mb="xs">Narration</Text>
              <Textarea
                value={formData.narration}
                onChange={(e) => handleInputChange('narration', e.target.value)}
                placeholder="Enter description or narration (optional)"
                minRows={3}
                size="md"
              />
            </div>

            {/* Receiving Bank Account */}
            <div>
              <Text size="sm" fw={600} mb="xs">Receiving Bank Account *</Text>
              <Select
                value={formData.receivingBankAccountId}
                onChange={(value) => handleInputChange('receivingBankAccountId', value)}
                placeholder="Select receiving bank account"
                required
                disabled={loadingAccounts}
                size="md"
                data={bankAccounts.map(acc => ({
                  value: acc.id.toString(),
                  label: `${acc.bankName} - ${acc.accountNumber} (${acc.accountName})`,
                }))}
                leftSection={<IconBuildingBank size={16} />}
              />
              {loadingAccounts && (
                <Text size="xs" c="dimmed" mt="xs">
                  Loading bank accounts...
                </Text>
              )}
            </div>

            {/* Member ID */}
            <div>
              <Text size="sm" fw={600} mb="xs">Member ID (Optional)</Text>
              <TextInput
                value={formData.memberId}
                onChange={(e) => handleInputChange('memberId', e.target.value)}
                placeholder="Link to member ID (optional)"
                size="md"
                leftSection={<IconUser size={16} />}
              />
              <Text size="xs" c="dimmed" mt="xs">
                Leave empty if this transfer is not linked to a specific member
              </Text>
            </div>

            {/* Submit Button */}
            <Group justify="flex-end" mt="md">
              <Button
                type="submit"
                leftSection={<IconDeviceFloppy size={20} />}
                loading={submitting}
                size="md"
              >
                {submitting ? 'Recording Transfer...' : 'Record Transfer'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </div>
  );
}
