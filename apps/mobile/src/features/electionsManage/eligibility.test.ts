import { emptyRulesValues, formValuesToRules, hasAnyRule, rulesProblem, rulesToFormValues } from './eligibility';

describe('the default', () => {
  it('a form with nothing switched on is no rule at all: every active member', () => {
    expect(formValuesToRules(emptyRulesValues())).toBeNull();
    expect(hasAnyRule(emptyRulesValues())).toBe(false);
    expect(rulesToFormValues(null)).toEqual(emptyRulesValues());
  });
});

describe('turning the form into a rule', () => {
  it('only what is switched on is in the rule, and voters and candidates are separate', () => {
    const values = emptyRulesValues();
    values.voters.financialOn = true;
    values.candidates.monthsOn = true;
    values.candidates.months = '24';
    values.candidates.mustBeVoter = true;
    expect(formValuesToRules(values)).toEqual({
      voters: { financialStanding: { maxOverdue: 0 } },
      candidates: { minMembershipMonths: 24, mustBeVoter: true },
    });
  });

  it('keeps an allowance, the chosen categories and the position limit', () => {
    const values = emptyRulesValues();
    values.voters.financialOn = true;
    values.voters.financialMax = '2500';
    values.voters.categoriesOn = true;
    values.voters.categories = ['regular', 'executive'];
    values.candidates.maxPositionsOn = true;
    values.candidates.maxPositions = '2';
    expect(formValuesToRules(values)).toEqual({
      voters: { financialStanding: { maxOverdue: 2500 }, categories: ['regular', 'executive'] },
      candidates: { maxPositions: 2 },
    });
  });

  it('a saved rule fills the form back in, and saving it again gives the same rule', () => {
    const rules = { voters: { categories: ['student'], minMembershipMonths: 6 }, candidates: { financialStanding: { maxOverdue: 0 }, maxPositions: 1 } };
    expect(formValuesToRules(rulesToFormValues(rules))).toEqual(rules);
  });
});

describe('what can not be saved yet', () => {
  it('names the problem in plain words', () => {
    const noCategory = emptyRulesValues();
    noCategory.voters.categoriesOn = true;
    expect(rulesProblem(noCategory)).toBe('For voting, choose at least one kind of member.');

    const badMonths = emptyRulesValues();
    badMonths.candidates.monthsOn = true;
    badMonths.candidates.months = '0';
    expect(rulesProblem(badMonths)).toBe('For standing, membership length must be a whole number of months.');

    const badAllowance = emptyRulesValues();
    badAllowance.voters.financialOn = true;
    badAllowance.voters.financialMax = '';
    expect(rulesProblem(badAllowance)).toBe('For voting, say how much a member may owe (0 for nothing overdue).');

    const badLimit = emptyRulesValues();
    badLimit.candidates.maxPositionsOn = true;
    badLimit.candidates.maxPositions = 'x';
    expect(rulesProblem(badLimit)).toBe('The most positions one person can stand for must be 1 or more.');
  });

  it('an empty form is fine', () => {
    expect(rulesProblem(emptyRulesValues())).toBeNull();
  });
});
