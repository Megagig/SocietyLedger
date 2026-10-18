'use client';

import { Table, ScrollArea, Text, Skeleton, Stack } from '@mantine/core';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: number | string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, rowKey, loading, emptyMessage }: DataTableProps<T>) {
  if (loading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={40} radius="sm" />
        ))}
      </Stack>
    );
  }

  return (
    <ScrollArea>
      <Table
        style={{
          '--table-hover-color': 'var(--admin-row-hover)',
          '--table-border-color': 'var(--admin-border)',
        } as React.CSSProperties}
        highlightOnHover
        withTableBorder
        withColumnBorders={false}
        fz="sm"
      >
        <Table.Thead>
          <Table.Tr style={{ backgroundColor: 'var(--admin-surface)' }}>
            {columns.map((col) => (
              <Table.Th
                key={col.key}
                style={{ width: col.width, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mantine-color-dimmed)' }}
              >
                {col.header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                <Text c="dimmed" size="sm">{emptyMessage ?? 'No results'}</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <Table.Tr key={rowKey(row)}>
                {columns.map((col) => (
                  <Table.Td key={col.key}>{col.render(row)}</Table.Td>
                ))}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
