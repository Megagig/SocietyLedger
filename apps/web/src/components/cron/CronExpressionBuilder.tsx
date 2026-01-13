import {
  Stack,
  Text,
  Group,
  Select,
  NumberInput,
  Button,
  Card,
  SimpleGrid,
  Alert,
  Badge,
  Code,
} from '@mantine/core';
import { 
  IconClock, 
  IconCalendar,
  IconRefresh,
  IconInfoCircle
} from '@tabler/icons-react';
import { useState } from 'react';

interface CronExpressionBuilderProps {
  value: string;
  onChange: (expression: string) => void;
  onTest?: () => void;
}

export function CronExpressionBuilder({ value, onChange, onTest }: CronExpressionBuilderProps) {
  const [preset, setPreset] = useState<string>('');
  const [customMinute, setCustomMinute] = useState('*');
  const [customHour, setCustomHour] = useState('*');
  const [customDay, setCustomDay] = useState('*');
  const [customMonth, setCustomMonth] = useState('*');
  const [customWeekday, setCustomWeekday] = useState('*');

  const presets = [
    { value: '0 * * * *', label: 'Hourly (every hour)' },
    { value: '0 0 * * *', label: 'Daily (at midnight)' },
    { value: '0 9 * * *', label: 'Daily (at 9 AM)' },
    { value: '0 0 * * 0', label: 'Weekly (Sunday midnight)' },
    { value: '0 0 1 * *', label: 'Monthly (1st of month)' },
    { value: '0 0,12 * * *', label: 'Twice daily (midnight & noon)' },
    { value: '0 */6 * * *', label: 'Every 6 hours' },
    { value: '0 0 * * 1-5', label: 'Weekdays (midnight)' },
  ];

  const handlePresetChange = (presetValue: string | null) => {
    if (presetValue) {
      setPreset(presetValue);
      onChange(presetValue);
      
      // Parse preset to set custom fields
      const parts = presetValue.split(' ');
      if (parts.length === 5) {
        setCustomMinute(parts[0]);
        setCustomHour(parts[1]);
        setCustomDay(parts[2]);
        setCustomMonth(parts[3]);
        setCustomWeekday(parts[4]);
      }
    }
  };

  const handleCustomChange = () => {
    const expression = `${customMinute} ${customHour} ${customDay} ${customMonth} ${customWeekday}`;
    onChange(expression);
    setPreset('');
  };

  const getNextRuns = (expression: string, count: number = 3): string[] => {
    // Simplified next run calculation for preview
    const now = new Date();
    const runs: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const nextRun = new Date(now.getTime() + (i + 1) * 3600000); // Just add hours for demo
      runs.push(nextRun.toLocaleString());
    }
    
    return runs;
  };

  const getExpressionDescription = (expr: string): string => {
    const parts = expr.split(' ');
    if (parts.length !== 5) return 'Invalid expression';
    
    const [min, hour, day, month, weekday] = parts;
    
    if (min === '0' && hour === '0' && day === '*' && month === '*' && weekday === '*') {
      return 'Runs daily at midnight';
    }
    if (min === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
      return 'Runs every hour on the hour';
    }
    if (min === '0' && hour === '9' && day === '*' && month === '*' && weekday === '*') {
      return 'Runs daily at 9:00 AM';
    }
    
    return `Custom schedule: ${expr}`;
  };

  const nextRuns = getNextRuns(value);

  return (
    <Stack gap="md">
      {/* Presets */}
      <Card withBorder p="md" bg="var(--mantine-color-dark-6)">
        <Stack gap="sm">
          <Text size="sm" fw={600} c="var(--mantine-color-gray-1)">
            Quick Presets
          </Text>
          <Select
            placeholder="Select a preset schedule"
            data={presets}
            value={preset}
            onChange={handlePresetChange}
            clearable
            styles={{
              input: {
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderColor: 'var(--mantine-color-dark-4)',
                color: 'var(--mantine-color-gray-1)',
                '&::placeholder': {
                  color: 'var(--mantine-color-gray-5)',
                },
              },
            }}
          />
        </Stack>
      </Card>

      {/* Custom Builder */}
      <Card withBorder p="md" bg="var(--mantine-color-dark-6)">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600} c="var(--mantine-color-gray-1)">
              Custom Schedule
            </Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={handleCustomChange}
              styles={{
                root: {
                  backgroundColor: 'var(--mantine-color-dark-5)',
                  borderColor: 'var(--mantine-color-dark-4)',
                  color: 'var(--mantine-color-gray-1)',
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-dark-4)',
                  },
                },
              }}
            >
              Apply
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }}>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Minute (0-59)</Text>
              <NumberInput
                placeholder="*"
                value={customMinute === '*' ? undefined : parseInt(customMinute)}
                onChange={(val) => setCustomMinute(val === undefined ? '*' : val.toString())}
                min={0}
                max={59}
                size="sm"
                styles={{
                  input: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderColor: 'var(--mantine-color-dark-4)',
                    color: 'var(--mantine-color-gray-1)',
                    '&::placeholder': {
                      color: 'var(--mantine-color-gray-5)',
                    },
                  },
                }}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Hour (0-23)</Text>
              <NumberInput
                placeholder="*"
                value={customHour === '*' ? undefined : parseInt(customHour)}
                onChange={(val) => setCustomHour(val === undefined ? '*' : val.toString())}
                min={0}
                max={23}
                size="sm"
                styles={{
                  input: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderColor: 'var(--mantine-color-dark-4)',
                    color: 'var(--mantine-color-gray-1)',
                    '&::placeholder': {
                      color: 'var(--mantine-color-gray-5)',
                    },
                  },
                }}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Day (1-31)</Text>
              <NumberInput
                placeholder="*"
                value={customDay === '*' ? undefined : parseInt(customDay)}
                onChange={(val) => setCustomDay(val === undefined ? '*' : val.toString())}
                min={1}
                max={31}
                size="sm"
                styles={{
                  input: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderColor: 'var(--mantine-color-dark-4)',
                    color: 'var(--mantine-color-gray-1)',
                    '&::placeholder': {
                      color: 'var(--mantine-color-gray-5)',
                    },
                  },
                }}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Month (1-12)</Text>
              <NumberInput
                placeholder="*"
                value={customMonth === '*' ? undefined : parseInt(customMonth)}
                onChange={(val) => setCustomMonth(val === undefined ? '*' : val.toString())}
                min={1}
                max={12}
                size="sm"
                styles={{
                  input: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderColor: 'var(--mantine-color-dark-4)',
                    color: 'var(--mantine-color-gray-1)',
                    '&::placeholder': {
                      color: 'var(--mantine-color-gray-5)',
                    },
                  },
                }}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Weekday (0-6)</Text>
              <NumberInput
                placeholder="*"
                value={customWeekday === '*' ? undefined : parseInt(customWeekday)}
                onChange={(val) => setCustomWeekday(val === undefined ? '*' : val.toString())}
                min={0}
                max={6}
                size="sm"
                styles={{
                  input: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderColor: 'var(--mantine-color-dark-4)',
                    color: 'var(--mantine-color-gray-1)',
                    '&::placeholder': {
                      color: 'var(--mantine-color-gray-5)',
                    },
                  },
                }}
              />
            </Stack>
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Expression Preview */}
      <Card withBorder p="md" bg="var(--mantine-color-dark-6)">
        <Stack gap="sm">
          <Group gap="xs">
            <IconClock size={18} className="text-blue-400" />
            <Text size="sm" fw={600} c="var(--mantine-color-gray-1)">
              Cron Expression
            </Text>
          </Group>
          <div 
            style={{
              padding: 'var(--mantine-spacing-sm)',
              backgroundColor: 'var(--mantine-color-dark-8)',
              border: '1px solid var(--mantine-color-dark-4)',
              borderRadius: 'var(--mantine-radius-sm)',
              fontFamily: 'monospace',
              fontSize: 'var(--mantine-font-size-sm)',
              color: 'var(--mantine-color-gray-1)',
            }}
          >
            {value}
          </div>
          <Text size="xs" c="var(--mantine-color-gray-4)">
            {getExpressionDescription(value)}
          </Text>
        </Stack>
      </Card>

      {/* Next Runs Preview */}
      <Card withBorder p="md" bg="var(--mantine-color-dark-6)">
        <Stack gap="sm">
          <Group gap="xs">
            <IconCalendar size={18} className="text-green-400" />
            <Text size="sm" fw={600} c="var(--mantine-color-gray-1)">
              Next {nextRuns.length} Scheduled Runs
            </Text>
          </Group>
          <Stack gap="xs">
            {nextRuns.map((run, index) => (
              <Group key={index} gap="sm">
                <Badge variant="light" size="sm">
                  Run #{index + 1}
                </Badge>
                <Text size="sm" c="var(--mantine-color-gray-2)">
                  {run}
                </Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Help Info */}
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        <Stack gap="xs">
          <Text size="sm">
            <strong>Cron Expression Format:</strong> minute hour day month weekday
          </Text>
          <Text size="sm">
            <strong>Special Characters:</strong> * (any), , (list), - (range), / (step)
          </Text>
          <Text size="sm">
            <strong>Example:</strong> "0 9 * * *" = Every day at 9:00 AM
          </Text>
        </Stack>
      </Alert>

      {/* Test Button */}
      {onTest && (
        <Group justify="flex-end">
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={onTest}
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-blue-6)',
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-blue-7)',
                },
              },
            }}
          >
            Test Schedule
          </Button>
        </Group>
      )}
    </Stack>
  );
}
