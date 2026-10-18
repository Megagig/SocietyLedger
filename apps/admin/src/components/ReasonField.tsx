'use client';

import { Textarea } from '@mantine/core';

interface ReasonFieldProps {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  label?: string;
}

export function ReasonField({ value, onChange, required = true, label = 'Reason' }: ReasonFieldProps) {
  return (
    <Textarea
      label={label}
      placeholder="Provide a reason for this action…"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      required={required}
      minRows={2}
      autosize
      maxRows={5}
      size="sm"
    />
  );
}
