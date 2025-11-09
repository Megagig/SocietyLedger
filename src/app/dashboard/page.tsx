import { Container, Title, Text, Paper, Group, Stack } from '@mantine/core';

export default function DashboardPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title size="h1" className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard
          </Title>
          <Text size="lg" className="text-gray-600">
            Welcome to Society Ledger Financial Management System
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Paper p="md" shadow="sm" className="text-center">
            <Text size="xl" fw={700} c="blue">
              150
            </Text>
            <Text size="sm" c="dimmed">
              Total Members
            </Text>
          </Paper>

          <Paper p="md" shadow="sm" className="text-center">
            <Text size="xl" fw={700} c="green">
              $45,230
            </Text>
            <Text size="sm" c="dimmed">
              Total Revenue
            </Text>
          </Paper>

          <Paper p="md" shadow="sm" className="text-center">
            <Text size="xl" fw={700} c="orange">
              23
            </Text>
            <Text size="sm" c="dimmed">
              Pending Payments
            </Text>
          </Paper>

          <Paper p="md" shadow="sm" className="text-center">
            <Text size="xl" fw={700} c="red">
              8
            </Text>
            <Text size="sm" c="dimmed">
              Overdue Payments
            </Text>
          </Paper>
        </div>

        <Paper p="xl" shadow="sm">
          <Title size="h2" className="text-xl font-semibold mb-4">
            Quick Actions
          </Title>
          <Group gap="md">
            <Text>• Member Management</Text>
            <Text>• Financial Tracking</Text>
            <Text>• Generate Reports</Text>
            <Text>• Accounting System</Text>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}