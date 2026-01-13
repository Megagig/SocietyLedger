'use client';

import { useState } from 'react';
import {
  Modal,
  Stack,
  Title,
  Text,
  Select,
  Button,
  Group,
  Radio,
  LoadingOverlay,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconDownload } from '@tabler/icons-react';
import { exportsApi } from '@/lib/api/exports';

interface QuickExportModalProps {
  opened: boolean;
  onClose: () => void;
}

export function QuickExportModal({ opened, onClose }: QuickExportModalProps) {
  const [exportType, setExportType] = useState<string | null>('financial_summary');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [period, setPeriod] = useState<string | null>('this_month');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!exportType || !format) return;

    setLoading(true);
    try {
      let result;
      
      if (exportType === 'financial_summary') {
        const params: any = {};
        if (period === 'custom' && startDate && endDate) {
          params.startDate = startDate.toISOString();
          params.endDate = endDate.toISOString();
        } else if (period !== 'custom') {
          params.period = period;
        }

        if (format === 'pdf') {
          result = await exportsApi.exportFinancialPDF(params);
        } else {
          result = await exportsApi.exportFinancialExcel(params);
        }
      } else if (exportType === 'all_members') {
        result = await exportsApi.exportAllMembersExcel();
      }

      // Trigger download
      if (result?.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Quick Export" size="md">
      <LoadingOverlay visible={loading} />
      
      <Stack gap="md">
        <div>
          <Text size="sm" fw={500} mb={4}>
            Export Type
          </Text>
          <Select
            data={[
              { value: 'financial_summary', label: 'Financial Summary' },
              { value: 'all_members', label: 'All Members' },
            ]}
            value={exportType}
            onChange={setExportType}
          />
        </div>

        <div>
          <Text size="sm" fw={500} mb={4}>
            Format
          </Text>
          <Radio.Group value={format} onChange={(value: any) => setFormat(value)}>
            <Group>
              <Radio value="pdf" label="PDF" />
              <Radio value="excel" label="Excel" />
            </Group>
          </Radio.Group>
        </div>

        {exportType === 'financial_summary' && (
          <div>
            <Text size="sm" fw={500} mb={4}>
              Period
            </Text>
            <Select
              data={[
                { value: 'this_month', label: 'This Month' },
                { value: 'last_month', label: 'Last Month' },
                { value: 'this_quarter', label: 'This Quarter' },
                { value: 'this_year', label: 'This Year' },
                { value: 'custom', label: 'Custom Range' },
              ]}
              value={period}
              onChange={setPeriod}
            />

            {period === 'custom' && (
              <DatePickerInput
                type="range"
                label="Custom Date Range"
                placeholder="Pick date range"
                value={[startDate, endDate]}
                onChange={(dates: [Date | null, Date | null]) => {
                  setStartDate(dates[0]);
                  setEndDate(dates[1]);
                }}
                clearable
              />
            )}
          </div>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            leftSection={<IconDownload size={16} />} 
            onClick={handleExport}
            loading={loading}
          >
            Generate Export
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
