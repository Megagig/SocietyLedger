'use client';

import { Group, TextInput, Select, Button } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;

  filters?: {
    key: string;
    label: string;
    options: FilterOption[];
    value: string | null;
    onChange: (v: string | null) => void;
  }[];

  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  onReset,
  hasActiveFilters,
}: FilterBarProps) {
  return (
    <Group mb="md" gap="sm" wrap="wrap">
      {onSearchChange && (
        <TextInput
          placeholder={searchPlaceholder}
          value={search ?? ''}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          style={{ flex: '1 1 200px', minWidth: 160, maxWidth: 320 }}
          size="sm"
        />
      )}

      {filters?.map((f) => (
        <Select
          key={f.key}
          placeholder={f.label}
          data={f.options}
          value={f.value}
          onChange={f.onChange}
          clearable
          size="sm"
          style={{ minWidth: 140 }}
        />
      ))}

      {hasActiveFilters && onReset && (
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconX size={14} />}
          onClick={onReset}
        >
          Clear
        </Button>
      )}
    </Group>
  );
}
