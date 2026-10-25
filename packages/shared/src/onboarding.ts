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

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key'];
export const ONBOARDING_STEP_KEYS = ONBOARDING_STEPS.map((s) => s.key) as [OnboardingStepKey, ...OnboardingStepKey[]];

/** The roles an officer can be invited with while setting up. */
export const ONBOARDING_TEAM_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'treasurer', label: 'Treasurer', description: 'Manage finances and payments' },
  { value: 'financial_secretary', label: 'Financial Secretary', description: 'Record transactions and dues' },
] as const;

export type OnboardingTeamRole = (typeof ONBOARDING_TEAM_ROLES)[number]['value'];
const TEAM_ROLE_VALUES = ONBOARDING_TEAM_ROLES.map((r) => r.value) as [OnboardingTeamRole, ...OnboardingTeamRole[]];

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
