import type { ChargeListItemDTO } from '@/types/api/financeManage';
import { chargeCanDelete, chargeCanEdit, chargeCanPay, chargeCanVoid, chargeStatusKey, chargeStatusLabel, collectionRate } from './labels';

type Charge = Pick<ChargeListItemDTO, 'status' | 'isVoided' | 'totalPaid' | 'balance'>;
const charge = (over: Partial<Charge> = {}): Charge => ({ status: 'pending', isVoided: false, totalPaid: '0', balance: '5000', ...over });

describe('what can be done to a charge', () => {
  it('an unpaid charge can be edited, deleted and paid — not voided', () => {
    const c = charge();
    expect([chargeCanEdit(c), chargeCanDelete(c), chargeCanPay(c), chargeCanVoid(c)]).toEqual([true, true, true, false]);
  });

  it('a part-paid charge can be voided and paid on — not edited or deleted (undo would lose its payments)', () => {
    const c = charge({ status: 'partial', totalPaid: '2000', balance: '3000' });
    expect([chargeCanEdit(c), chargeCanDelete(c), chargeCanPay(c), chargeCanVoid(c)]).toEqual([false, false, true, true]);
  });

  it('a fully paid charge can only be voided', () => {
    const c = charge({ status: 'paid', totalPaid: '5000', balance: '0' });
    expect([chargeCanEdit(c), chargeCanDelete(c), chargeCanPay(c), chargeCanVoid(c)]).toEqual([false, false, false, true]);
  });

  it('a voided charge allows nothing', () => {
    const c = charge({ isVoided: true, totalPaid: '1000', balance: '4000' });
    expect([chargeCanEdit(c), chargeCanDelete(c), chargeCanPay(c), chargeCanVoid(c)]).toEqual([false, false, false, false]);
  });
});

describe('charge status wording', () => {
  it('uses plain words and shows Voided whatever the old status was', () => {
    expect(chargeStatusLabel(charge())).toBe('Unpaid');
    expect(chargeStatusLabel(charge({ status: 'partial' }))).toBe('Part paid');
    expect(chargeStatusLabel(charge({ status: 'paid', isVoided: true }))).toBe('Voided');
    expect(chargeStatusKey(charge({ isVoided: true }))).toBe('cancelled');
    expect(chargeStatusKey(charge({ status: 'overdue' }))).toBe('overdue');
  });
});

describe('collectionRate', () => {
  it('is the share of everything billed that has been collected', () => {
    expect(collectionRate(75, 25)).toBe(75);
    expect(collectionRate(0, 0)).toBe(0);
    expect(collectionRate(100, 0)).toBe(100);
  });
});
