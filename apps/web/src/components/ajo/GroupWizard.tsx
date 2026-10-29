'use client';

import { useState } from 'react';
import { Button, Checkbox, NumberInput, SegmentedControl, Select, Stepper, TextInput } from '@mantine/core';
import { DEFAULT_RULES, RulesFields, rulesFormToInput, type RulesFormValues } from './RulesFields';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatKobo, nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi, type GroupFieldsInput } from '@/lib/ajo/staffApi';
import { useAjoAction } from '@/lib/ajo/staffHooks';
import { toast } from '@/lib/toast';
import type { GroupDetailDTO } from '@/lib/ajo/staffTypes';

type Form = {
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  name: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  contribution: string;
  startDate: string;
  cycleLength: number;
  maxParticipants: number;
  maxShares: number;
  allowLateJoin: boolean;
  collectorFeeType: 'NONE' | 'FIXED' | 'PERCENT' | 'DAYS';
  collectorFeeValue: string;
  cutoffTime: string;
  requirePhoneConfirm: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  rules: RulesFormValues;
};

const INITIAL: Form = {
  model: 'COLLECTOR_THRIFT', name: '', frequency: 'DAILY', contribution: '', startDate: '', cycleLength: 31, maxParticipants: 30, maxShares: 2, allowLateJoin: false,
  collectorFeeType: 'DAYS', collectorFeeValue: '1', cutoffTime: '18:00', requirePhoneConfirm: false, bankName: '', accountNumber: '', accountName: '', rules: DEFAULT_RULES,
};

/** Turns the form into what the API takes, or says what is wrong on which step. */
function build(f: Form): { body: Parameters<typeof ajoStaffApi.createGroup>[0] } | { error: string; step: number } {
  if (f.name.trim().length < 2) return { error: 'Give the group a name.', step: 0 };
  const contribution = nairaToKobo(f.contribution);
  if (contribution === null || contribution <= BigInt(0)) return { error: 'Enter how much each person pays each time, in naira, for example 5,000.', step: 1 };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.startDate)) return { error: 'Choose the day the group starts.', step: 1 };
  if (f.startDate < new Date().toISOString().slice(0, 10)) return { error: 'The start date must be today or later.', step: 1 };
  let collectorFeeValue = '0';
  if (f.collectorFeeType === 'FIXED') {
    const kobo = nairaToKobo(f.collectorFeeValue);
    if (kobo === null || kobo <= BigInt(0)) return { error: 'Enter the collector fee in naira.', step: 2 };
    collectorFeeValue = kobo.toString();
  } else if (f.collectorFeeType === 'PERCENT') {
    const percent = Number(f.collectorFeeValue);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { error: 'Enter the collector fee as a percentage between 0 and 100.', step: 2 };
    collectorFeeValue = String(Math.round(percent * 100));
  } else if (f.collectorFeeType === 'DAYS') {
    const days = Number(f.collectorFeeValue);
    if (!Number.isInteger(days) || days < 1 || days > 31) return { error: 'The collector fee is between 1 and 31 days of contribution.', step: 2 };
    collectorFeeValue = String(days);
  }
  if (!/^\d{10}$/.test(f.accountNumber.replace(/\s/g, ''))) return { error: 'A bank account number has 10 digits.', step: 3 };
  if (f.bankName.trim().length < 2 || f.accountName.trim().length < 2) return { error: 'Enter the bank and the account name.', step: 3 };
  const rules = rulesFormToInput(f.rules);
  if ('error' in rules) return { error: rules.error, step: 4 };

  const fields: GroupFieldsInput = {
    name: f.name.trim(), model: f.model, frequency: f.model === 'ROTATING_POT' && f.frequency === 'DAILY' ? 'WEEKLY' : f.frequency, contributionKobo: contribution.toString(), startDate: f.startDate,
    cycleLength: f.model === 'COLLECTOR_THRIFT' ? f.cycleLength : null, maxParticipants: f.maxParticipants, maxSharesPerMember: f.model === 'ROTATING_POT' ? f.maxShares : 1,
    allowLateJoin: f.allowLateJoin, collectorFeeType: f.collectorFeeType, collectorFeeValue, cutoffTime: f.cutoffTime, requirePhoneConfirm: f.requirePhoneConfirm,
  };
  return { body: { ...fields, bank: { bankName: f.bankName.trim(), accountNumber: f.accountNumber.replace(/\s/g, ''), accountName: f.accountName.trim() }, rules: rules.input } };
}

/** Two plain examples, for someone who does not yet know which kind of circle they run. */
function ModelExamples() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
        <p className="font-semibold">Collector thrift</p>
        <p className="mt-1 text-gray-600 dark:text-gray-400">Everyone pays ₦500.00 a day for 31 days. The collector keeps one day&apos;s payment. Everyone gets their savings back at the end.</p>
      </div>
      <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
        <p className="font-semibold">Rotating pot</p>
        <p className="mt-1 text-gray-600 dark:text-gray-400">10 people each pay ₦10,000.00 a month. Each month one person takes the full ₦100,000.00, in a drawn order.</p>
      </div>
    </div>
  );
}

/**
 * THO2: create a group in five short steps, saved as a draft. Used by the Ajo "New group" page and by thrift onboarding, so a group
 * made in either place is identical. The caller decides what happens next through `onCreated`.
 */
export function GroupWizard({ onCreated, examples = false }: { onCreated: (group: GroupDetailDTO) => void; examples?: boolean }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(INITIAL);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useAjoAction(ajoStaffApi.createGroup);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));


  const rotating = form.model === 'ROTATING_POT';
  const next = () => {
    const built = build(form);
    if ('error' in built && built.step <= step) return setProblem(built.error);
    setProblem(null);
    setStep((s) => Math.min(s + 1, 5));
  };

  const submit = async () => {
    const built = build(form);
    if ('error' in built) {
      setStep(built.step);
      return setProblem(built.error);
    }
    setProblem(null);
    try {
      const group = await create.mutateAsync(built.body);
      toast.success('Group created as a draft.');
      onCreated(group);
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'Could not create the group.'));
    }
  };

  const built = build(form);
  return (
    <div className="space-y-6">
      {examples && <ModelExamples />}

      <Stepper active={step} onStepClick={setStep} allowNextStepsSelect={false} size="sm">
        <Stepper.Step label="Kind" />
        <Stepper.Step label="Money" />
        <Stepper.Step label="Collector" />
        <Stepper.Step label="Account" />
        <Stepper.Step label="Rules" />
        <Stepper.Step label="Review" />
      </Stepper>

      <div className="space-y-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        {step === 0 && (
          <>
            <SegmentedControl fullWidth value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v as Form['model'], frequency: v === 'ROTATING_POT' ? 'MONTHLY' : 'DAILY', collectorFeeType: v === 'ROTATING_POT' ? 'NONE' : 'DAYS', collectorFeeValue: v === 'ROTATING_POT' ? '' : '1' }))} data={[{ value: 'COLLECTOR_THRIFT', label: 'Collector thrift' }, { value: 'ROTATING_POT', label: 'Rotating pot' }]} />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {rotating ? 'Everyone pays the same amount each round and one person collects the whole pot in turn, in a drawn order.' : 'A collector goes round and collects a set amount each day or week. Everyone gets their savings back at the end of the cycle, less the collector’s fee.'}
            </p>
            <TextInput label="Group name" value={form.name} onChange={(e) => set('name', e.currentTarget.value)} maxLength={80} required />
          </>
        )}
        {step === 1 && (
          <>
            <TextInput label="Each person pays (₦)" description={rotating ? 'Every round, for each share they hold.' : 'Every time (each day, week or month).'} inputMode="decimal" value={form.contribution} onChange={(e) => set('contribution', e.currentTarget.value)} required />
            <Select label="How often" data={rotating ? [{ value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }] : [{ value: 'DAILY', label: 'Daily' }, { value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }]} value={form.frequency} onChange={(v) => set('frequency', (v ?? 'WEEKLY') as Form['frequency'])} allowDeselect={false} />
            <TextInput label="First payment date" type="date" min={new Date().toISOString().slice(0, 10)} value={form.startDate} onChange={(e) => set('startDate', e.currentTarget.value)} required />
            {!rotating && <NumberInput label="Number of payments in the cycle" description="For example 31 daily payments." min={1} max={400} value={form.cycleLength} onChange={(v) => set('cycleLength', typeof v === 'number' ? v : 1)} />}
            <NumberInput label="Most people in the group" min={rotating ? 2 : 1} max={2000} value={form.maxParticipants} onChange={(v) => set('maxParticipants', typeof v === 'number' ? v : 1)} />
            {rotating && <NumberInput label="Most shares one person can hold" description="A person with two shares pays twice and collects twice." min={1} max={5} value={form.maxShares} onChange={(v) => set('maxShares', typeof v === 'number' ? v : 1)} />}
            <Checkbox label="People may join after the group has started" checked={form.allowLateJoin} onChange={(e) => set('allowLateJoin', e.currentTarget.checked)} />
          </>
        )}
        {step === 2 && (
          <>
            <Select label="How the collector is paid" data={[{ value: 'NONE', label: 'No collector fee' }, { value: 'DAYS', label: 'Days of contribution (for example 1 day’s payment)' }, { value: 'FIXED', label: 'A fixed amount' }, { value: 'PERCENT', label: 'A percentage of the pot' }]} value={form.collectorFeeType} onChange={(v) => set('collectorFeeType', (v ?? 'NONE') as Form['collectorFeeType'])} allowDeselect={false} />
            {form.collectorFeeType !== 'NONE' && <TextInput label={form.collectorFeeType === 'DAYS' ? 'Number of days (1 to 31)' : form.collectorFeeType === 'FIXED' ? 'Amount (₦)' : 'Percentage'} inputMode="decimal" value={form.collectorFeeValue} onChange={(e) => set('collectorFeeValue', e.currentTarget.value)} />}
            <TextInput label="Cut-off time each day" description="A payment recorded after this time counts for the next day." value={form.cutoffTime} onChange={(e) => set('cutoffTime', e.currentTarget.value)} placeholder="18:00" />
            <Checkbox label="Members must confirm their phone number before they can join" checked={form.requirePhoneConfirm} onChange={(e) => set('requirePhoneConfirm', e.currentTarget.checked)} />
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">This is the group&apos;s own bank account, where members send their contributions. SocietyLedger never holds the money. Only the last four digits are shown to officers.</p>
            <TextInput label="Bank" value={form.bankName} onChange={(e) => set('bankName', e.currentTarget.value)} required />
            <TextInput label="Account number" inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(e) => set('accountNumber', e.currentTarget.value)} required />
            <TextInput label="Account name" value={form.accountName} onChange={(e) => set('accountName', e.currentTarget.value)} required />
          </>
        )}
        {step === 4 && <RulesFields value={form.rules} onChange={(rules) => set('rules', rules)} />}
        {step === 5 && 'body' in built && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ['Name', form.name], ['Kind', rotating ? 'Rotating pot' : 'Collector thrift'], ['Each pays', formatKobo(built.body.contributionKobo)], ['How often', form.frequency.toLowerCase()],
              ['Starts', form.startDate], [rotating ? 'Shares per person' : 'Payments in the cycle', String(rotating ? form.maxShares : form.cycleLength)], ['Up to', `${form.maxParticipants} people`],
              ['Collector fee', form.collectorFeeType === 'NONE' ? 'None' : form.collectorFeeType === 'DAYS' ? `${form.collectorFeeValue} day(s) of contribution` : form.collectorFeeType === 'FIXED' ? formatKobo(built.body.collectorFeeValue) : `${form.collectorFeeValue}%`],
              ['Account', `${form.bankName} · ${form.accountName}`], ['Late fee', form.rules.lateFeeType === 'NONE' ? 'None' : form.rules.lateFeeType === 'FIXED' ? `₦${form.rules.lateFeeValue}` : `${form.rules.lateFeeValue}%`],
              ['Grace days', String(form.rules.graceDays)],
            ].map(([label, value]) => (
              <div key={label}><dt className="text-gray-500">{label}</dt><dd className="font-medium">{value}</dd></div>
            ))}
          </dl>
        )}
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      </div>

      <div className="flex justify-between">
        <Button variant="default" disabled={step === 0} onClick={() => { setProblem(null); setStep((s) => s - 1); }}>Back</Button>
        {step < 5 ? <Button onClick={next}>Next</Button> : <Button color="green" onClick={submit} loading={create.isLoading}>Create group</Button>}
      </div>
      <p className="text-xs text-gray-500">The group is saved as a draft. You add people, then open it for joining, then start it when you are ready.</p>
    </div>
  );
}
