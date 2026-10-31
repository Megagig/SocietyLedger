'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Divider, Group, MultiSelect, NumberInput, Stack, Text } from '@mantine/core';
import { bff } from '@/lib/bff';
import { billingKeys, type BuilderAddon } from '@/lib/billing';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;

/** The owner's caps (2026-10-27). The API enforces them; these are shown so a staff member knows the limit before typing. */
const CEILING = { cycleMaxNaira: 5_000, participantMaxNaira: 1_000, maxPercent: 10 } as const;

export interface AjoLevyValues {
  ajoCycleLevyBps?: number;
  ajoCycleLevyMinKobo?: number;
  ajoCycleLevyMaxKobo?: number;
  ajoParticipantLevyBps?: number;
  ajoParticipantLevyMinKobo?: number;
  ajoParticipantLevyMaxKobo?: number;
  ajoLevyExemptAddonCodes?: string[];
}

type LevyKey = keyof AjoLevyValues;

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
      <Stack gap={2} style={{ flex: 1, minWidth: 260 }}>
        <Text size="sm" fw={600}>{title}</Text>
        <Text size="xs" c="dimmed">{hint}</Text>
      </Stack>
      <Group gap="sm" wrap="wrap">{children}</Group>
    </Group>
  );
}

const toNaira = (kobo: number | undefined) => (kobo ?? 0) / 100;
const toKobo = (v: string | number) => Math.round((typeof v === 'number' ? v : Number(v) || 0) * 100);
const toPercent = (bps: number | undefined) => (bps ?? 0) / 100;
const toBps = (v: string | number) => Math.round((typeof v === 'number' ? v : Number(v) || 0) * 100);

/**
 * Ajo platform levy (T9.1). SocietyLedger's own charge on a group, billed on the add-on invoice and never taken from contribution
 * money. Held as basis points and kobo by the API; shown here as percent and naira, and money in full.
 */
export function AjoLevySection({ values, onChange }: { values: AjoLevyValues; onChange: <K extends LevyKey>(key: K, value: AjoLevyValues[K]) => void }) {
  const addons = useQuery({ queryKey: billingKeys.addons, queryFn: () => bff<BuilderAddon[]>('admin/billing/addons') });
  const tiers = (addons.data ?? []).filter((a) => a.family === 'ajo' && !a.isArchived);
  // A saved exempt code whose tier is archived or not loaded yet must still show (and survive a save), not vanish from the list.
  const options = [...tiers.map((a) => ({ value: a.code, label: a.name })), ...(values.ajoLevyExemptAddonCodes ?? []).filter((c) => !tiers.some((a) => a.code === c)).map((c) => ({ value: c, label: `${c} (not on sale)` }))];

  const money = (key: LevyKey, max: number) => (
    <NumberInput
      value={toNaira(values[key] as number | undefined)}
      onChange={(v) => onChange(key, toKobo(v) as never)}
      min={0}
      max={max}
      prefix="₦"
      thousandSeparator=","
      decimalScale={2}
      fixedDecimalScale
      size="sm"
      w={150}
    />
  );
  const percent = (key: LevyKey) => (
    <NumberInput
      value={toPercent(values[key] as number | undefined)}
      onChange={(v) => onChange(key, toBps(v) as never)}
      min={0}
      max={CEILING.maxPercent}
      suffix="%"
      decimalScale={2}
      size="sm"
      w={110}
    />
  );

  return (
    <Card style={card} p="xl" radius="lg">
      <Stack gap="xs" mb="lg">
        <Text fw={700} size="md">Ajo platform levy</Text>
        <Text size="sm" c="dimmed">
          What SocietyLedger charges a group per cycle and per participant. It is billed to the group admin on the add-on invoice and never taken from contribution money. Capped at ₦5,000.00 per cycle and ₦1,000.00 per participant.
        </Text>
      </Stack>
      <Stack gap="lg">
        <Row title="Cycle levy" hint="A share of the cycle's total scheduled contributions, kept between a minimum and a maximum.">
          {percent('ajoCycleLevyBps')}
          <Stack gap={2}><Text size="xs" c="dimmed">Minimum</Text>{money('ajoCycleLevyMinKobo', CEILING.cycleMaxNaira)}</Stack>
          <Stack gap={2}><Text size="xs" c="dimmed">Maximum</Text>{money('ajoCycleLevyMaxKobo', CEILING.cycleMaxNaira)}</Stack>
        </Row>
        <Divider />
        <Row title="Participant levy" hint="A share of that participant's scheduled contributions for the cycle, kept between a minimum and a maximum.">
          {percent('ajoParticipantLevyBps')}
          <Stack gap={2}><Text size="xs" c="dimmed">Minimum</Text>{money('ajoParticipantLevyMinKobo', CEILING.participantMaxNaira)}</Stack>
          <Stack gap={2}><Text size="xs" c="dimmed">Maximum</Text>{money('ajoParticipantLevyMaxKobo', CEILING.participantMaxNaira)}</Stack>
        </Row>
        <Divider />
        <Row title="Tiers that pay no levy" hint="Groups on these Ajo tiers pay the subscription only. Starter is exempt by default.">
          <MultiSelect
            data={options}
            value={values.ajoLevyExemptAddonCodes ?? []}
            onChange={(v) => onChange('ajoLevyExemptAddonCodes', v)}
            placeholder={addons.isLoading ? 'Loading…' : 'No tier is exempt'}
            size="sm"
            w={300}
          />
        </Row>
      </Stack>
    </Card>
  );
}
