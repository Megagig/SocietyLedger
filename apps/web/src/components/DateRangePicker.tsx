'use client';

import { useState } from 'react';
import { Select, Button, Group, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';

export type PeriodOption = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';

interface DateRangePickerProps {
  value: {
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  };
  onChange: (value: { period: PeriodOption; startDate?: Date; endDate?: Date }) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [showCustomDates, setShowCustomDates] = useState(value.period === 'custom');

  const periodOptions = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'last_quarter', label: 'Last Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'last_year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const handlePeriodChange = (period: string | null) => {
    if (!period) return;
    
    const isCustom = period === 'custom';
    setShowCustomDates(isCustom);
    
    onChange({
      period: period as PeriodOption,
      startDate: isCustom ? value.startDate : undefined,
      endDate: isCustom ? value.endDate : undefined,
    });
  };

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    onChange({
      period: 'custom',
      startDate: dates[0] || undefined,
      endDate: dates[1] || undefined,
    });
  };

  return (
    <Stack gap="sm">
      <Select
        label="Period"
        placeholder="Select period"
        data={periodOptions}
        value={value.period}
        onChange={handlePeriodChange}
        leftSection={<IconCalendar size={16} />}
      />

      {showCustomDates && (
        <DatePickerInput
          type="range"
          label="Custom Date Range"
          placeholder="Pick dates range"
          value={[value.startDate || null, value.endDate || null]}
          onChange={handleDateChange}
          clearable
        />
      )}
    </Stack>
  );
}
