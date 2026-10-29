import { buildGroup, DEFAULT_RULES, defaultsForModel, INITIAL_GROUP, rulesFormToInput, rulesToForm, type GroupFormValues } from './groupForm';
import { todayIso } from './format';
import type { RuleVersionDTO } from '@/types/api/ajo';

const today = () => {
  const [y, m, d] = todayIso().split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0).toISOString();
};
const good: GroupFormValues = { ...INITIAL_GROUP, name: 'Market women', contribution: '500', startDate: today(), bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Women Circle' };

describe('buildGroup', () => {
  it('builds a collector thrift in kobo with the bank and the rules', () => {
    const built = buildGroup(good);
    expect('body' in built).toBe(true);
    if ('body' in built) {
      expect(built.body).toMatchObject({
        name: 'Market women',
        model: 'COLLECTOR_THRIFT',
        frequency: 'DAILY',
        contributionKobo: '50000',
        cycleLength: 31,
        maxParticipants: 30,
        maxSharesPerMember: 1,
        collectorFeeType: 'DAYS',
        collectorFeeValue: '1',
        cutoffTime: '18:00',
        bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Women Circle' },
      });
      expect(built.body.startDate).toBe(todayIso());
      expect(built.body.rules).toMatchObject({ lateFeeType: 'NONE', graceDays: 3, lateFeeCapKobo: null });
    }
  });

  it('turns a daily rotating pot into weekly and keeps shares', () => {
    const built = buildGroup({ ...good, model: 'ROTATING_POT', frequency: 'DAILY', collectorFeeType: 'NONE', maxParticipants: '10', maxShares: '2' });
    expect('body' in built && built.body).toMatchObject({ frequency: 'WEEKLY', cycleLength: null, maxSharesPerMember: 2, maxParticipants: 10 });
  });

  it('carries a custom cadence', () => {
    const built = buildGroup({ ...good, frequency: 'CUSTOM', customCount: '2', customUnit: 'WEEKS' });
    expect('body' in built && built.body).toMatchObject({ frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS' });
    expect(buildGroup({ ...good, frequency: 'CUSTOM', customCount: '0' })).toMatchObject({ step: 1 });
    expect(buildGroup({ ...good, frequency: 'CUSTOM', customCount: '61' })).toMatchObject({ step: 1 });
  });

  it('says what is wrong and on which step', () => {
    expect(buildGroup({ ...good, name: 'x' })).toMatchObject({ step: 0 });
    expect(buildGroup({ ...good, contribution: '' })).toMatchObject({ step: 1 });
    expect(buildGroup({ ...good, startDate: '' })).toMatchObject({ step: 1 });
    expect(buildGroup({ ...good, startDate: new Date(2020, 0, 5, 12).toISOString() })).toMatchObject({ step: 1, error: 'The start date must be today or later.' });
    expect(buildGroup({ ...good, collectorFeeType: 'PERCENT', collectorFeeValue: '150' })).toMatchObject({ step: 2 });
    expect(buildGroup({ ...good, cutoffTime: '6pm' })).toMatchObject({ step: 2 });
    expect(buildGroup({ ...good, accountNumber: '12345' })).toMatchObject({ step: 3 });
    expect(buildGroup({ ...good, rules: { ...DEFAULT_RULES, graceDays: '99' } })).toMatchObject({ step: 4 });
  });

  it('turns a collector percentage into basis points and a fixed fee into kobo', () => {
    const pct = buildGroup({ ...good, collectorFeeType: 'PERCENT', collectorFeeValue: '2.5' });
    expect('body' in pct && pct.body.collectorFeeValue).toBe('250');
    const fixed = buildGroup({ ...good, collectorFeeType: 'FIXED', collectorFeeValue: '1,000' });
    expect('body' in fixed && fixed.body.collectorFeeValue).toBe('100000');
  });
});

describe('rulesFormToInput', () => {
  it('converts a fixed late fee and its cap to kobo', () => {
    const built = rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'FIXED', lateFeeValue: '500', lateFeeCap: '2,000' });
    expect(built).toEqual({ input: expect.objectContaining({ lateFeeValue: '50000', lateFeeCapKobo: '200000' }) });
  });
  it('converts a percentage to basis points and refuses nonsense', () => {
    const built = rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'PERCENT', lateFeeValue: '5' });
    expect(built).toEqual({ input: expect.objectContaining({ lateFeeValue: '500', lateFeeCapKobo: null }) });
    expect('error' in rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'PERCENT', lateFeeValue: '0' })).toBe(true);
    expect('error' in rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'FIXED', lateFeeValue: '' })).toBe(true);
    expect('error' in rulesFormToInput({ ...DEFAULT_RULES, graceDays: '' })).toBe(true);
  });
  it('round-trips a published version into the form', () => {
    const version = {
      id: 1,
      version: 2,
      effectiveFrom: '2027-01-01T00:00:00.000Z',
      createdAt: '2027-01-01T00:00:00.000Z',
      summary: [],
      rules: { lateFeeType: 'FIXED', lateFeeValue: '50000', lateFeeCapKobo: '200000', graceDays: 5, guarantorPolicy: 'OPTIONAL', defaultProcedure: 'REPAYMENT_PLAN', remindersEnabled: false, blockAtRiskEarly: true },
    } as RuleVersionDTO;
    expect(rulesToForm(version)).toEqual({ lateFeeType: 'FIXED', lateFeeValue: '500.00', lateFeeCap: '2000.00', graceDays: '5', guarantorPolicy: 'OPTIONAL', defaultProcedure: 'REPAYMENT_PLAN', remindersEnabled: false, blockAtRiskEarly: true });
  });
});

describe('defaultsForModel', () => {
  it('changes the cadence and the collector fee with the kind of circle', () => {
    expect(defaultsForModel('ROTATING_POT')).toEqual({ frequency: 'MONTHLY', collectorFeeType: 'NONE', collectorFeeValue: '' });
    expect(defaultsForModel('COLLECTOR_THRIFT')).toEqual({ frequency: 'DAILY', collectorFeeType: 'DAYS', collectorFeeValue: '1' });
  });
});
