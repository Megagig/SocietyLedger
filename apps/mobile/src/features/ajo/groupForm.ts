import type { BankInput, GroupFieldsInput, RulesInput } from '@/api/endpoints/ajo';
import type { RuleVersionDTO } from '@/types/api/ajo';
import { isoToLocalDay, nairaToKobo, todayIso } from './format';

/**
 * The create-circle form and the rules form, as the person types them (naira and percent, not kobo and basis points), and the
 * functions that turn them into what the API takes. Same rules and wording as the web wizard (apps/web GroupWizard / RulesFields).
 * Numbers are kept as text because they come from text fields.
 */

export type RulesFormValues = {
  lateFeeType: 'NONE' | 'FIXED' | 'PERCENT';
  lateFeeValue: string;
  lateFeeCap: string;
  graceDays: string;
  guarantorPolicy: 'NOT_REQUIRED' | 'OPTIONAL' | 'REQUIRED';
  defaultProcedure: 'NOTIFY_ADMIN' | 'REPAYMENT_PLAN' | 'CASE_AND_PLAN';
  remindersEnabled: boolean;
  blockAtRiskEarly: boolean;
  /** Rotating pot only: may the circle's members see each other on the Circle board? */
  memberVisibility: 'FULL' | 'OFF';
  nameDisplay: 'FIRST_INITIAL' | 'FULL';
};

export const DEFAULT_RULES: RulesFormValues = {
  lateFeeType: 'NONE',
  lateFeeValue: '',
  lateFeeCap: '',
  graceDays: '3',
  guarantorPolicy: 'NOT_REQUIRED',
  defaultProcedure: 'CASE_AND_PLAN',
  remindersEnabled: true,
  blockAtRiskEarly: false,
  memberVisibility: 'FULL',
  nameDisplay: 'FIRST_INITIAL',
};

/** Turns the rules form into what the API takes, or says in words what is wrong. `rotating` is false for a collector-thrift scheme, whose savers can never see each other, so visibility is always OFF. */
export function rulesFormToInput(v: RulesFormValues, rotating = true): { input: RulesInput } | { error: string } {
  const graceDays = Number(v.graceDays);
  const input: RulesInput = { lateFeeType: v.lateFeeType, graceDays, guarantorPolicy: v.guarantorPolicy, defaultProcedure: v.defaultProcedure, remindersEnabled: v.remindersEnabled, blockAtRiskEarly: v.blockAtRiskEarly, memberVisibility: rotating ? v.memberVisibility : 'OFF', nameDisplay: v.nameDisplay };
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
  if (v.graceDays.trim() === '' || !Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) return { error: 'Grace days must be a whole number from 0 to 30.' };
  return { input };
}

/** Fills the rules form from a published version, so a new version starts from the current one. */
export function rulesToForm(v: RuleVersionDTO): RulesFormValues {
  const r = v.rules;
  return {
    lateFeeType: r.lateFeeType,
    lateFeeValue: r.lateFeeType === 'FIXED' ? (Number(r.lateFeeValue) / 100).toFixed(2) : r.lateFeeType === 'PERCENT' ? String(Number(r.lateFeeValue) / 100) : '',
    lateFeeCap: r.lateFeeCapKobo ? (Number(r.lateFeeCapKobo) / 100).toFixed(2) : '',
    graceDays: String(r.graceDays),
    guarantorPolicy: r.guarantorPolicy,
    defaultProcedure: r.defaultProcedure,
    remindersEnabled: r.remindersEnabled,
    blockAtRiskEarly: r.blockAtRiskEarly,
    memberVisibility: r.memberVisibility,
    nameDisplay: r.nameDisplay,
  };
}

export type GroupFormValues = {
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  name: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM';
  /** Only used when frequency is CUSTOM: every N days, weeks or months. */
  customCount: string;
  customUnit: 'DAYS' | 'WEEKS' | 'MONTHS';
  contribution: string;
  /** An ISO string from the date field. */
  startDate: string;
  cycleLength: string;
  maxParticipants: string;
  maxShares: string;
  /** Rotating pot: how the payout order is decided. */
  orderMethod: 'RANDOM_DRAW' | 'ADMIN_SET';
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

export const INITIAL_GROUP: GroupFormValues = {
  model: 'COLLECTOR_THRIFT',
  name: '',
  frequency: 'DAILY',
  customCount: '2',
  customUnit: 'WEEKS',
  contribution: '',
  startDate: '',
  cycleLength: '31',
  maxParticipants: '30',
  maxShares: '2',
  orderMethod: 'RANDOM_DRAW',
  allowLateJoin: false,
  collectorFeeType: 'DAYS',
  collectorFeeValue: '1',
  cutoffTime: '18:00',
  requirePhoneConfirm: false,
  bankName: '',
  accountNumber: '',
  accountName: '',
  rules: DEFAULT_RULES,
};

export const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly (every 3 months)' },
  { value: 'ANNUALLY', label: 'Annually (every year)' },
  { value: 'CUSTOM', label: 'Custom: set your own' },
];

export type CreateGroupBody = GroupFieldsInput & { bank?: BankInput; rules?: RulesInput };
export type BuiltGroup = { body: CreateGroupBody } | { error: string; step: number };

const wholeNumber = (text: string): number => (text.trim() === '' ? NaN : Number(text));

/** Turns the form into what the API takes, or says what is wrong and on which step (0 to 4). */
export function buildGroup(f: GroupFormValues): BuiltGroup {
  if (f.name.trim().length < 2) return { error: 'Give the circle a name.', step: 0 };
  const contribution = nairaToKobo(f.contribution);
  if (contribution === null || contribution <= BigInt(0)) return { error: 'Enter how much each person pays each time, in naira, for example 5,000.', step: 1 };
  const startDay = f.startDate ? isoToLocalDay(f.startDate) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return { error: 'Choose the day the circle starts.', step: 1 };
  if (startDay < todayIso()) return { error: 'The start date must be today or later.', step: 1 };
  let intervalCount: number | null = null;
  let intervalUnit: GroupFormValues['customUnit'] | null = null;
  if (f.frequency === 'CUSTOM') {
    const n = wholeNumber(f.customCount);
    if (!Number.isInteger(n) || n < 1 || n > 60) return { error: 'For your own schedule, enter how many days, weeks or months between payments (1 to 60).', step: 1 };
    intervalCount = n;
    intervalUnit = f.customUnit;
  }
  const rotating = f.model === 'ROTATING_POT';
  const cycleLength = wholeNumber(f.cycleLength);
  if (!rotating && (!Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 400)) return { error: 'Enter how many payments are in the cycle (1 to 400).', step: 1 };
  const maxParticipants = wholeNumber(f.maxParticipants);
  if (!Number.isInteger(maxParticipants) || maxParticipants < (rotating ? 2 : 1) || maxParticipants > 2000) return { error: rotating ? 'A rotating pot needs 2 to 2,000 people.' : 'Enter how many people can join (1 to 2,000).', step: 1 };
  const maxShares = wholeNumber(f.maxShares);
  if (rotating && (!Number.isInteger(maxShares) || maxShares < 1 || maxShares > 5)) return { error: 'One person can hold 1 to 5 shares.', step: 1 };

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
    const days = wholeNumber(f.collectorFeeValue);
    if (!Number.isInteger(days) || days < 1 || days > 31) return { error: 'The collector fee is between 1 and 31 days of contribution.', step: 2 };
    collectorFeeValue = String(days);
  }
  if (!/^\d{2}:\d{2}$/.test(f.cutoffTime.trim())) return { error: 'Write the cut-off time like 18:00.', step: 2 };
  if (!/^\d{10}$/.test(f.accountNumber.replace(/\s/g, ''))) return { error: 'A bank account number has 10 digits.', step: 3 };
  if (f.bankName.trim().length < 2 || f.accountName.trim().length < 2) return { error: 'Enter the bank and the account name.', step: 3 };
  const rules = rulesFormToInput(f.rules, rotating);
  if ('error' in rules) return { error: rules.error, step: 4 };

  const fields: GroupFieldsInput = {
    name: f.name.trim(),
    model: f.model,
    frequency: rotating && f.frequency === 'DAILY' ? 'WEEKLY' : f.frequency,
    intervalCount,
    intervalUnit,
    contributionKobo: contribution.toString(),
    startDate: startDay,
    cycleLength: rotating ? null : cycleLength,
    maxParticipants,
    maxSharesPerMember: rotating ? maxShares : 1,
    ...(rotating ? { orderMethod: f.orderMethod } : {}),
    allowLateJoin: f.allowLateJoin,
    collectorFeeType: f.collectorFeeType,
    collectorFeeValue,
    cutoffTime: f.cutoffTime.trim(),
    requirePhoneConfirm: f.requirePhoneConfirm,
  };
  return { body: { ...fields, bank: { bankName: f.bankName.trim(), accountNumber: f.accountNumber.replace(/\s/g, ''), accountName: f.accountName.trim() }, rules: rules.input } };
}

/** What changes when the person flips between the two kinds of circle. */
export function defaultsForModel(model: GroupFormValues['model']): Pick<GroupFormValues, 'frequency' | 'collectorFeeType' | 'collectorFeeValue'> {
  return model === 'ROTATING_POT' ? { frequency: 'MONTHLY', collectorFeeType: 'NONE', collectorFeeValue: '' } : { frequency: 'DAILY', collectorFeeType: 'DAYS', collectorFeeValue: '1' };
}
