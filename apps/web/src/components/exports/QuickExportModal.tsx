'use client';

import { useState, useEffect } from 'react';
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
import { membersApi, Member } from '@/lib/api/members';

interface QuickExportModalProps {
  opened: boolean;
  onClose: () => void;
  initialExportType?: string;
}

export function QuickExportModal({ opened, onClose, initialExportType }: QuickExportModalProps) {
  const [exportType, setExportType] = useState<string | null>(initialExportType || 'financial_summary');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [period, setPeriod] = useState<string | null>('this_month');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load members when modal opens and member_statement is selected
  useEffect(() => {
    if (opened && exportType === 'member_statement') {
      loadMembers();
    }
  }, [opened, exportType]);

  // Update export type when initialExportType changes
  useEffect(() => {
    if (initialExportType) {
      setExportType(initialExportType);
    }
  }, [initialExportType]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const response = await membersApi.getMembers({ limit: 1000, status: 'active' });
      setMembers(response.members);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleExport = async () => {
    if (!exportType || !format) return;

    // Validate member selection for member statement
    if (exportType === 'member_statement' && !selectedMemberId) {
      return;
    }

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
      } else if (exportType === 'member_statement') {
        const params: any = {};
        if (period === 'custom' && startDate && endDate) {
          params.startDate = startDate.toISOString();
          params.endDate = endDate.toISOString();
        }
        
        result = await exportsApi.exportMemberStatementPDF(parseInt(selectedMemberId!), params);
      }

      // Trigger download using the export ID
      if (result?.data?.id) {
        const downloadUrl = exportsApi.getDownloadUrl(result.data.id);
        window.open(downloadUrl, '_blank');
      } else if (result?.downloadUrl) {
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
              { value: 'member_statement', label: 'Member Statement' },
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
              {exportType !== 'member_statement' && <Radio value="excel" label="Excel" />}
            </Group>
          </Radio.Group>
        </div>

        {exportType === 'member_statement' && (
          <div>
            <Text size="sm" fw={500} mb={4}>
              Select Member
            </Text>
            <Select
              data={members.map(member => ({
                value: member.id.toString(),
                label: `${member.firstName} ${member.lastName} (${member.memberId})`
              }))}
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              placeholder={loadingMembers ? "Loading members..." : "Choose a member..."}
              searchable
              disabled={loadingMembers}
            />
          </div>
        )}

        {(exportType === 'financial_summary' || exportType === 'member_statement') && (
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
            disabled={exportType === 'member_statement' && !selectedMemberId}
          >
            Generate Export
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
