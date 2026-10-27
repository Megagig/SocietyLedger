import { chargeMapping, receivableCodeFor, isChargeCategory } from '../../src/modules/accounting/posting-rules';

describe('which accounts a charge and its payment post to', () => {
  it('a charge debits its receivable and credits its income', () => {
    expect(chargeMapping('due')).toEqual({ debitCode: '1121', creditCode: '4110' });
    expect(chargeMapping('levy')).toEqual({ debitCode: '1122', creditCode: '4200' });
    expect(chargeMapping('penalty')).toEqual({ debitCode: '1121', creditCode: '4400' });
  });

  it('a donation is receivable like dues: Donation Pledges Receivable against Donation Income, never straight to the bank', () => {
    expect(chargeMapping('donation')).toEqual({ debitCode: '1123', creditCode: '4300' });
  });

  it('a payment clears the same receivable its charge created', () => {
    for (const type of ['due', 'levy', 'penalty', 'donation']) {
      expect(receivableCodeFor(type)).toBe(chargeMapping(type)!.debitCode);
    }
  });

  it('an unknown kind of charge has no charge mapping, and its payment falls back to dues as payments always have', () => {
    expect(chargeMapping('something-else')).toBeNull();
    expect(chargeMapping(undefined)).toBeNull();
    expect(receivableCodeFor('something-else')).toBe('1121');
    expect(isChargeCategory('donation')).toBe(true);
    expect(isChargeCategory('welfare')).toBe(false);
  });
});
