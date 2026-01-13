import { Card, Group, Text, Title, Stack, Button, ThemeIcon } from '@mantine/core';
import { IconFileText, IconTable, IconUser, IconChartBar } from '@tabler/icons-react';

interface ExportTypeCardProps {
  type: 'financial_summary' | 'member_statement' | 'all_members';
  title: string;
  description: string;
  icon: 'pdf' | 'excel' | 'members';
  onClick: () => void;
}

export function ExportTypeCard({ type, title, description, icon, onClick }: ExportTypeCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'pdf':
        return <IconFileText size={40} color="#228be6" />;
      case 'excel':
        return <IconTable size={40} color="#40c057" />;
      case 'members':
        return <IconUser size={40} color="#fd7e14" />;
      default:
        return <IconChartBar size={40} />;
    }
  };

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      h="100%"
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <ThemeIcon size={60} radius="md" variant="light">
            {getIcon()}
          </ThemeIcon>
        </Group>

        <div>
          <Title order={4} mb="xs">
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </div>
      </Stack>
    </Card>
  );
}
