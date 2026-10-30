import { z } from 'zod';

import type { Attachment } from '@/components/forms/attachmentPickers';
import { normalizeNigerianPhone } from './contributorRows';
import { nairaToKobo } from './format';

/** The same limits the API enforces on a proof or evidence file, so the person is told before uploading. */
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const amountText = z
  .string()
  .trim()
  .min(1, 'Enter the amount you paid, for example 5,000 or 5000.50.')
  .refine((v) => {
    const kobo = nairaToKobo(v);
    return kobo !== null && kobo > BigInt(0);
  }, 'Enter the amount you paid, for example 5,000 or 5000.50.');

const attachment = z.custom<Attachment>((v) => !!v && typeof v === 'object' && 'uri' in (v as object));

/** THM3 — report a bank transfer with the slip. */
export const transferSchema = z.object({
  amount: amountText,
  paidOn: z
    .string()
    .min(1, 'Choose the day you paid.')
    .refine((v) => new Date(v).getTime() <= Date.now() + 60_000, 'The payment date cannot be in the future.'),
  reference: z.string().trim().max(80, 'Keep the reference under 80 characters').optional().default(''),
  proof: attachment.nullable().refine((v) => v !== null, 'Attach the slip or a screenshot of the transfer, so the officer can confirm it.'),
});
export type TransferValues = z.input<typeof transferSchema>;

/** THM8 — "I paid", with a written claim and optional evidence. */
export const MIN_CLAIM = 10;
export const disputeSchema = z.object({
  claim: z.string().trim().min(MIN_CLAIM, `Say what happened in at least ${MIN_CLAIM} characters, for example who you paid, how and when.`).max(1000, 'Keep it under 1,000 characters'),
  evidence: attachment.nullable().optional(),
});
export type DisputeValues = z.input<typeof disputeSchema>;

/** THM5 — where the circle pays the person. The number is stripped of spaces before it is checked. */
export const payoutAccountSchema = z.object({
  bankName: z.string().trim().min(2, 'Enter the bank name').max(80, 'Keep it under 80 characters'),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .refine((v) => /^\d{10}$/.test(v), 'A bank account number has 10 digits.'),
  accountName: z.string().trim().min(2, 'Enter the account name exactly as the bank has it').max(120, 'Keep it under 120 characters'),
});
export type PayoutAccountValues = z.input<typeof payoutAccountSchema>;

/** The code texted to confirm a phone number. */
export const phoneCodeSchema = z.object({ code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code from the text message (digits only).') });

/** THM4 — accept the circle's rules. */
export const rulesAcceptSchema = z.object({
  read: z.boolean().refine((v) => v, 'Tick the box to say you have read the rules.'),
  note: z.string().trim().max(300, 'Keep it under 300 characters').optional().default(''),
});

/** A plain-words problem with a picked file, or null when it is fine. */
export function proofProblem(file: { type: string; size?: number } | null | undefined): string | null {
  if (!file) return null;
  if (!PROOF_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or PDF file.';
  if (file.size !== undefined && file.size > MAX_PROOF_BYTES) return 'That file is bigger than 5 MB. Use a smaller photo.';
  return null;
}

/** An amount typed in naira, checked here; the screen turns it into kobo once with `nairaToKoboString` when it sends. */
const nairaAmount = (message: string, allowZero = false) =>
  z
    .string()
    .trim()
    .refine((v) => {
      const kobo = nairaToKobo(v);
      return kobo !== null && (allowZero || kobo > BigInt(0));
    }, message);

/** THC2 — cash taken from one person. */
export const cashAmountSchema = z.object({ amount: nairaAmount('Enter the amount you received, for example 500 or 1,500.') });
export type CashAmountValues = z.input<typeof cashAmountSchema>;

/** THC3 — cash handed over at the end of the day (0 is allowed). */
export const handoverSchema = z.object({
  amount: nairaAmount('Enter the cash you are handing over in naira. Enter 0 if you have none.', true),
  note: z.string().trim().max(300, 'Keep it under 300 characters').optional().default(''),
});
export type HandoverValues = z.input<typeof handoverSchema>;

/** Edit a draft or open circle's settings. */
export const editCircleSchema = z.object({
  name: z.string().trim().min(2, 'Give the circle a name.').max(80, 'Keep it under 80 characters'),
  contribution: nairaAmount('Enter how much each person pays, in naira.'),
  maxParticipants: z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 2000, 'Enter how many people can join (1 to 2,000).'),
  cutoffTime: z.string().trim().regex(/^\d{2}:\d{2}$/, 'Write the cut-off time like 18:00.'),
  /** The first payment date, as the date field holds it (an ISO moment). */
  startDate: z.string().min(1, 'Choose the day the circle starts.'),
  requirePhoneConfirm: z.boolean(),
});
export type EditCircleValues = z.input<typeof editCircleSchema>;

/** The guarantor's details, for a link or for recording an agreement made in person. */
export const guarantorSchema = z.object({
  name: z.string().trim().min(2, 'Enter the guarantor’s name.').max(120),
  phone: z.string().trim().min(7, 'Enter the guarantor’s phone number.').max(20),
  relationship: z.string().trim().min(2, 'Say how the guarantor knows the member.').max(80),
  note: z.string().trim().max(500).optional().default(''),
});
export type GuarantorValues = z.input<typeof guarantorSchema>;
/** The extra the officer must write when recording the agreement themselves. */
export const MIN_GUARANTOR_NOTE = 5;

/** Confirming a payment against the bank statement. The extra fields appear only when the server asks (a repeat proof, or the officer's own payment). */
export const confirmPaymentSchema = z.object({
  ack: z.boolean().optional().default(false),
  own: z.boolean().optional().default(false),
  note: z.string().trim().max(500).optional().default(''),
});
export type ConfirmPaymentValues = z.input<typeof confirmPaymentSchema>;
/** Least words an officer must write when confirming something they recorded themselves. */
export const MIN_SELF_NOTE = 5;

/** Counting a collector's handover. Zero is allowed (there was no cash). */
export const reconcileSchema = z.object({
  counted: nairaAmount('Enter the cash you counted in naira, for example 25,000. Enter 0 if there was none.', true),
  note: z.string().trim().max(500).optional().default(''),
  own: z.boolean().optional().default(false),
});
export type ReconcileValues = z.input<typeof reconcileSchema>;

/** Assigning contributors to a collector, with an optional daily target. */
export const assignCollectorSchema = z.object({
  target: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || nairaToKobo(v) !== null, 'Enter the daily target in naira, or leave it empty.'),
});
export type AssignCollectorValues = z.input<typeof assignCollectorSchema>;

/** Approving a payout: the password is typed again; the self-approval fields appear only when the server asks. */
export const approvePayoutSchema = z.object({
  password: z.string().min(1, 'Enter your password to approve this.'),
  self: z.boolean().optional().default(false),
  note: z.string().trim().max(500).optional().default(''),
});
export type ApprovePayoutValues = z.input<typeof approvePayoutSchema>;

/** Recording that a payout was paid from the circle's own account. */
export const recordPaidSchema = z.object({
  reference: z.string().trim().min(3, 'Enter the bank reference or transaction number for this transfer.').max(120, 'Keep it under 120 characters'),
  proof: attachment.nullable().optional(),
  own: z.boolean().optional().default(false),
  note: z.string().trim().max(500).optional().default(''),
});
export type RecordPaidValues = z.input<typeof recordPaidSchema>;

/** Closing a default case: the outcome, the reason, and the password typed again. */
export const closeCaseSchema = z.object({
  reason: z.string().trim().min(10, 'Write at least 10 characters. It stays on the record.').max(500),
  password: z.string().min(1, 'Enter your password to close this case.'),
});
export type CloseCaseValues = z.input<typeof closeCaseSchema>;

/** Thrift onboarding step 1: who the group is. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg'];
export const profileStepSchema = z.object({
  name: z.string().trim().min(2, 'The group name is 2 to 80 characters.').max(80, 'The group name is 2 to 80 characters.'),
  phone: z.string().trim().refine((v) => normalizeNigerianPhone(v) !== null, 'Enter a Nigerian phone number for the group, for example 08031234567.'),
  email: z.string().trim().refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'That email address does not look right.'),
  area: z.string().trim().max(120).optional().default(''),
  state: z.string().optional().default(''),
  logo: attachment.nullable().optional(),
});
export type ProfileStepValues = z.input<typeof profileStepSchema>;


/** Thrift onboarding step 4: one person to invite. */
export const teamInviteSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.').max(60),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(60),
  email: z.string().trim().email('Enter a valid email address.'),
});
export type TeamInviteValues = z.input<typeof teamInviteSchema>;
