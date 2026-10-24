import { RuleError } from '../../src/modules/finance/rule-error';
import {
  describeRule,
  evaluateEligibility,
  hasRules,
  monthsBetween,
  needsFinancials,
  normalizeRules,
  type MemberFacts,
} from '../../src/modules/voting/eligibility-rules';

const now = new Date('2027-01-15T12:00:00Z');
const facts = (over: Partial<MemberFacts> = {}): MemberFacts => ({ status: 'active', category: 'regular', joinDate: new Date('2024-01-01T00:00:00Z'), overdueOwed: 0, now, ...over });

describe('with no rule set (the default)', () => {
  it('every active member can vote and stand, exactly as before', () => {
    expect(evaluateEligibility('VOTE', { rules: null, facts: facts() }).eligible).toBe(true);
    expect(evaluateEligibility('STAND', { rules: null, facts: facts({ overdueOwed: 99999, category: 'student', joinDate: null }) }).eligible).toBe(true);
  });

  it('a member who is not active still cannot', () => {
    const result = evaluateEligibility('VOTE', { rules: null, facts: facts({ status: 'suspended' }) });
    expect(result).toMatchObject({ eligible: false, code: 'NOT_ACTIVE' });
    expect(result.reason).toBe('Only active members can vote.');
  });

  it('nothing is looked up for the ledger', () => {
    expect(hasRules(null)).toBe(false);
    expect(needsFinancials(null)).toBe(false);
  });
});

describe('financial standing', () => {
  const rules = normalizeRules({ voters: { financialStanding: { maxOverdue: 0 } } });

  it('refuses a member with anything overdue, and says how much', () => {
    const result = evaluateEligibility('VOTE', { rules, facts: facts({ overdueOwed: 5000 }) });
    expect(result).toMatchObject({ eligible: false, code: 'RULE_NOT_MET' });
    expect(result.reason).toBe('You have ₦5,000.00 overdue. Clear it to vote.');
  });

  it('lets in a member who owes nothing, or who has cleared it', () => {
    expect(evaluateEligibility('VOTE', { rules, facts: facts({ overdueOwed: 0 }) }).eligible).toBe(true);
  });

  it('can allow a small amount owed', () => {
    const lenient = normalizeRules({ voters: { financialStanding: { maxOverdue: 2000 } } });
    expect(evaluateEligibility('VOTE', { rules: lenient, facts: facts({ overdueOwed: 2000 }) }).eligible).toBe(true);
    const over = evaluateEligibility('VOTE', { rules: lenient, facts: facts({ overdueOwed: 2500.5 }) });
    expect(over.eligible).toBe(false);
    expect(over.reason).toBe('You owe ₦2,500.50 on overdue charges, and this election allows at most ₦2,000.00. Pay some of it to vote.');
  });

  it('only a rule that mentions money needs the ledger', () => {
    expect(needsFinancials(rules)).toBe(true);
    expect(needsFinancials(normalizeRules({ voters: { minMembershipMonths: 6 } }))).toBe(false);
  });

  it('applies to voters and candidates separately', () => {
    const candidatesOnly = normalizeRules({ candidates: { financialStanding: { maxOverdue: 0 } } });
    expect(evaluateEligibility('VOTE', { rules: candidatesOnly, facts: facts({ overdueOwed: 5000 }) }).eligible).toBe(true);
    expect(evaluateEligibility('STAND', { rules: candidatesOnly, facts: facts({ overdueOwed: 5000 }) }).eligible).toBe(false);
  });
});

describe('length of membership', () => {
  const rules = normalizeRules({ candidates: { minMembershipMonths: 12 } });

  it('counts whole months from the join date', () => {
    expect(monthsBetween(new Date('2026-01-15T00:00:00Z'), now)).toBe(12);
    expect(monthsBetween(new Date('2026-01-16T00:00:00Z'), now)).toBe(11);
    expect(monthsBetween(new Date('2028-01-01T00:00:00Z'), now)).toBe(0);
  });

  it('refuses a newer member, saying how long they have been one', () => {
    const result = evaluateEligibility('STAND', { rules, facts: facts({ joinDate: new Date('2026-09-15T00:00:00Z') }) });
    expect(result.reason).toBe('You need to have been a member for at least 12 months to stand; you have been one for 4.');
  });

  it('asks for the join date when it is missing, rather than guessing', () => {
    const result = evaluateEligibility('STAND', { rules, facts: facts({ joinDate: null }) });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch("join date isn't on record");
  });

  it('lets in a long-standing member', () => {
    expect(evaluateEligibility('STAND', { rules, facts: facts() }).eligible).toBe(true);
  });
});

describe('member category', () => {
  const rules = normalizeRules({ voters: { categories: ['Regular', 'Executive'] } });

  it('lets in the categories ticked, whatever the capitalisation', () => {
    expect(evaluateEligibility('VOTE', { rules, facts: facts({ category: 'REGULAR' }) }).eligible).toBe(true);
    expect(evaluateEligibility('VOTE', { rules, facts: facts({ category: 'executive' }) }).eligible).toBe(true);
  });

  it('refuses the rest, naming who can', () => {
    const result = evaluateEligibility('VOTE', { rules, facts: facts({ category: 'student' }) });
    expect(result.reason).toBe('Only regular and executive members can vote in this election.');
  });
});

describe('candidate-only conditions', () => {
  it('a candidate must also be allowed to vote, when the rule says so', () => {
    const rules = normalizeRules({ voters: { financialStanding: { maxOverdue: 0 } }, candidates: { mustBeVoter: true } });
    const result = evaluateEligibility('STAND', { rules, facts: facts({ overdueOwed: 1000 }) });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('To stand, you also need to be allowed to vote. You have ₦1,000.00 overdue. Clear it to vote.');
  });

  it('a member the committee allowed to vote counts as allowed to vote', () => {
    const rules = normalizeRules({ voters: { financialStanding: { maxOverdue: 0 } }, candidates: { mustBeVoter: true } });
    expect(evaluateEligibility('STAND', { rules, facts: facts({ overdueOwed: 1000 }), voteException: 'ALLOW' }).eligible).toBe(true);
  });

  it('limits how many positions one person can stand for', () => {
    const rules = normalizeRules({ candidates: { maxPositions: 2 } });
    expect(evaluateEligibility('STAND', { rules, facts: facts(), currentCandidacies: 1 }).eligible).toBe(true);
    const result = evaluateEligibility('STAND', { rules, facts: facts(), currentCandidacies: 2 });
    expect(result).toMatchObject({ eligible: false, code: 'MAX_POSITIONS' });
    expect(result.reason).toBe('You already stand for 2 positions, which is the most one person can in this election.');
  });
});

describe('exceptions made by the committee', () => {
  const rules = normalizeRules({ voters: { financialStanding: { maxOverdue: 0 } } });

  it('let a named member in whatever the rule says', () => {
    expect(evaluateEligibility('VOTE', { rules, facts: facts({ overdueOwed: 5000 }), exception: 'ALLOW' }).eligible).toBe(true);
  });

  it('keep a named member out even when they meet the rule', () => {
    const result = evaluateEligibility('VOTE', { rules, facts: facts(), exception: 'BAR' });
    expect(result).toMatchObject({ eligible: false, code: 'BARRED' });
  });

  it("can't make an inactive member eligible", () => {
    expect(evaluateEligibility('VOTE', { rules, facts: facts({ status: 'inactive' }), exception: 'ALLOW' }).eligible).toBe(false);
  });
});

describe('saving a rule', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(RuleError);
      return (e as RuleError).code;
    }
    return null;
  };

  it('keeps only what is switched on, and nothing means the default', () => {
    expect(normalizeRules(null)).toBeNull();
    expect(normalizeRules({})).toBeNull();
    expect(normalizeRules({ voters: {}, candidates: { mustBeVoter: false, minMembershipMonths: null } })).toBeNull();
    expect(normalizeRules({ voters: { minMembershipMonths: 6 } })).toEqual({ voters: { minMembershipMonths: 6 } });
  });

  it('lowercases the categories so they compare the same way', () => {
    expect(normalizeRules({ voters: { categories: [' Regular '] } })).toEqual({ voters: { categories: ['regular'] } });
  });

  it('refuses conditions it does not know, and settings that make no sense', () => {
    expect(code(() => normalizeRules({ voters: { livesInLagos: true } }))).toBe('BAD_ELIGIBILITY_RULE');
    expect(code(() => normalizeRules({ voters: { mustBeVoter: true } }))).toBe('BAD_ELIGIBILITY_RULE'); // candidates only
    expect(code(() => normalizeRules({ voters: { minMembershipMonths: 0 } }))).toBe('BAD_ELIGIBILITY_RULE');
    expect(code(() => normalizeRules({ voters: { financialStanding: { maxOverdue: -1 } } }))).toBe('BAD_ELIGIBILITY_RULE');
    expect(code(() => normalizeRules({ voters: { categories: [] } }))).toBe('BAD_ELIGIBILITY_RULE');
    expect(code(() => normalizeRules({ candidates: { maxPositions: 0 } }))).toBe('BAD_ELIGIBILITY_RULE');
    expect(code(() => normalizeRules({ everyone: {} }))).toBe('BAD_ELIGIBILITY_RULE');
    expect(code(() => normalizeRules('yes'))).toBe('BAD_ELIGIBILITY_RULE');
  });

  it('describes a rule in plain words', () => {
    const rules = normalizeRules({ candidates: { financialStanding: { maxOverdue: 0 }, minMembershipMonths: 12, categories: ['regular'], mustBeVoter: true, maxPositions: 1 } });
    expect(describeRule(rules?.candidates)).toEqual([
      'Has no overdue charges',
      'Has been a member for at least 12 months',
      'Is one of: Regular',
      'Must also be allowed to vote',
      'Can stand for at most 1 position',
    ]);
    expect(describeRule(undefined)).toEqual([]);
  });
});
