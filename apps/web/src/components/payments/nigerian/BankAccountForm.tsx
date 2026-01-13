'use client';

import { useState } from 'react';
import { TextInput, Select, Switch, Textarea, Button, Stack, Group, Text, Loader } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { BankAccount } from '@/lib/api/nigerian-payments';

interface BankAccountFormProps {
  account?: BankAccount | null;
  onSubmit: (data: Partial<BankAccount>) => void;
  onCancel: () => void;
}

export function BankAccountForm({ account, onSubmit, onCancel }: BankAccountFormProps) {
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState(account?.bankName || '');
  const [accountName, setAccountName] = useState(account?.accountName || '');
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber || '');
  const [bankCode, setBankCode] = useState(account?.bankCode || '');
  const [description, setDescription] = useState(account?.description || '');
  const [isDefault, setIsDefault] = useState(account?.isDefault || false);
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!bankName.trim()) {
      newErrors.bankName = 'Bank name is required';
    }
    if (!accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    }
    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!/^\d{10}$/.test(accountNumber)) {
      newErrors.accountNumber = 'Account number must be 10 digits';
    }
    if (!bankCode.trim()) {
      newErrors.bankCode = 'Bank code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankCode: bankCode.trim(),
        description: description.trim() || undefined,
        isDefault,
        isActive,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Select
          label="Bank Name"
          placeholder="Select bank"
          data={[
            { value: 'Access Bank', label: 'Access Bank' },
            { value: 'Zenith Bank', label: 'Zenith Bank' },
            { value: 'First Bank', label: 'First Bank' },
            { value: 'Guaranty Trust Bank', label: 'Guaranty Trust Bank' },
            { value: 'United Bank for Africa', label: 'United Bank for Africa' },
            { value: 'Union Bank', label: 'Union Bank' },
            { value: 'UBA', label: 'UBA' },
            { value: 'Fidelity Bank', label: 'Fidelity Bank' },
            { value: 'Ecobank', label: 'Ecobank' },
            { value: 'Wema Bank', label: 'Wema Bank' },
            { value: 'Sterling Bank', label: 'Sterling Bank' },
            { value: 'Stanbic IBTC', label: 'Stanbic IBTC' },
            { value: 'Heritage Bank', label: 'Heritage Bank' },
            { value: 'Keystone Bank', label: 'Keystone Bank' },
            { value: 'Polaris Bank', label: 'Polaris Bank' },
            { value: 'Suntrust Bank', label: 'Suntrust Bank' },
            { value: 'Citibank', label: 'Citibank' },
            { value: 'Jaiz Bank', label: 'Jaiz Bank' },
            { value: 'Providus Bank', label: 'Providus Bank' },
            { value: 'Titan Trust Bank', label: 'Titan Trust Bank' },
            { value: 'Globus Bank', label: 'Globus Bank' },
            { value: 'Rand Merchant Bank', label: 'Rand Merchant Bank' },
            { value: 'Parallex Bank', label: 'Parallex Bank' },
            { value: 'Standard Chartered', label: 'Standard Chartered' },
            { value: 'Kuda Bank', label: 'Kuda Bank' },
            { value: 'Carbon', label: 'Carbon' },
            { value: 'FairMoney', label: 'FairMoney' },
            { value: 'Mint', label: 'Mint' },
            { value: 'VBank', label: 'VBank' },
            { value: 'Sparkle', label: 'Sparkle' },
            { value: 'Moniepoint', label: 'Moniepoint' },
            { value: 'OPay', label: 'OPay' },
            { value: 'Paga', label: 'Paga' },
            { value: 'Others', label: 'Others' },
          ]}
          value={bankName}
          onChange={(value) => setBankName(value || '')}
          error={errors.bankName}
          required
          searchable
        />

        <TextInput
          label="Account Name"
          placeholder="e.g., Association Savings Account"
          value={accountName}
          onChange={(e) => setAccountName(e.currentTarget.value)}
          error={errors.accountName}
          required
        />

        <TextInput
          label="Account Number"
          placeholder="e.g., 1234567890"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.currentTarget.value)}
          error={errors.accountNumber}
          required
          maxLength={10}
        />

        <TextInput
          label="Bank Code"
          placeholder="e.g., 044"
          value={bankCode}
          onChange={(e) => setBankCode(e.currentTarget.value)}
          error={errors.bankCode}
          required
          maxLength={3}
          description="3-digit bank code (e.g., 044 for Access Bank)"
        />

        <Textarea
          label="Description"
          placeholder="Optional description for this bank account"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
          maxRows={4}
        />

        <Group justify="space-between">
          <Switch
            label="Default Account"
            description="Set this as the default bank account for payments"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.currentTarget.checked)}
          />

          <Switch
            label="Active"
            description="Enable this bank account"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        </Group>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={loading}
            leftSection={loading ? null : <IconCheck size={18} />}
          >
            {account ? 'Update Account' : 'Create Account'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
