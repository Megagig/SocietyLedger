import { useState } from 'react';
import { Modal, Platform, Pressable, Share, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { useMyStatement } from '@/features/memberLedger/queries';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);

type Preset = { label: string; startDate: string; endDate: string };
const PRESETS: Preset[] = [
  { label: 'Last 1 month', startDate: monthsAgo(1), endDate: today },
  { label: 'Last 3 months', startDate: monthsAgo(3), endDate: today },
  { label: 'Last 6 months', startDate: monthsAgo(6), endDate: today },
  { label: 'Last 12 months', startDate: monthsAgo(12), endDate: today },
];

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

function DatePickerField({ label, value, onChange, minimumDate, maximumDate }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const { color } = useThemeTokens();
  const selectedDate = value ? new Date(value) : new Date();

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(date.toISOString().slice(0, 10));
      return;
    }
    if (date) onChange(date.toISOString().slice(0, 10));
  };

  return (
    <View className="gap-1.5">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-[52px] flex-row items-center justify-between rounded-md border border-border-strong bg-surface-sunken px-4"
      >
        <Text variant="body">{formatDate(value, 'long')}</Text>
        <CalendarDays size={18} color={color.textTertiary} />
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View className="flex-1 justify-end bg-overlay/45">
            <View className="rounded-t-xl bg-surface p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="h2">{label}</Text>
                <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                  Done
                </Button>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleChange}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

type SelectionMode = 'preset' | 'custom';

function RadioDot({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <View className="h-5 w-5 rounded-full bg-primary items-center justify-center">
        <Text variant="micro" tone="inverse">✓</Text>
      </View>
    );
  }
  return <View className="h-5 w-5 rounded-full border border-border" />;
}

export default function StatementScreen() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [mode, setMode] = useState<SelectionMode>('preset');
  const [customStart, setCustomStart] = useState(monthsAgo(1));
  const [customEnd, setCustomEnd] = useState(today);

  const startDate = mode === 'custom' ? customStart : PRESETS[selectedPreset]!.startDate;
  const endDate = mode === 'custom' ? customEnd : PRESETS[selectedPreset]!.endDate;
  const isCustomValid = mode !== 'custom' || customStart <= customEnd;

  const statementQuery = useMyStatement(startDate, endDate);
  const statement = statementQuery.data;

  async function handleShare() {
    if (!statement) return;

    const lines = [
      `Statement: ${formatDate(startDate, 'short')} – ${formatDate(endDate, 'short')}`,
      `Member: ${statement.member.firstName} ${statement.member.lastName} (${statement.member.memberId})`,
      `Opening balance: ₦${toDecimal(statement.openingBalance).toFixed(2)}`,
      '',
      ...statement.entries.map(
        (e) =>
          `${formatDate(e.date, 'short')}  ${e.description}  ${
            toDecimal(e.debit).greaterThan(0)
              ? `-₦${toDecimal(e.debit).toFixed(2)}`
              : `+₦${toDecimal(e.credit).toFixed(2)}`
          }  Bal: ₦${toDecimal(e.balance).toFixed(2)}`,
      ),
      '',
      `Closing balance: ₦${toDecimal(statement.closingBalance).toFixed(2)}`,
      `Total charged: ₦${toDecimal(statement.totals.totalDebits).toFixed(2)}`,
      `Total paid:    ₦${toDecimal(statement.totals.totalCredits).toFixed(2)}`,
    ];

    await Share.share({ message: lines.join('\n'), title: 'Account Statement' });
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen edges={['top']}>
      <ScreenHeader title="Statement" onBack={() => router.back()} />

      <View className="gap-6">
        <Section title="Select period">
          <ListGroup>
            {PRESETS.map((p, index) => (
              <ListItem
                key={p.label}
                title={p.label}
                meta={`${formatDate(p.startDate, 'short')} – ${formatDate(p.endDate, 'short')}`}
                trailing={<RadioDot selected={mode === 'preset' && selectedPreset === index} />}
                onPress={() => {
                  setMode('preset');
                  setSelectedPreset(index);
                }}
              />
            ))}
            <ListItem
              title="Custom range"
              meta="Pick your own start and end date"
              trailing={<RadioDot selected={mode === 'custom'} />}
              onPress={() => setMode('custom')}
            />
          </ListGroup>
        </Section>

        {mode === 'custom' && (
          <Section title="Date range">
            <View className="gap-4 px-4">
              <DatePickerField
                label="Start date"
                value={customStart}
                onChange={setCustomStart}
                maximumDate={new Date(customEnd)}
              />
              <DatePickerField
                label="End date"
                value={customEnd}
                onChange={setCustomEnd}
                minimumDate={new Date(customStart)}
                maximumDate={new Date()}
              />
              {!isCustomValid && (
                <Text variant="caption" tone="danger">
                  Start date must be before end date.
                </Text>
              )}
            </View>
          </Section>
        )}

        {statementQuery.isPending ? (
          <View className="gap-2 px-4">
            <Skeleton width="100%" height={48} radius="md" />
            <Skeleton width="100%" height={48} radius="md" />
            <Skeleton width="100%" height={48} radius="md" />
          </View>
        ) : statement ? (
          <Section title="Preview">
            <ListGroup>
              <ListItem
                title="Opening balance"
                trailing={<Money value={statement.openingBalance} />}
              />
              <ListItem
                title="Total charged"
                trailing={<Money value={statement.totals.totalDebits} />}
              />
              <ListItem
                title="Total paid"
                trailing={<Money value={statement.totals.totalCredits} />}
              />
              <ListItem
                title="Closing balance"
                trailing={<Money value={statement.closingBalance} size="body-strong" />}
              />
            </ListGroup>
            <Text variant="caption" tone="secondary" className="text-center mt-2">
              {statement.entries.length} entries in this period
            </Text>
          </Section>
        ) : null}
      </View>

    </Screen>
    <StickyFooter>
      <Button
        variant="gradient"
        size="lg"
        fullWidth
        disabled={!statement || statementQuery.isPending || !isCustomValid}
        onPress={handleShare}
      >
        Share statement
      </Button>
    </StickyFooter>
    </View>
  );
}
