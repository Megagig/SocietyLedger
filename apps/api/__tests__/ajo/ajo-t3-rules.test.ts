import { moveWithinUnpaid } from '../../src/modules/ajo/ajo-draw';
import { guarantorWording } from '../../src/modules/ajo/ajo-consent.service';
import { changedFields, resolveGroupFields, validateBank, MONEY_FIELDS } from '../../src/modules/ajo/ajo-group.service';
import { assertGroupTakesJoiners, unmetRequirements } from '../../src/modules/ajo/ajo-membership.service';
import { DEFAULT_RULES, describeRules, normaliseRules, sameRules } from '../../src/modules/ajo/ajo-rules.service';

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

const approved = new Date('2027-01-05T10:00:00Z');
const base = { approvedAt: approved, requirePhoneConfirm: false, phoneConfirmedNumber: null, memberPhone: '08031234567' };

describe('Ajo requirements: rules and guarantor join the list', () => {
  it('needs the rules accepted when the group has any, and accepting a newer version also counts', () => {
    expect(unmetRequirements({ ...base, currentRuleVersion: 2, acceptedRuleVersion: null })).toEqual(['RULE_ACCEPTANCE']);
    expect(unmetRequirements({ ...base, currentRuleVersion: 2, acceptedRuleVersion: 1 })).toEqual(['RULE_ACCEPTANCE']);
    expect(unmetRequirements({ ...base, currentRuleVersion: 2, acceptedRuleVersion: 2 })).toEqual([]);
    expect(unmetRequirements({ ...base, currentRuleVersion: 2, acceptedRuleVersion: 3 })).toEqual([]);
  });

  it('asks for nothing about rules when the group has none', () => {
    expect(unmetRequirements({ ...base, currentRuleVersion: null })).toEqual([]);
    expect(unmetRequirements(base)).toEqual([]);
  });

  it('needs the guarantor only when the rules require one', () => {
    expect(unmetRequirements({ ...base, guarantorPolicy: 'REQUIRED', guarantorConsentAt: null })).toEqual(['GUARANTOR_CONSENT']);
    expect(unmetRequirements({ ...base, guarantorPolicy: 'REQUIRED', guarantorConsentAt: approved })).toEqual([]);
    expect(unmetRequirements({ ...base, guarantorPolicy: 'OPTIONAL', guarantorConsentAt: null })).toEqual([]);
    expect(unmetRequirements({ ...base, guarantorPolicy: 'NOT_REQUIRED' })).toEqual([]);
  });

  it('lists everything missing at once, in a fixed order', () => {
    expect(unmetRequirements({ approvedAt: null, requirePhoneConfirm: true, phoneConfirmedNumber: null, memberPhone: '08031234567', currentRuleVersion: 1, acceptedRuleVersion: null, guarantorPolicy: 'REQUIRED', guarantorConsentAt: null })).toEqual(['APPROVAL', 'PHONE_CONFIRMATION', 'RULE_ACCEPTANCE', 'GUARANTOR_CONSENT']);
  });
});

describe('Ajo who can still join', () => {
  it('takes nobody into a draft or a closed group', () => {
    expect(codeOf(() => assertGroupTakesJoiners({ status: 'DRAFT', model: 'COLLECTOR_THRIFT', allowLateJoin: true }))).toBe('GROUP_NOT_OPEN');
    expect(codeOf(() => assertGroupTakesJoiners({ status: 'CANCELLED', model: 'COLLECTOR_THRIFT', allowLateJoin: true }))).toBe('GROUP_CLOSED');
    expect(codeOf(() => assertGroupTakesJoiners({ status: 'COMPLETED', model: 'ROTATING_POT', allowLateJoin: true }))).toBe('GROUP_CLOSED');
  });

  it('takes anyone into an open group', () => {
    expect(() => assertGroupTakesJoiners({ status: 'OPEN', model: 'ROTATING_POT', allowLateJoin: false })).not.toThrow();
  });

  it('freezes a started rotating pot, and a started thrift group only when late joining is off', () => {
    expect(codeOf(() => assertGroupTakesJoiners({ status: 'ACTIVE', model: 'ROTATING_POT', allowLateJoin: true }))).toBe('ROSTER_FROZEN');
    expect(codeOf(() => assertGroupTakesJoiners({ status: 'ACTIVE', model: 'COLLECTOR_THRIFT', allowLateJoin: false }))).toBe('LATE_JOIN_CLOSED');
    expect(() => assertGroupTakesJoiners({ status: 'ACTIVE', model: 'COLLECTOR_THRIFT', allowLateJoin: true })).not.toThrow();
  });
});

describe('Ajo rules validation', () => {
  it('starts from the safe defaults: no late fee, three grace days, reminders on, guarantor optional', () => {
    const rules = normaliseRules();
    expect(rules).toEqual(DEFAULT_RULES);
    expect(rules).toMatchObject({ lateFeeType: 'NONE', graceDays: 3, remindersEnabled: true, guarantorPolicy: 'OPTIONAL' });
  });

  it('accepts a fixed fee with a cap and a percentage fee', () => {
    expect(normaliseRules({ lateFeeType: 'FIXED', lateFeeValue: 50_000n, lateFeeCapKobo: 150_000n })).toMatchObject({ lateFeeType: 'FIXED', lateFeeValue: 50_000n, lateFeeCapKobo: 150_000n });
    expect(normaliseRules({ lateFeeType: 'PERCENT', lateFeeValue: 500 }).lateFeeValue).toBe(500n);
  });

  it('refuses nonsense with a readable message', () => {
    expect(() => normaliseRules({ lateFeeType: 'FIXED' })).toThrow(/amount/);
    expect(() => normaliseRules({ lateFeeType: 'PERCENT', lateFeeValue: 10_001 })).toThrow(/100%/);
    expect(() => normaliseRules({ lateFeeType: 'FIXED', lateFeeValue: -5 })).toThrow();
    expect(() => normaliseRules({ graceDays: 31 })).toThrow(/grace/);
    expect(() => normaliseRules({ graceDays: 1.5 })).toThrow();
    expect(() => normaliseRules({ guarantorPolicy: 'MAYBE' as never })).toThrow();
    expect(() => normaliseRules({ lateFeeType: 'DAYS' as never, lateFeeValue: 1 })).toThrow(/late fee/);
  });

  it('turns a late fee off cleanly: no value and no cap left behind', () => {
    const base = normaliseRules({ lateFeeType: 'FIXED', lateFeeValue: 50_000n, lateFeeCapKobo: 150_000n });
    const off = normaliseRules({ lateFeeType: 'NONE' }, base);
    expect(off).toMatchObject({ lateFeeType: 'NONE', lateFeeValue: 0n, lateFeeCapKobo: null });
  });

  it('builds on the current version, so a change only has to send what is different', () => {
    const v1 = normaliseRules({ graceDays: 5, guarantorPolicy: 'REQUIRED' });
    const v2 = normaliseRules({ graceDays: 7 }, v1);
    expect(v2).toMatchObject({ graceDays: 7, guarantorPolicy: 'REQUIRED' });
    expect(sameRules(v1, v2)).toBe(false);
    expect(sameRules(v1, normaliseRules({}, v1))).toBe(true);
  });

  it('describes the rules in plain words with money in full', () => {
    const text = describeRules(normaliseRules({ lateFeeType: 'FIXED', lateFeeValue: 50_000n, lateFeeCapKobo: 150_000n, guarantorPolicy: 'REQUIRED' })).join(' ');
    expect(text).toContain('₦500.00');
    expect(text).toContain('₦1,500.00');
    expect(text).toContain('required before you can join');
    expect(text).not.toMatch(/\b\d+k\b/);
  });
});

describe('Ajo group fields', () => {
  const thrift = { name: 'Market Circle', model: 'COLLECTOR_THRIFT' as const, frequency: 'DAILY' as const, contributionKobo: 100_000, startDate: '2027-03-01', cycleLength: 30, maxParticipants: 20 };
  const pot = { name: 'Aba Pot', model: 'ROTATING_POT' as const, frequency: 'MONTHLY' as const, contributionKobo: 5_000_000, startDate: '2027-03-01', maxParticipants: 10 };

  it('resolves a collector-thrift group with sensible defaults', () => {
    const f = resolveGroupFields(null, thrift);
    expect(f).toMatchObject({ cycleLength: 30, timezone: 'Africa/Lagos', cutoffTime: '18:00', collectorFeeType: 'NONE', collectorFeeValue: 0n, maxSharesPerMember: 1, allowLateJoin: true, requirePhoneConfirm: false });
    expect(f.startDate.toISOString()).toBe('2027-03-01T00:00:00.000Z');
    expect(f.contributionKobo).toBe(100_000n);
  });

  it('gives a rotating pot no cycle length and a share limit', () => {
    expect(resolveGroupFields(null, { ...pot, cycleLength: 12 })).toMatchObject({ cycleLength: null, maxSharesPerMember: 2 });
    expect(() => resolveGroupFields(null, { ...pot, maxParticipants: 1 })).toThrow(/at least 2/);
    expect(() => resolveGroupFields(null, { ...pot, maxSharesPerMember: 6 })).toThrow(/1 and 5/);
  });

  it('forces one share in collector thrift', () => {
    expect(resolveGroupFields(null, { ...thrift, maxSharesPerMember: 4 }).maxSharesPerMember).toBe(1);
  });

  it('refuses a missing or bad value', () => {
    expect(() => resolveGroupFields(null, { ...thrift, cycleLength: null })).toThrow(/cycle/);
    expect(() => resolveGroupFields(null, { ...thrift, contributionKobo: 0 })).toThrow(/more than zero/);
    expect(() => resolveGroupFields(null, { ...thrift, contributionKobo: '2000000000' })).toThrow(/largest/);
    expect(() => resolveGroupFields(null, { ...thrift, startDate: 'soon' })).toThrow(/start date/);
    expect(() => resolveGroupFields(null, { ...thrift, timezone: 'Mars/Base' })).toThrow(/timezone/);
    expect(() => resolveGroupFields(null, { ...thrift, cutoffTime: '25:00' })).toThrow(/cutoff/);
    expect(() => resolveGroupFields(null, { ...thrift, name: ' ' })).toThrow(/name/);
    expect(() => resolveGroupFields(null, { ...thrift, collectorFeeType: 'FIXED' })).toThrow(/amount/);
    expect(() => resolveGroupFields(null, { ...thrift, collectorFeeType: 'DAYS', collectorFeeValue: 40 })).toThrow(/1 and 31/);
    expect(() => resolveGroupFields(null, { name: 'x' })).toThrow();
  });

  it('checks the whole result of an update, not just the patch', () => {
    const current = resolveGroupFields(null, thrift);
    expect(() => resolveGroupFields(current, { cycleLength: null })).toThrow(/cycle/);
    expect(() => resolveGroupFields(current, { model: 'ROTATING_POT', maxParticipants: 1 })).toThrow(/at least 2/);
  });

  it('reports only values that actually changed, so sending the same value again is not a change', () => {
    const current = resolveGroupFields(null, thrift);
    expect(changedFields(current, resolveGroupFields(current, { name: 'Market Circle', startDate: '2027-03-01', contributionKobo: '100000' }))).toEqual([]);
    expect(changedFields(current, resolveGroupFields(current, { contributionKobo: 200_000, name: 'Renamed' })).sort()).toEqual(['contributionKobo', 'name']);
  });

  it('lists what counts as a money field (locked once a group starts) and leaves the name and the places alone', () => {
    for (const k of ['contributionKobo', 'frequency', 'startDate', 'cycleLength', 'model', 'cutoffTime', 'collectorFeeType']) expect(MONEY_FIELDS).toContain(k);
    for (const k of ['name', 'maxParticipants', 'allowLateJoin']) expect(MONEY_FIELDS).not.toContain(k);
  });

  it('checks a bank account: ten digits, a bank and a name', () => {
    expect(validateBank({ bankName: ' GTBank ', accountNumber: '0123 456 789', accountName: 'Market Circle' })).toEqual({ bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle' });
    expect(() => validateBank({ bankName: 'GTBank', accountNumber: '12345', accountName: 'Market Circle' })).toThrow(/10 digits/);
    expect(() => validateBank({ bankName: '', accountNumber: '0123456789', accountName: 'Market Circle' })).toThrow(/bank/i);
    expect(() => validateBank({ bankName: 'GTBank', accountNumber: '0123456789', accountName: '' })).toThrow(/name/);
  });
});

describe('Ajo emergency exception: moving within the unpaid slots', () => {
  // Positions 1..6; 1 and 2 are paid.
  const slots = [1, 2, 3, 4, 5, 6].map((p) => ({ id: p * 10, position: p }));
  const paid = new Set([1, 2]);
  const apply = (changes: Array<{ id: number; to: number }>) => {
    const next = new Map(slots.map((s) => [s.id, s.position]));
    for (const c of changes) next.set(c.id, c.to);
    return [...next.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id / 10);
  };

  it('moves a slot earlier and shifts the ones between it and its new place, keeping their order', () => {
    expect(apply(moveWithinUnpaid(slots, paid, 60, 3))).toEqual([1, 2, 6, 3, 4, 5]);
  });

  it('moves a slot later the same way', () => {
    expect(apply(moveWithinUnpaid(slots, paid, 30, 6))).toEqual([1, 2, 4, 5, 6, 3]);
  });

  it('never touches a paid position', () => {
    for (const [slot, to] of [[30, 6], [40, 3], [50, 3], [60, 4]]) {
      const changes = moveWithinUnpaid(slots, paid, slot, to);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.every((c) => !paid.has(c.from) && !paid.has(c.to))).toBe(true);
    }
  });

  it('refuses to move a paid slot, to move onto a paid position, or to move nowhere', () => {
    expect(() => moveWithinUnpaid(slots, paid, 10, 4)).toThrow(/already been paid/);
    expect(() => moveWithinUnpaid(slots, paid, 40, 1)).toThrow(/not been paid/);
    expect(() => moveWithinUnpaid(slots, paid, 40, 4)).toThrow(/already in that position/);
    expect(() => moveWithinUnpaid(slots, paid, 999, 4)).toThrow(/not part/);
  });

  it('keeps every position used exactly once', () => {
    const changes = moveWithinUnpaid(slots, paid, 50, 3);
    const final = slots.map((s) => changes.find((c) => c.id === s.id)?.to ?? s.position).sort((a, b) => a - b);
    expect(final).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('Ajo guarantor wording', () => {
  const text = guarantorWording({ guarantorName: 'Mrs Ngozi Eze', memberName: 'Adaeze Okafor', groupName: 'Market Circle' });

  it('names everyone and says plainly that it is a recorded consent, not a legal guarantee', () => {
    expect(text).toContain('Mrs Ngozi Eze');
    expect(text).toContain('Adaeze Okafor');
    expect(text).toContain('Market Circle');
    expect(text).toMatch(/not a legal guarantee/);
    expect(text).toMatch(/not been asked to pay anything/);
  });

  it('is the same words every time for the same people', () => {
    expect(guarantorWording({ guarantorName: 'Mrs Ngozi Eze', memberName: 'Adaeze Okafor', groupName: 'Market Circle' })).toBe(text);
  });
});
