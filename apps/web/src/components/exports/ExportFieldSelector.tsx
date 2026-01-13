import { useState } from 'react';
import { Stack, Checkbox, Text, Group, Button, Title } from '@mantine/core';

interface FieldGroup {
  name: string;
  fields: Field[];
}

interface Field {
  id: string;
  label: string;
  defaultSelected: boolean;
}

interface ExportFieldSelectorProps {
  fieldGroups?: FieldGroup[];
  selectedFields: string[];
  onChange: (fields: string[]) => void;
  reportType?: string;
}

const DEFAULT_FIELD_GROUPS: Record<string, FieldGroup[]> = {
  members: [
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
        { id: 'email', label: 'Email', defaultSelected: true },
        { id: 'phone', label: 'Phone', defaultSelected: false },
        { id: 'address', label: 'Address', defaultSelected: false },
        { id: 'category', label: 'Category', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
        { id: 'joinDate', label: 'Join Date', defaultSelected: false },
      ],
    },
    {
      name: 'Financial Information',
      fields: [
        { id: 'totalDues', label: 'Total Dues', defaultSelected: true },
        { id: 'totalPaid', label: 'Total Paid', defaultSelected: true },
        { id: 'balance', label: 'Balance', defaultSelected: true },
        { id: 'lastPaymentDate', label: 'Last Payment Date', defaultSelected: false },
        { id: 'paymentMethod', label: 'Payment Method', defaultSelected: false },
      ],
    },
    {
      name: 'Contact Information',
      fields: [
        { id: 'emergencyContact', label: 'Emergency Contact', defaultSelected: false },
        { id: 'emergencyPhone', label: 'Emergency Phone', defaultSelected: false },
      ],
    },
  ],
  transactions: [
    {
      name: 'Transaction Details',
      fields: [
        { id: 'transactionId', label: 'Transaction ID', defaultSelected: true },
        { id: 'amount', label: 'Amount', defaultSelected: true },
        { id: 'dueDate', label: 'Due Date', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
        { id: 'createdAt', label: 'Created Date', defaultSelected: false },
        { id: 'description', label: 'Description', defaultSelected: false },
      ],
    },
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
        { id: 'email', label: 'Email', defaultSelected: false },
      ],
    },
    {
      name: 'Category Information',
      fields: [
        { id: 'categoryName', label: 'Category Name', defaultSelected: true },
        { id: 'categoryType', label: 'Category Type', defaultSelected: true },
        { id: 'frequency', label: 'Frequency', defaultSelected: false },
      ],
    },
  ],
  payments: [
    {
      name: 'Payment Details',
      fields: [
        { id: 'paymentId', label: 'Payment ID', defaultSelected: true },
        { id: 'amount', label: 'Amount', defaultSelected: true },
        { id: 'paymentMethod', label: 'Payment Method', defaultSelected: true },
        { id: 'paymentDate', label: 'Payment Date', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
        { id: 'reference', label: 'Reference', defaultSelected: false },
      ],
    },
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
        { id: 'email', label: 'Email', defaultSelected: false },
      ],
    },
  ],
  welfare: [
    {
      name: 'Welfare Details',
      fields: [
        { id: 'fundName', label: 'Fund Name', defaultSelected: true },
        { id: 'contributionAmount', label: 'Contribution Amount', defaultSelected: true },
        { id: 'payoutAmount', label: 'Payout Amount', defaultSelected: true },
        { id: 'date', label: 'Date', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
        { id: 'reason', label: 'Reason', defaultSelected: false },
      ],
    },
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
      ],
    },
  ],
  donations: [
    {
      name: 'Donation Details',
      fields: [
        { id: 'categoryName', label: 'Category Name', defaultSelected: true },
        { id: 'amount', label: 'Amount', defaultSelected: true },
        { id: 'donationDate', label: 'Donation Date', defaultSelected: true },
        { id: 'allocationName', label: 'Allocation', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
      ],
    },
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
      ],
    },
  ],
  levies: [
    {
      name: 'Levy Details',
      fields: [
        { id: 'categoryName', label: 'Category Name', defaultSelected: true },
        { id: 'amount', label: 'Amount', defaultSelected: true },
        { id: 'dueDate', label: 'Due Date', defaultSelected: true },
        { id: 'campaignName', label: 'Campaign Name', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
      ],
    },
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
      ],
    },
  ],
  penalties: [
    {
      name: 'Penalty Details',
      fields: [
        { id: 'penaltyType', label: 'Penalty Type', defaultSelected: true },
        { id: 'amount', label: 'Amount', defaultSelected: true },
        { id: 'appliedDate', label: 'Applied Date', defaultSelected: true },
        { id: 'reason', label: 'Reason', defaultSelected: true },
        { id: 'status', label: 'Status', defaultSelected: true },
      ],
    },
    {
      name: 'Member Information',
      fields: [
        { id: 'memberNumber', label: 'Member Number', defaultSelected: true },
        { id: 'firstName', label: 'First Name', defaultSelected: true },
        { id: 'lastName', label: 'Last Name', defaultSelected: true },
      ],
    },
  ],
  accounting: [
    {
      name: 'Accounting Entry Details',
      fields: [
        { id: 'entryId', label: 'Entry ID', defaultSelected: true },
        { id: 'entryType', label: 'Entry Type', defaultSelected: true },
        { id: 'category', label: 'Category', defaultSelected: true },
        { id: 'subcategory', label: 'Subcategory', defaultSelected: false },
        { id: 'amount', label: 'Amount', defaultSelected: true },
        { id: 'description', label: 'Description', defaultSelected: true },
        { id: 'date', label: 'Date', defaultSelected: true },
        { id: 'reference', label: 'Reference', defaultSelected: false },
      ],
    },
  ],
};

export function ExportFieldSelector({
  fieldGroups,
  selectedFields,
  onChange,
  reportType = 'members',
}: ExportFieldSelectorProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedFields);
  
  const currentFieldGroups = fieldGroups || DEFAULT_FIELD_GROUPS[reportType] || DEFAULT_FIELD_GROUPS.members;

  const handleFieldToggle = (fieldId: string) => {
    const newSelection = localSelected.includes(fieldId)
      ? localSelected.filter(id => id !== fieldId)
      : [...localSelected, fieldId];
    setLocalSelected(newSelection);
    onChange(newSelection);
  };

  const handleGroupToggle = (fields: Field[]) => {
    const allSelected = fields.every(field => localSelected.includes(field.id));
    const newSelection = allSelected
      ? localSelected.filter(id => !fields.some(f => f.id === id))
      : [...new Set([...localSelected, ...fields.map(f => f.id)])];
    setLocalSelected(newSelection);
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    const allFields = currentFieldGroups.flatMap(group => group.fields.map(f => f.id));
    setLocalSelected(allFields);
    onChange(allFields);
  };

  const handleDeselectAll = () => {
    setLocalSelected([]);
    onChange([]);
  };

  const isGroupFullySelected = (fields: Field[]) => {
    return fields.every(field => localSelected.includes(field.id));
  };

  const isGroupPartiallySelected = (fields: Field[]) => {
    return fields.some(field => localSelected.includes(field.id)) && !isGroupFullySelected(fields);
  };

  const selectedCount = localSelected.length;
  const totalCount = currentFieldGroups.reduce((sum, group) => sum + group.fields.length, 0);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={5}>Select Export Fields</Title>
        <Group gap="xs">
          <Button variant="light" size="xs" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="light" size="xs" onClick={handleDeselectAll}>
            Deselect All
          </Button>
        </Group>
      </Group>

      <Text size="sm" c="dimmed">
        {selectedCount} of {totalCount} fields selected
      </Text>

      {currentFieldGroups.map((group, groupIndex) => (
        <Stack key={groupIndex} gap="sm" p="md" style={{ border: '1px solid #e9ecef', borderRadius: '8px' }}>
          <Group gap="sm" align="center">
            <Checkbox
              checked={isGroupFullySelected(group.fields)}
              indeterminate={isGroupPartiallySelected(group.fields)}
              onChange={() => handleGroupToggle(group.fields)}
              label={group.name}
            />
            <Text size="sm" c="dimmed">
              ({group.fields.filter(f => localSelected.includes(f.id)).length}/{group.fields.length})
            </Text>
          </Group>

          <Stack gap="xs" ml={28}>
            {group.fields.map(field => (
              <Checkbox
                key={field.id}
                label={field.label}
                checked={localSelected.includes(field.id)}
                onChange={() => handleFieldToggle(field.id)}
              />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
