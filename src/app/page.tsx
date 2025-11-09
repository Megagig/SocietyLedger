import { Container, Title, Text, Button, Group, Stack } from '@mantine/core';
import { IconLogin, IconUserPlus } from '@tabler/icons-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Container size="md" className="min-h-screen flex items-center justify-center">
      <Stack align="center" gap="xl">
        <div className="text-center">
          <Title size="h1" className="text-6xl font-bold text-gray-900 mb-4">
            Society Ledger
          </Title>
          <Text size="xl" className="text-gray-600 mb-8 max-w-2xl">
            A comprehensive solution for managing financial activities of associations. 
            Track dues, levies, donations, penalties, and generate professional reports.
          </Text>
        </div>

        <Group gap="lg">
          <Button 
            component={Link}
            href="/auth/login"
            size="lg"
            leftSection={<IconLogin size="1.2rem" />}
            variant="filled"
          >
            Login
          </Button>
          <Button 
            component={Link}
            href="/auth/register"
            size="lg"
            leftSection={<IconUserPlus size="1.2rem" />}
            variant="outline"
          >
            Register
          </Button>
        </Group>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <Title size="h3" className="text-xl mb-3 text-gray-800">
              Member Management
            </Title>
            <Text className="text-gray-600">
              Efficiently manage member profiles, track membership status, and handle bulk operations.
            </Text>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <Title size="h3" className="text-xl mb-3 text-gray-800">
              Financial Tracking
            </Title>
            <Text className="text-gray-600">
              Track dues, levies, donations, penalties with automated calculations and reminders.
            </Text>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <Title size="h3" className="text-xl mb-3 text-gray-800">
              Professional Reports
            </Title>
            <Text className="text-gray-600">
              Generate comprehensive financial reports and export to PDF or Excel formats.
            </Text>
          </div>
        </div>
      </Stack>
    </Container>
  );
}