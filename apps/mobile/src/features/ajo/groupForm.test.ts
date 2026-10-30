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

  it('carries how a rotating pot decides its payout order, and sends nothing for collector thrift', () => {
    const pot = { ...good, model: 'ROTATING_POT' as const, frequency: 'MONTHLY' as const, collectorFeeType: 'NONE' as const, maxParticipants: '10', maxShares: '1' };
    const automatic = buildGroup(pot);
    expect('body' in automatic && automatic.body).toMatchObject({ orderMethod: 'RANDOM_DRAW' });
    const byAdmin = buildGroup({ ...pot, orderMethod: 'ADMIN_SET' });
    expect('body' in byAdmin && byAdmin.body).toMatchObject({ orderMethod: 'ADMIN_SET' });
    const thrift = buildGroup({ ...good, orderMethod: 'ADMIN_SET' });
    expect('body' in thrift && thrift.body).not.toHaveProperty('orderMethod');
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
      rules: { lateFeeType: 'FIXED', lateFeeValue: '50000', lateFeeCapKobo: '200000', graceDays: 5, guarantorPolicy: 'OPTIONAL', defaultProcedure: 'REPAYMENT_PLAN', remindersEnabled: false, blockAtRiskEarly: true, memberVisibility: 'OFF', nameDisplay: 'FULL' },
    } as RuleVersionDTO;
    expect(rulesToForm(version)).toEqual({ lateFeeType: 'FIXED', lateFeeValue: '500.00', lateFeeCap: '2000.00', graceDays: '5', guarantorPolicy: 'OPTIONAL', defaultProcedure: 'REPAYMENT_PLAN', remindersEnabled: false, blockAtRiskEarly: true, memberVisibility: 'OFF', nameDisplay: 'FULL' });
  });
});

describe('defaultsForModel', () => {
  it('changes the cadence and the collector fee with the kind of circle', () => {
    expect(defaultsForModel('ROTATING_POT')).toEqual({ frequency: 'MONTHLY', collectorFeeType: 'NONE', collectorFeeValue: '' });
    expect(defaultsForModel('COLLECTOR_THRIFT')).toEqual({ frequency: 'DAILY', collectorFeeType: 'DAYS', collectorFeeValue: '1' });
  });
});

describe('circle board visibility (spec §16)', () => {
  it('is on by default for a rotating pot and goes to the API', () => {
    const built = rulesFormToInput(DEFAULT_RULES, true);
    expect('input' in built && built.input).toMatchObject({ memberVisibility: 'FULL', nameDisplay: 'FIRST_INITIAL' });
  });

  it('is always sent as OFF for a collector-thrift scheme, whatever the form says', () => {
    const built = rulesFormToInput({ ...DEFAULT_RULES, memberVisibility: 'FULL' }, false);
    expect('input' in built && built.input.memberVisibility).toBe('OFF');
  });

  it('builds a collector-thrift circle with visibility off even when the rules form still says FULL', () => {
    const built = buildGroup({ ...INITIAL_GROUP, model: 'COLLECTOR_THRIFT', name: 'Market daily', contribution: '500', startDate: '2999-01-01T00:00:00.000Z', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market', rules: { ...DEFAULT_RULES, memberVisibility: 'FULL' } });
    expect('body' in built && built.body.rules?.memberVisibility).toBe('OFF');
  });
});
