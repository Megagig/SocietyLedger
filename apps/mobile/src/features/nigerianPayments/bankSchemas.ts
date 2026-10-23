import { z } from 'zod';

import type { BankAccountDTO, BankAccountPayload, BankTransferDetailDTO, NigerianBankDTO, RecordTransferPayload } from '@/types/api/bankManage';

const TEN_DIGITS = /^\d{10}$/;
const MONEY = /^\d+(\.\d{1,2})?$/;

// ---------------------------------------------------------------- bank accounts

export const bankAccountFormSchema = z.object({
  bankName: z.string().min(1, 'Choose the bank'),
  accountName: z.string().trim().min(2, 'Enter the account name'),
  accountNumber: z.string().trim().regex(TEN_DIGITS, 'Account numbers have exactly 10 digits'),
  description: z.string().trim(),
  isDefault: z.boolean(),
});

export type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

export function emptyBankAccountValues(isFirstAccount: boolean): BankAccountFormValues {
  // The first account is always the default (the API enforces it too), so it's pre-set and the switch is hidden.
  return { bankName: '', accountName: '', accountNumber: '', description: '', isDefault: isFirstAccount };
}

export function accountToFormValues(account: BankAccountDTO): BankAccountFormValues {
  return {
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    description: account.description ?? '',
    isDefault: account.isDefault,
  };
}

/** The API body; the bank's CBN code is looked up from the chosen bank's name. */
export function toAccountPayload(values: BankAccountFormValues, banks: NigerianBankDTO[]): BankAccountPayload {
  const bank = banks.find((b) => b.name === values.bankName);
  return {
    bankName: values.bankName,
    accountName: values.accountName.trim(),
    accountNumber: values.accountNumber.trim(),
    ...(bank ? { bankCode: bank.code } : {}),
    isDefault: values.isDefault,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

// ---------------------------------------------------------------- bank transfers

/** Who sent it, if the officer knows — id plus the name to show, since the form only holds what the picker returned. */
export type PickedMember = { id: number; name: string };

export function buildTransferFormSchema(options: { requireAccount: boolean }) {
  return z.object({
    member: z.object({ id: z.number(), name: z.string() }).nullable(),
    bankAccountId: options.requireAccount ? z.string().min(1, 'Choose the account it landed in') : z.string(),
    senderBankName: z.string().min(1, "Choose the sender's bank"),
    senderAccountNumber: z.string().trim().refine((value) => value === '' || TEN_DIGITS.test(value), 'Account numbers have exactly 10 digits'),
    senderAccountName: z.string().trim(),
    amount: z
      .string()
      .trim()
      .refine((value) => MONEY.test(value.replace(/,/g, '')) && Number(value.replace(/,/g, '')) > 0, 'Enter an amount above ₦0'),
    reference: z.string().trim().min(1, 'Enter the transfer reference'),
    transferDate: z.string().min(1, 'Choose the transfer date'),
    narration: z.string().trim(),
    notes: z.string().trim(),
  });
}

export type TransferFormValues = z.infer<ReturnType<typeof buildTransferFormSchema>>;

export function emptyTransferValues(defaultAccountId: number | null, now: Date = new Date()): TransferFormValues {
  return {
    member: null,
    bankAccountId: defaultAccountId ? String(defaultAccountId) : '',
    senderBankName: '',
    senderAccountNumber: '',
    senderAccountName: '',
    amount: '',
    reference: '',
    transferDate: now.toISOString(),
    narration: '',
    notes: '',
  };
}

export function transferToFormValues(transfer: BankTransferDetailDTO): TransferFormValues {
  return {
    member: transfer.member ? { id: transfer.member.id, name: `${transfer.member.firstName} ${transfer.member.lastName}`.trim() } : null,
    bankAccountId: transfer.bankAccountId ? String(transfer.bankAccountId) : '',
    senderBankName: transfer.senderBankName,
    senderAccountNumber: transfer.senderAccountNumber ?? '',
    senderAccountName: transfer.senderAccountName ?? '',
    amount: String(transfer.amount),
    reference: transfer.reference,
    transferDate: transfer.transferDate,
    narration: transfer.narration ?? '',
    notes: transfer.notes ?? '',
  };
}

const optional = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

/** The API body. Blanks are left out; the amount goes as a number (the API's schema is `z.number()`). */
export function toTransferPayload(values: TransferFormValues): RecordTransferPayload {
  return {
    ...(values.member ? { memberId: values.member.id } : {}),
    ...(values.bankAccountId ? { bankAccountId: Number(values.bankAccountId) } : {}),
    senderBankName: values.senderBankName,
    ...(optional(values.senderAccountNumber) ? { senderAccountNumber: values.senderAccountNumber.trim() } : {}),
    ...(optional(values.senderAccountName) ? { senderAccountName: values.senderAccountName.trim() } : {}),
    amount: Number(values.amount.replace(/,/g, '')),
    reference: values.reference.trim(),
    transferDate: values.transferDate,
    ...(optional(values.narration) ? { narration: values.narration.trim() } : {}),
    ...(optional(values.notes) ? { notes: values.notes.trim() } : {}),
  };
}
