'use client';

import { useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Tabs,
  TextInput,
  MultiSelect,
  Button,
  Text,
  Badge,
  Group,
  ActionIcon,
  ScrollArea,
  Checkbox,
  Box,
} from '@mantine/core';
import { IconX, IconSearch, IconUser, IconUsers, IconPhone } from '@tabler/icons-react';
import { MEMBER_CATEGORIES, MEMBER_STATUS } from '@/utils/constants';

interface Recipient {
  id: string;
  type: 'member' | 'phone';
  value: string | number;
  label: string;
}

interface RecipientSelectorProps {
  members?: Array<{ id: number; name: string; phone: string; category: string; status: string }>;
  selectedRecipients: Recipient[];
  onRecipientsChange: (recipients: Recipient[]) => void;
  maxRecipients?: number;
}

export function RecipientSelector({
  members = [],
  selectedRecipients,
  onRecipientsChange,
  maxRecipients = 500,
}: RecipientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [customPhone, setCustomPhone] = useState('');

  const categoryOptions = Object.values(MEMBER_CATEGORIES);
  const statusOptions = Object.values(MEMBER_STATUS);

  // Filter members based on search, category, and status
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery);

    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(member.category);

    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(member.status);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleAddMember = (member: { id: number; name: string; phone: string }) => {
    if (selectedRecipients.length >= maxRecipients) {
      return;
    }

    const newRecipient: Recipient = {
      id: `member-${member.id}`,
      type: 'member',
      value: member.id,
      label: member.name,
    };

    if (!selectedRecipients.find((r) => r.id === newRecipient.id)) {
      onRecipientsChange([...selectedRecipients, newRecipient]);
    }
  };

  const handleAddCustomPhone = () => {
    if (!customPhone.trim()) return;

    // Validate Nigerian phone number format
    const phoneRegex = /^(\+234|0)?[789][01]\d{8}$/;
    if (!phoneRegex.test(customPhone.replace(/\s/g, ''))) {
      return;
    }

    const newRecipient: Recipient = {
      id: `phone-${Date.now()}`,
      type: 'phone',
      value: customPhone.trim(),
      label: customPhone.trim(),
    };

    if (!selectedRecipients.find((r) => r.value === newRecipient.value)) {
      onRecipientsChange([...selectedRecipients, newRecipient]);
    }

    setCustomPhone('');
  };

  const handleRemoveRecipient = (id: string) => {
    onRecipientsChange(selectedRecipients.filter((r) => r.id !== id));
  };

  const handleSelectAllFiltered = () => {
    const newRecipients = filteredMembers
      .filter((member) => !selectedRecipients.find((r) => r.value === member.id))
      .map((member) => ({
        id: `member-${member.id}`,
        type: 'member' as const,
        value: member.id,
        label: member.name,
      }));

    onRecipientsChange([...selectedRecipients, ...newRecipients]);
  };

  return (
    <Stack gap="md">
      {/* Selected Recipients */}
      <Card padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4}>Selected Recipients</Title>
          <Badge color="blue" variant="light">
            {selectedRecipients.length} / {maxRecipients}
          </Badge>
        </Group>

        {selectedRecipients.length === 0 ? (
          <Text c="dimmed" size="sm" py="md">
            No recipients selected. Add members or custom phone numbers below.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={200}>
            <Stack gap="xs">
              {selectedRecipients.map((recipient) => (
                <Group key={recipient.id} justify="space-between" p="xs" bg="gray.0" style={{ borderRadius: 4 }}>
                  <Group gap="xs">
                    {recipient.type === 'member' ? (
                      <IconUser size={16} color="gray" />
                    ) : (
                      <IconPhone size={16} color="gray" />
                    )}
                    <Text size="sm">{recipient.label}</Text>
                  </Group>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveRecipient(recipient.id)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Card>

      {/* Recipient Selection */}
      <Card padding="md" radius="md" withBorder>
        <Title order={4} mb="md">Add Recipients</Title>
        <Tabs defaultValue="members">
          <Tabs.List>
            <Tabs.Tab value="members" leftSection={<IconUsers size={16} />}>
              Members
            </Tabs.Tab>
            <Tabs.Tab value="custom" leftSection={<IconPhone size={16} />}>
              Custom Numbers
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="members" pt="md">
            <Stack gap="md">
              <TextInput
                placeholder="Search members..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />

              <Group>
                <MultiSelect
                  label="Filter by Category"
                  placeholder="All categories"
                  data={categoryOptions.map((cat) => ({
                    value: cat,
                    label: cat.charAt(0).toUpperCase() + cat.slice(1),
                  }))}
                  value={selectedCategories}
                  onChange={setSelectedCategories}
                  clearable
                  style={{ flex: 1 }}
                />
                <MultiSelect
                  label="Filter by Status"
                  placeholder="All statuses"
                  data={statusOptions.map((status) => ({
                    value: status,
                    label: status.charAt(0).toUpperCase() + status.slice(1),
                  }))}
                  value={selectedStatuses}
                  onChange={setSelectedStatuses}
                  clearable
                  style={{ flex: 1 }}
                />
              </Group>

              {filteredMembers.length > 0 && (
                <Button
                  variant="light"
                  onClick={handleSelectAllFiltered}
                  disabled={selectedRecipients.length >= maxRecipients}
                >
                  Select All ({filteredMembers.length})
                </Button>
              )}

              <ScrollArea.Autosize mah={300}>
                <Stack gap="xs">
                  {filteredMembers.length === 0 ? (
                    <Text c="dimmed" size="sm" py="md">
                      No members found matching your filters.
                    </Text>
                  ) : (
                    filteredMembers.map((member) => {
                      const isSelected = selectedRecipients.find(
                        (r) => r.value === member.id
                      );
                      return (
                        <Box
                          key={member.id}
                          p="sm"
                          bg={isSelected ? 'blue.0' : 'gray.0'}
                          style={{ borderRadius: 4, cursor: 'pointer' }}
                          onClick={() => handleAddMember(member)}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Checkbox
                                checked={!!isSelected}
                                readOnly
                                size="sm"
                              />
                              <Box>
                                <Text size="sm" fw={500}>
                                  {member.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {member.phone}
                                </Text>
                              </Box>
                            </Group>
                            <Badge size="xs" variant="light">
                              {member.category}
                            </Badge>
                          </Group>
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="custom" pt="md">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Add custom phone numbers (Nigerian format: 08012345678 or +2348012345678)
              </Text>
              <Group>
                <TextInput
                  placeholder="Enter phone number"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <Button onClick={handleAddCustomPhone}>Add</Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Stack>
  );
}
