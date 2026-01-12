'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Group,
  Button,
  Card,
  Table,
  Badge,
  TextInput,
  Pagination,
  ActionIcon,
  Menu,
  Skeleton,
  Text,
} from '@mantine/core';
import { IconPlus, IconDots, IconRefresh, IconEdit, IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { smsApi, SMSTemplate, CreateTemplateRequest } from '@/lib/api/sms';
import { TemplateCategory } from '@/components/communications/TemplateCategory';
import { TemplateEditor } from '@/components/communications/TemplateEditor';

export default function TemplatesListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const { data: templatesData, isLoading, refetch } = useQuery({
    queryKey: ['sms-templates', page, selectedCategory, searchQuery],
    queryFn: () =>
      smsApi.getTemplates({
        page,
        limit: 20,
        category: selectedCategory || undefined,
      }),
  });

  const templates = templatesData?.templates || [];
  const totalPages = templatesData?.totalPages || 1;

  // Calculate category counts
  const categoryCounts = templates.reduce((acc: Record<string, number>, template: SMSTemplate) => {
    acc[template.category] = (acc[template.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categories = Object.keys(categoryCounts);

  const handleRefresh = () => {
    refetch();
  };

  const handleEdit = (template: SMSTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await smsApi.deleteTemplate(id);
      notifications.show({
        title: 'Template Deleted',
        message: 'Template has been deleted successfully',
        color: 'green',
      });
      refetch();
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete Template',
        message: 'An error occurred while deleting template',
        color: 'red',
      });
    }
  };

  const handleSaveTemplate = async (template: { name: string; category: string; message: string }) => {
    if (editingTemplate) {
      // Update existing template
      try {
        await smsApi.updateTemplate(editingTemplate.id, template);
        notifications.show({
          title: 'Template Updated',
          message: 'Template has been updated successfully',
          color: 'green',
        });
        queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      } catch (error) {
        notifications.show({
          title: 'Failed to Update Template',
          message: 'An error occurred while updating template',
          color: 'red',
        });
      }
    } else {
      // Create new template
      try {
        await smsApi.createTemplate(template);
        notifications.show({
          title: 'Template Created',
          message: 'Template has been created successfully',
          color: 'green',
        });
        queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      } catch (error) {
        notifications.show({
          title: 'Failed to Create Template',
          message: 'An error occurred while creating template',
          color: 'red',
        });
      }
    }

    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const rows = templates.map((template: SMSTemplate) => (
    <Table.Tr key={template.id}>
      <Table.Td>{template.name}</Table.Td>
      <Table.Td>
        <Badge variant="light" color="blue">
          {template.category}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={2} title={template.message}>
          {template.message}
        </Text>
      </Table.Td>
      <Table.Td>{template.usageCount}</Table.Td>
      <Table.Td>{new Date(template.createdAt).toLocaleDateString()}</Table.Td>
      <Table.Td>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconEdit size={16} />}
              onClick={() => handleEdit(template)}
            >
              Edit
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => handleDelete(template.id)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  ));

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Card padding="lg" withBorder>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={60} mb="sm" />
            ))}
          </Card>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>SMS Templates</Title>
            <Text c="dimmed">Create and manage reusable message templates</Text>
          </div>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={handleCreate}
            size="lg"
          >
            Create Template
          </Button>
        </Group>

        {/* Template Editor Modal */}
        {showEditor && (
          <Card padding="xl" radius="md" withBorder>
            <TemplateEditor
              template={editingTemplate || undefined}
              onSave={handleSaveTemplate}
              onCancel={handleCancelEditor}
            />
          </Card>
        )}

        {!showEditor && (
          <>
            {/* Filters */}
            <Card padding="md" withBorder>
              <Group>
                <TextInput
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <ActionIcon onClick={handleRefresh} variant="subtle">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Group>

              <TemplateCategory
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                categoryCounts={categoryCounts}
              />
            </Card>

            {/* Templates Table */}
            {templates.length === 0 ? (
              <Card padding="xl" withBorder>
                <Stack align="center" gap="md">
                  <Text size="lg" c="dimmed">
                    No templates found
                  </Text>
                  <Button
                    variant="light"
                    onClick={handleCreate}
                  >
                    Create Your First Template
                  </Button>
                </Stack>
              </Card>
            ) : (
              <Card padding={0} withBorder>
                <Table.ScrollContainer minWidth={800}>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Template Name</Table.Th>
                        <Table.Th>Category</Table.Th>
                        <Table.Th>Message</Table.Th>
                        <Table.Th>Usage</Table.Th>
                        <Table.Th>Created</Table.Th>
                        <Table.Th style={{ width: 50 }} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rows}</Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Group justify="center">
                <Pagination
                  total={totalPages}
                  value={page}
                  onChange={setPage}
                />
              </Group>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
