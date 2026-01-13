'use client';

import { useState, useEffect } from 'react';
import { Select } from '@mantine/core';
import nigerianPaymentsApi, { NigerianBank } from '@/lib/api/nigerian-payments';

interface NigerianBanksDropdownProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function NigerianBanksDropdown({ 
  value, 
  onChange, 
  label, 
  error, 
  required = false,
  disabled = false 
}: NigerianBanksDropdownProps) {
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      setLoading(true);
      const data = await nigerianPaymentsApi.getNigerianBanks();
      setBanks(data);
    } catch (err: any) {
      console.error('Failed to load Nigerian banks:', err);
    } finally {
      setLoading(false);
    }
  };

  const bankOptions = banks.map((bank) => ({
    value: bank.code,
    label: `${bank.name} (${bank.code})`,
  }));

  return (
    <Select
      label={label}
      placeholder={loading ? "Loading banks..." : "Select Nigerian bank"}
      data={bankOptions}
      value={value}
      onChange={onChange}
      error={error}
      required={required}
      disabled={disabled || loading}
      searchable
      nothingFoundMessage="No banks found"
      description="Select the bank where this account is held"
    />
  );
}
