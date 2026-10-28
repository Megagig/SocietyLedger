'use client';

import { Checkbox, NumberInput, Select, TextInput } from '@mantine/core';
import { nairaToKobo } from '@/lib/ajo/format';
import type { RulesInput } from '@/lib/ajo/staffApi';

/** The group's rules as the person types them: naira and percent, not kobo and basis points. */
export type RulesFormValues = {
  lateFeeType: 'NONE' | 'FIXED' | 'PERCENT';
  lateFeeValue: string;
  lateFeeCap: string;
  graceDays: number;
  guarantorPolicy: 'NOT_REQUIRED' | 'OPTIONAL' | 'REQUIRED';
  defaultProcedure: 'NOTIFY_ADMIN' | 'REPAYMENT_PLAN' | 'CASE_AND_PLAN';
  remindersEnabled: boolean;
  blockAtRiskEarly: boolean;
};

export const DEFAULT_RULES: RulesFormValues = {
  lateFeeType: 'NONE',
  lateFeeValue: '',
  lateFeeCap: '',
  graceDays: 3,
  guarantorPolicy: 'NOT_REQUIRED',
  defaultProcedure: 'CASE_AND_PLAN',
  remindersEnabled: true,
  blockAtRiskEarly: false,
};

/** Turns the form into what the API takes, or says in words what is wrong. */
export function rulesFormToInput(v: RulesFormValues): { input: RulesInput } | { error: string } {
  const input: RulesInput = { lateFeeType: v.lateFeeType, graceDays: v.graceDays, guarantorPolicy: v.guarantorPolicy, defaultProcedure: v.defaultProcedure, remindersEnabled: v.remindersEnabled, blockAtRiskEarly: v.blockAtRiskEarly };
  if (v.lateFeeType === 'FIXED') {
    const kobo = nairaToKobo(v.lateFeeValue);
    if (kobo === null || kobo <= BigInt(0)) return { error: 'Enter the late fee in naira, for example 500.' };
    input.lateFeeValue = kobo.toString();
  } else if (v.lateFeeType === 'PERCENT') {
    const percent = Number(v.lateFeeValue);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { error: 'Enter the late fee as a percentage between 0 and 100.' };
    input.lateFeeValue = String(Math.round(percent * 100));
  } else {
    input.lateFeeValue = '0';
  }
  if (v.lateFeeType !== 'NONE' && v.lateFeeCap.trim()) {
    const cap = nairaToKobo(v.lateFeeCap);
    if (cap === null || cap <= BigInt(0)) return { error: 'Enter the most a late fee can reach in naira, or leave it empty for no limit.' };
    input.lateFeeCapKobo = cap.toString();
  } else {
    input.lateFeeCapKobo = null;
  }
  if (!Number.isInteger(v.graceDays) || v.graceDays < 0 || v.graceDays > 30) return { error: 'Grace days must be a whole number from 0 to 30.' };
  return { input };
}

export function RulesFields({ value, onChange }: { value: RulesFormValues; onChange: (next: RulesFormValues) => void }) {
  const set = <K extends keyof RulesFormValues>(key: K, v: RulesFormValues[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      <Select
        label="Late fee"
        description="Charged once for each missed payment, after the grace days. Members are told first and it only becomes payable 48 hours later."
        data={[
          { value: 'NONE', label: 'No late fee' },
          { value: 'FIXED', label: 'A fixed amount' },
          { value: 'PERCENT', label: 'A percentage of the contribution' },
        ]}
        value={value.lateFeeType}
        onChange={(v) => set('lateFeeType', (v ?? 'NONE') as RulesFormValues['lateFeeType'])}
        allowDeselect={false}
      />
      {value.lateFeeType !== 'NONE' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={value.lateFeeType === 'FIXED' ? 'Fee (₦)' : 'Fee (% of the contribution)'} inputMode="decimal" value={value.lateFeeValue} onChange={(e) => set('lateFeeValue', e.currentTarget.value)} />
          <TextInput label="Most a fee can reach (₦, optional)" inputMode="decimal" value={value.lateFeeCap} onChange={(e) => set('lateFeeCap', e.currentTarget.value)} />
        </div>
      )}
      <NumberInput label="Grace days" description="Days after the due date before a payment counts as late." min={0} max={30} value={value.graceDays} onChange={(v) => set('graceDays', typeof v === 'number' ? v : 0)} />
      <Select
        label="Guarantor"
        data={[
          { value: 'NOT_REQUIRED', label: 'Not needed' },
          { value: 'OPTIONAL', label: 'Optional' },
          { value: 'REQUIRED', label: 'Required before joining' },
        ]}
        value={value.guarantorPolicy}
        onChange={(v) => set('guarantorPolicy', (v ?? 'NOT_REQUIRED') as RulesFormValues['guarantorPolicy'])}
        allowDeselect={false}
      />
      <Select
        label="If someone stops paying after they were paid"
        description="Only for a rotating pot. Nothing is ever taken from other members or guarantors."
        data={[
          { value: 'NOTIFY_ADMIN', label: 'Tell the admins' },
          { value: 'REPAYMENT_PLAN', label: 'Offer the member a repayment plan' },
          { value: 'CASE_AND_PLAN', label: 'Open a case and offer a plan' },
        ]}
        value={value.defaultProcedure}
        onChange={(v) => set('defaultProcedure', (v ?? 'CASE_AND_PLAN') as RulesFormValues['defaultProcedure'])}
        allowDeselect={false}
      />
      <Checkbox label="Send payment reminders" checked={value.remindersEnabled} onChange={(e) => set('remindersEnabled', e.currentTarget.checked)} />
      <Checkbox label="Keep people with a poor record out of the first payout positions" checked={value.blockAtRiskEarly} onChange={(e) => set('blockAtRiskEarly', e.currentTarget.checked)} />
    </div>
  );
}
