// Phase 8 — the setup wizard a new association's admin walks through. One definition for web and mobile, so both show the same steps
// in the same order and send the same thing to the API.
import { z } from 'zod';

export const ONBOARDING_STEPS = [
  { id: 1, key: 'profile', name: 'Association profile', description: 'Your name, logo, contact details and colour' },
  { id: 2, key: 'team', name: 'Invite your team', description: 'Bring in the officers who will help run the association' },
  { id: 3, key: 'members', name: 'Add members', description: 'Add the people in your association' },
  { id: 4, key: 'finance', name: 'Set up finances', description: 'Dues, levies and the bank account members pay into' },
  { id: 5, key: 'complete', name: 'All done', description: 'Review what you set up' },
] as const;

/** The setup a standalone thrift group walks through instead. It has no association profile, dues, levies or finance setup. */
export const THRIFT_ONBOARDING_STEPS = [
  { id: 1, key: 'profile', name: 'Group profile', description: 'Your group\x27s name and contact details' },
  { id: 2, key: 'circle', name: 'Your first circle', description: 'Create the savings circle' },
  { id: 3, key: 'contributors', name: 'Contributors', description: 'Add the people who pay in' },
  { id: 4, key: 'team', name: 'Team and collectors', description: 'Invite a co-admin, officers and collectors' },
  { id: 5, key: 'review', name: 'Review and open', description: 'Check everything and open the circle' },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key'];
export type ThriftOnboardingStepKey = (typeof THRIFT_ONBOARDING_STEPS)[number]['key'];
export const ONBOARDING_STEP_KEYS = ONBOARDING_STEPS.map((s) => s.key) as [OnboardingStepKey, ...OnboardingStepKey[]];
/** Every key either flow uses; the API then checks the key against the tenant's own flow. */
export const ANY_ONBOARDING_STEP_KEYS = [...new Set([...ONBOARDING_STEPS, ...THRIFT_ONBOARDING_STEPS].map((s) => s.key))] as [string, ...string[]];

export type OnboardingFlow = 'ASSOCIATION' | 'THRIFT';
export type OnboardingStep = { readonly id: number; readonly key: string; readonly name: string; readonly description: string };

/** The steps for a tenant kind ('THRIFT_GROUP' gets the thrift flow, everything else the association one). */
export function onboardingStepsFor(kind: string | null | undefined): readonly OnboardingStep[] {
  return kind === 'THRIFT_GROUP' ? THRIFT_ONBOARDING_STEPS : ONBOARDING_STEPS;
}
export const onboardingFlowFor = (kind: string | null | undefined): OnboardingFlow => (kind === 'THRIFT_GROUP' ? 'THRIFT' : 'ASSOCIATION');

/** The roles an officer can be invited with while setting up. */
export const ONBOARDING_TEAM_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'treasurer', label: 'Treasurer', description: 'Manage finances and payments' },
  { value: 'financial_secretary', label: 'Financial Secretary', description: 'Record transactions and dues' },
] as const;

/** The roles a standalone thrift group can invite while setting up. Collector is only useful for a collector-thrift circle. */
export const THRIFT_ONBOARDING_TEAM_ROLES = [
  { value: 'admin', label: 'Co-admin', description: 'Approves payouts and manages everything' },
  { value: 'ajo_officer', label: 'Ajo officer', description: 'Runs circles day to day; cannot approve payouts' },
  { value: 'ajo_collector', label: 'Collector', description: 'Records collections from the contributors assigned to them' },
] as const;

export type OnboardingTeamRole = (typeof ONBOARDING_TEAM_ROLES)[number]['value'] | (typeof THRIFT_ONBOARDING_TEAM_ROLES)[number]['value'];
const TEAM_ROLE_VALUES = [...new Set([...ONBOARDING_TEAM_ROLES, ...THRIFT_ONBOARDING_TEAM_ROLES].map((r) => r.value))] as [OnboardingTeamRole, ...OnboardingTeamRole[]];
const THRIFT_TEAM_ROLE_VALUES: string[] = THRIFT_ONBOARDING_TEAM_ROLES.map((r) => r.value);
const ASSOCIATION_TEAM_ROLE_VALUES: string[] = ONBOARDING_TEAM_ROLES.map((r) => r.value);

/** Which of the roles above a tenant of this kind may invite with. */
export const teamRolesAllowedFor = (kind: string | null | undefined): string[] => (kind === 'THRIFT_GROUP' ? THRIFT_TEAM_ROLE_VALUES : ASSOCIATION_TEAM_ROLE_VALUES);

export const MAX_TEAM_INVITES = 20;

export const onboardingTeamInviteSchema = z.object({
  invites: z
    .array(
      z.object({
        firstName: z.string().trim().min(1, 'First name is required').max(60),
        lastName: z.string().trim().min(1, 'Last name is required').max(60),
        email: z.string().trim().toLowerCase().email('Enter a valid email address'),
        role: z.enum(TEAM_ROLE_VALUES, { errorMap: () => ({ message: 'Choose a role' }) }),
      }),
    )
    .min(1, 'Add at least one person')
    .max(MAX_TEAM_INVITES, `You can invite up to ${MAX_TEAM_INVITES} people at a time`),
});

export type OnboardingTeamInviteInput = z.infer<typeof onboardingTeamInviteSchema>;

/** Finance starter templates offered in the wizard (amounts are in naira). */
export const ONBOARDING_FINANCE_TEMPLATES = [
  { name: 'Monthly Dues', type: 'due', amount: 5000, frequency: 'monthly', description: 'Regular monthly membership dues' },
  { name: 'Annual Dues', type: 'due', amount: 50000, frequency: 'annual', description: 'Annual membership contribution' },
  { name: 'Building Levy', type: 'levy', amount: 10000, frequency: 'one-time', description: 'One-time building project levy' },
  { name: 'Late Payment Penalty', type: 'penalty', amount: 500, frequency: 'one-time', description: 'Penalty for late payments' },
] as const;

/** Colours offered as one-tap swatches for an association's brand colour (the person can still type any #rrggbb). */
export const BRAND_COLOUR_PRESETS = ['#1a7f5a', '#0e7490', '#4338ca', '#be123c', '#b45309', '#475569'] as const;
