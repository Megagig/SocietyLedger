'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Stack,
  Table,
  Badge,
  Button,
  Group,
  TextInput,
  LoadingOverlay,
  Alert,
  Modal,
  Textarea,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getSMSTemplates,
  createSMSTemplate,
  updateSMSTemplate,
  deleteSMSTemplate,
  type SMSTemplate,
} from '@/lib/api/communication';

export default function TemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      content: '',
      category: 'GENERAL',
      placeholders: [] as string[],
    },
    validate: {
      name: (value) => (!value ? 'Template name is required' : null),
      content: (value) =>
        !value
          ? 'Template content is required'
          : value.length > 160
          ? 'Content too long (max 160 characters)'
          : null,
    },
  });

  useEffect(() => {
    loadTemplates();
  }, [page, search]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await getSMSTemplates({
        page,
        limit: 10,
      });
      setTemplates(res.data.templates);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load templates',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template?: SMSTemplate) => {
    if (template) {
      setEditingTemplate(template);
      form.setValues({
        name: template.name,
        content: template.content,
        category: template.category,
        placeholders: template.placeholders || [],
      });
    } else {
      setEditingTemplate(null);
      form.reset();
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);

      if (editingTemplate) {
        await updateSMSTemplate(editingTemplate.id, values);
        notifications.show({
          title: 'Template Updated',
          message: 'The template has been updated',
          color: 'green',
        });
      } else {
        await createSMSTemplate(values);
        notifications.show({
          title: 'Template Created',
          message: 'The template has been created',
          color: 'green',
        });
      }

      setModalOpen(false);
      loadTemplates();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to save template',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Template',
      children: <Text size="sm">Are you sure you want to delete this template?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteSMSTemplate(id);
          notifications.show({
            title: 'Template Deleted',
            message: 'The template has been deleted',
            color: 'green',
          });
          loadTemplates();
        } catch (err: any) {
          notifications.show({
            title: 'Error',
            message: err.message || 'Failed to delete template',
            color: 'red',
          });
        }
      },
    });
  };

  return (
    <Can
      permission={PERMISSIONS.SMS_SEND}
      fallback={<Alert color="red">You don't have permission to manage templates</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>SMS Templates</Title>
            <Text size="sm" c="dimmed">
              Create and manage reusable SMS templates
            </Text>
          </div>
          <Button leftSection={<Plus size={16} />} onClick={() => handleOpenModal()}>
            New Template
          </Button>
        </Group>

        {/* Search */}
        <Card withBorder padding="md">
          <TextInput
            placeholder="Search templates..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Card>

        {/* Templates Table */}
        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          {templates.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No templates found. Create your first template to get started.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Content</Table.Th>
                  <Table.Th>Variables</Table.Th>
                  <Table.Th>Usage</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {templates.map((template) => (
                  <Table.Tr key={template.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {template.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>
                        {template.content}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {template.placeholders && template.placeholders.length > 0 ? (
                        <Group gap="xs">
                          {template.placeholders.map((placeholder: string, index: number) => (
                            <Badge key={index} size="sm" variant="light">
                              {placeholder}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">
                          None
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{template.usageCount || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          size="sm"
                          onClick={() => handleOpenModal(template)}
                        >
                          <Edit size={14} />
                        </ActionIcon>

                        <ActionIcon
                          variant="light"
                          size="sm"
                          color="red"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Pagination */}
        {total > 10 && (
          <Group justify="center">
            <Button
              variant="light"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Text size="sm">
              Page {page} of {Math.ceil(total / 10)}
            </Text>
            <Button
              variant="light"
              disabled={page >= Math.ceil(total / 10)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </Group>
        )}

        {/* Template Modal */}
        <Modal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingTemplate ? 'Edit Template' : 'New Template'}
          size="lg"
        >
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Template Name"
                placeholder="e.g., Welcome Message"
                {...form.getInputProps('name')}
                required
              />

              <Textarea
                label="Content"
                description={`${form.values.content.length}/160 characters. Use {{variable}} for dynamic content.`}
                placeholder="Hello {{name}}, welcome to our association!"
                minRows={4}
                {...form.getInputProps('content')}
                required
              />

              <Alert icon={<AlertCircle size={16} />} color="blue">
                <Text size="sm">
                  Use double curly braces for variables, e.g., {'{{name}}'}, {'{{amount}}'}
                </Text>
              </Alert>

              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={() => setModalOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  {editingTemplate ? 'Update' : 'Create'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Can>
  );
}
