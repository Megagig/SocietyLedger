import type { CandidateRuleDTO, EligibilityRulesDTO, MemberRuleDTO } from '@/types/api/electionsManage';

/**
 * The form side of "who can vote and who can stand". Each condition is a switch and, where it needs one, a value; a condition that is
 * switched off isn't part of the rule at all. With every switch off the rule is `null`, which means every active member (the default).
 */
export type MemberRuleFormValues = {
  financialOn: boolean;
  /** The most a member may owe on overdue charges, in naira. "0" means nothing overdue. */
  financialMax: string;
  monthsOn: boolean;
  months: string;
  categoriesOn: boolean;
  categories: string[];
};

export type RulesFormValues = {
  voters: MemberRuleFormValues;
  candidates: MemberRuleFormValues & { mustBeVoter: boolean; maxPositionsOn: boolean; maxPositions: string };
};

const emptyMember = (): MemberRuleFormValues => ({ financialOn: false, financialMax: '0', monthsOn: false, months: '12', categoriesOn: false, categories: [] });

export const emptyRulesValues = (): RulesFormValues => ({
  voters: emptyMember(),
  candidates: { ...emptyMember(), mustBeVoter: false, maxPositionsOn: false, maxPositions: '1' },
});

const memberToForm = (rule: MemberRuleDTO | undefined): MemberRuleFormValues => ({
  financialOn: !!rule?.financialStanding,
  financialMax: String(rule?.financialStanding?.maxOverdue ?? 0),
  monthsOn: rule?.minMembershipMonths !== undefined,
  months: String(rule?.minMembershipMonths ?? 12),
  categoriesOn: rule?.categories !== undefined,
  categories: rule?.categories ?? [],
});

export function rulesToFormValues(rules: EligibilityRulesDTO | null | undefined): RulesFormValues {
  return {
    voters: memberToForm(rules?.voters),
    candidates: {
      ...memberToForm(rules?.candidates),
      mustBeVoter: !!rules?.candidates?.mustBeVoter,
      maxPositionsOn: rules?.candidates?.maxPositions !== undefined,
      maxPositions: String(rules?.candidates?.maxPositions ?? 1),
    },
  };
}

const memberFromForm = (v: MemberRuleFormValues): MemberRuleDTO => ({
  ...(v.financialOn ? { financialStanding: { maxOverdue: Number(v.financialMax) || 0 } } : {}),
  ...(v.monthsOn ? { minMembershipMonths: Number(v.months) } : {}),
  ...(v.categoriesOn ? { categories: v.categories } : {}),
});

/** The rule the form describes, or null when nothing is switched on. */
export function formValuesToRules(values: RulesFormValues): EligibilityRulesDTO | null {
  const voters = memberFromForm(values.voters);
  const candidates: CandidateRuleDTO = {
    ...memberFromForm(values.candidates),
    ...(values.candidates.mustBeVoter ? { mustBeVoter: true } : {}),
    ...(values.candidates.maxPositionsOn ? { maxPositions: Number(values.candidates.maxPositions) } : {}),
  };
  const out: EligibilityRulesDTO = {
    ...(Object.keys(voters).length > 0 ? { voters } : {}),
    ...(Object.keys(candidates).length > 0 ? { candidates } : {}),
  };
  return out.voters || out.candidates ? out : null;
}

/** Why the form can't be saved yet, in plain words, or null. */
export function rulesProblem(values: RulesFormValues): string | null {
  for (const [label, v] of [['voting', values.voters], ['standing', values.candidates]] as const) {
    if (v.financialOn && !(Number(v.financialMax) >= 0 && v.financialMax.trim() !== '')) return `For ${label}, say how much a member may owe (0 for nothing overdue).`;
    if (v.monthsOn && !/^[1-9]\d*$/.test(v.months.trim())) return `For ${label}, membership length must be a whole number of months.`;
    if (v.categoriesOn && v.categories.length === 0) return `For ${label}, choose at least one kind of member.`;
  }
  if (values.candidates.maxPositionsOn && !/^[1-9]\d*$/.test(values.candidates.maxPositions.trim())) return 'The most positions one person can stand for must be 1 or more.';
  return null;
}

/** Whether any condition is on: what decides between "every active member" and "only some". */
export const hasAnyRule = (values: RulesFormValues): boolean => formValuesToRules(values) !== null;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const categoryLabel = titleCase;
