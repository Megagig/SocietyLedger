import type { BankAccountDTO } from '@/types/api/bankManage';
import {
  accountToFormValues,
  bankAccountFormSchema,
  buildTransferFormSchema,
  emptyBankAccountValues,
  emptyTransferValues,
  toAccountPayload,
  toTransferPayload,
} from './bankSchemas';

const banks = [
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '044', name: 'Access Bank' },
];

describe('bank account form', () => {
  const valid = { bankName: 'Guaranty Trust Bank', accountName: 'Opuogun State Union', accountNumber: '0123456789', description: '', isDefault: false };

  it('accepts a bank, a name and a 10-digit number', () => {
    expect(bankAccountFormSchema.safeParse(valid).success).toBe(true);
  });

  it('wants exactly 10 digits for the number', () => {
    expect(bankAccountFormSchema.safeParse({ ...valid, accountNumber: '012345678' }).success).toBe(false);
    expect(bankAccountFormSchema.safeParse({ ...valid, accountNumber: '01234567890' }).success).toBe(false);
    expect(bankAccountFormSchema.safeParse({ ...valid, accountNumber: '01234567ab' }).success).toBe(false);
  });

  it('wants a bank and an account name', () => {
    expect(bankAccountFormSchema.safeParse({ ...valid, bankName: '' }).success).toBe(false);
    expect(bankAccountFormSchema.safeParse({ ...valid, accountName: 'A' }).success).toBe(false);
  });

  it('pre-sets the first account as the default', () => {
    expect(emptyBankAccountValues(true).isDefault).toBe(true);
    expect(emptyBankAccountValues(false).isDefault).toBe(false);
  });

  it("sends the bank's CBN code, and leaves out a blank description", () => {
    expect(toAccountPayload(valid, banks)).toEqual({
      bankName: 'Guaranty Trust Bank',
      accountName: 'Opuogun State Union',
      accountNumber: '0123456789',
      bankCode: '058',
      isDefault: false,
    });
  });

  it('prefills the edit form from an account', () => {
    const account = { id: 1, bankName: 'Access Bank', accountName: 'Union', accountNumber: '1111111111', isDefault: true, description: null } as BankAccountDTO;
    expect(accountToFormValues(account)).toEqual({ bankName: 'Access Bank', accountName: 'Union', accountNumber: '1111111111', description: '', isDefault: true });
  });
});

describe('record transfer form', () => {
  const filled = () => ({
    ...emptyTransferValues(4, new Date('2026-10-24T09:00:00.000Z')),
    senderBankName: 'Access Bank',
    amount: '25,000.50',
    reference: ' TRF-1 ',
  });

  it('accepts the minimum: sender bank, amount, reference, date and a receiving account', () => {
    expect(buildTransferFormSchema({ requireAccount: true }).safeParse(filled()).success).toBe(true);
  });

  it('requires the receiving account only when the association has one', () => {
    const noAccount = { ...filled(), bankAccountId: '' };
    expect(buildTransferFormSchema({ requireAccount: true }).safeParse(noAccount).success).toBe(false);
    expect(buildTransferFormSchema({ requireAccount: false }).safeParse(noAccount).success).toBe(true);
  });

  it.each(['', '0', '-5', 'abc', '12.345'])('refuses the amount %j', (amount) => {
    expect(buildTransferFormSchema({ requireAccount: false }).safeParse({ ...filled(), amount }).success).toBe(false);
  });

  it("checks the sender's account number only when one is given", () => {
    const schema = buildTransferFormSchema({ requireAccount: false });
    expect(schema.safeParse({ ...filled(), senderAccountNumber: '' }).success).toBe(true);
    expect(schema.safeParse({ ...filled(), senderAccountNumber: '12345' }).success).toBe(false);
  });

  it('builds the API body: amount as a number, trimmed reference, blanks left out', () => {
    expect(toTransferPayload({ ...filled(), member: { id: 40, name: 'Ngozi Eze' } })).toEqual({
      memberId: 40,
      bankAccountId: 4,
      senderBankName: 'Access Bank',
      amount: 25000.5,
      reference: 'TRF-1',
      transferDate: '2026-10-24T09:00:00.000Z',
    });
  });

  it('defaults the receiving account to the default one', () => {
    expect(emptyTransferValues(7).bankAccountId).toBe('7');
    expect(emptyTransferValues(null).bankAccountId).toBe('');
  });
});
