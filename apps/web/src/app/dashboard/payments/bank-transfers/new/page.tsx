'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  TextInput,
  NumberInput,
  Textarea,
  Select,
  LoadingOverlay,
  Alert,
  FileInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { Upload, AlertCircle, ArrowLeft } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  nigerianPaymentsApi,
  type BankAccount,
} from '@/lib/api/nigerian-payments';
import api from '@/lib/axios';
import { HelpLink } from '@/components/docs/HelpLink';
import { notifications } from '@mantine/notifications';

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function RecordTransferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const form = useForm({
    initialValues: {
      memberId: '',
      bankAccountId: '',
      senderBankName: '',
      senderAccountNumber: '',
      senderAccountName: '',
      amount: 0,
      reference: '',
      transferDate: new Date(),
      narration: '',
      notes: '',
    },
    validate: {
      senderBankName: (value) => (!value ? 'Bank name is required' : null),
      amount: (value) => (value <= 0 ? 'Amount must be greater than 0' : null),
      reference: (value) => (!value ? 'Reference is required' : null),
      transferDate: (value) => (!value ? 'Transfer date is required' : null),
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountsRes, membersRes] = await Promise.all([
        nigerianPaymentsApi.getBankAccounts(),
        api.get('/members', { params: { limit: 1000 } }),
      ]);
      
      setBankAccounts(accountsRes || []);
      
      // API returns: { success: true, data: { members: [...], pagination: {...} } }
      const membersList = membersRes.data?.data?.members || [];
      setMembers(membersList);
    } catch (error) {
      console.error('Error loading data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load members and bank accounts',
        color: 'red',
      });
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);

      const data = {
        ...values,
        memberId: values.memberId ? values.memberId : undefined,
        bankAccountId: values.bankAccountId
          ? values.bankAccountId
          : undefined,
        transferDate: values.transferDate.toISOString(),
      };

      const response = await nigerianPaymentsApi.createBankTransfer(data);

      // Upload proof if provided
      if (proofFile && response) {
        try {
          await nigerianPaymentsApi.uploadPaymentProof(proofFile, data.memberId, response.id);
        } catch (proofError) {
          console.error('Error uploading proof:', proofError);
          // Don't fail the whole operation if proof upload fails
        }
      }

      notifications.show({
        title: 'Success',
        message: 'Bank transfer recorded successfully',
        color: 'green',
      });

      router.push('/dashboard/payments/bank-transfers');
    } catch (error: any) {
      console.error('Error recording transfer:', error);
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to record transfer',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const bankAccountOptions = bankAccounts.map((account) => ({
    value: account.id.toString(),
    label: `${account.bankName} - ${account.accountNumber}`,
  }));

  const memberOptions = members.map((member) => ({
    value: member.id.toString(),
    label: `${member.firstName} ${member.lastName} (${member.memberId})`,
  }));

  return (
    <Can permission={PERMISSIONS.PAYMENT_RECORD}>
      <Stack gap="lg">
        <Group>
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Back
          </Button>
        </Group>

        <Card withBorder padding="lg" style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
          <LoadingOverlay visible={loading} />

          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>Record Bank Transfer</Title>
                <Text size="sm" c="dimmed">
                  Record a bank transfer received from a member
                </Text>
              </div>
              <HelpLink />
            </Group>

            <Alert icon={<AlertCircle size={16} />} color="blue">
              Record bank transfers to track payments and reconcile with transactions
            </Alert>

            <form onSubmit={form.onSubmit(handleSubmit)}>
              <Stack gap="md">
                <Select
                  label="Member (Optional)"
                  placeholder="Select member if known"
                  data={memberOptions}
                  searchable
                  clearable
                  {...form.getInputProps('memberId')}
                />

                <Select
                  label="Receiving Bank Account (Optional)"
                  placeholder="Select bank account"
                  data={bankAccountOptions}
                  clearable
                  {...form.getInputProps('bankAccountId')}
                />

                <TextInput
                  label="Sender Bank Name"
                  placeholder="e.g., Access Bank"
                  required
                  {...form.getInputProps('senderBankName')}
                />

                <TextInput
                  label="Sender Account Number"
                  placeholder="10-digit account number"
                  maxLength={10}
                  {...form.getInputProps('senderAccountNumber')}
                />

                <TextInput
                  label="Sender Account Name"
                  placeholder="Account holder name"
                  {...form.getInputProps('senderAccountName')}
                />

                <NumberInput
                  label="Amount"
                  placeholder="Enter amount"
                  required
                  min={0}
                  prefix="₦"
                  thousandSeparator=","
                  decimalScale={2}
                  {...form.getInputProps('amount')}
                />

                <TextInput
                  label="Reference Number"
                  placeholder="Transaction reference"
                  required
                  {...form.getInputProps('reference')}
                />

                <DatePickerInput
                  label="Transfer Date"
                  placeholder="Select date"
                  required
                  {...form.getInputProps('transferDate')}
                />

                <Textarea
                  label="Narration"
                  placeholder="Transaction description"
                  rows={2}
                  {...form.getInputProps('narration')}
                />

                <Textarea
                  label="Notes"
                  placeholder="Internal notes"
                  rows={2}
                  {...form.getInputProps('notes')}
                />

                <FileInput
                  label="Payment Proof (Optional)"
                  placeholder="Upload screenshot or receipt"
                  accept="image/*,application/pdf"
                  leftSection={<Upload size={16} />}
                  value={proofFile}
                  onChange={setProofFile}
                />

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="light"
                    onClick={() => router.back()}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={loading}>
                    Record Transfer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Stack>
    </Can>
  );
}
