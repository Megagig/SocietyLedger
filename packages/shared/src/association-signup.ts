// Phase 8 — what an association signup collects, validated the same way on the API, web and mobile.
import { z } from 'zod';
import { RESERVED_SUBDOMAINS } from './reserved-subdomains';

export const ASSOCIATION_TYPE_OTHER = 'other';

/**
 * The kinds of association, used at signup and in Settings > Association on web and mobile. "Other" lets the founder type their own
 * (kept in `customAssociationType`). The first nine keys are the ones that already existed in Settings, so saved values stay valid.
 */
export const ASSOCIATION_TYPES = [
  { key: 'general', label: 'General association' },
  { key: 'town_union', label: 'Town union' },
  { key: 'alumni', label: 'Alumni association' },
  { key: 'religious', label: 'Religious organization' },
  { key: 'professional', label: 'Professional association' },
  { key: 'cooperative', label: 'Cooperative society' },
  { key: 'club', label: 'Social club' },
  { key: 'hoa', label: 'Homeowners association (HOA)' },
  { key: 'investment', label: 'Investment club' },
  { key: 'age_grade', label: 'Age grade' },
  { key: 'trade', label: 'Trade or business group' },
  { key: 'youth_women', label: 'Youth or women group' },
  { key: ASSOCIATION_TYPE_OTHER, label: 'Other (type your own)' },
] as const;

export type AssociationTypeKey = (typeof ASSOCIATION_TYPES)[number]['key'];

/** Every key, as the tuple a zod enum needs. */
export const ASSOCIATION_TYPE_KEYS = ASSOCIATION_TYPES.map((t) => t.key) as [AssociationTypeKey, ...AssociationTypeKey[]];

export const CUSTOM_ASSOCIATION_TYPE_MAX = 60;

/** "Alumni association", or the founder's own words when they chose Other. */
export function associationTypeLabel(type: string | null | undefined, customType?: string | null): string {
  if (!type) return 'General association';
  if (type === ASSOCIATION_TYPE_OTHER) return customType?.trim() ? customType.trim() : 'Other';
  return ASSOCIATION_TYPES.find((t) => t.key === type)?.label ?? type;
}

const TYPE_KEYS = ASSOCIATION_TYPE_KEYS;

export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 30;

/** The address an association will live at: lowercase letters, numbers and single hyphens inside. */
export const SUBDOMAIN_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SubdomainProblem = 'TOO_SHORT' | 'TOO_LONG' | 'BAD_CHARACTERS' | 'RESERVED';

export function subdomainProblem(value: string): SubdomainProblem | null {
  const v = value.trim().toLowerCase();
  if (v.length < SUBDOMAIN_MIN) return 'TOO_SHORT';
  if (v.length > SUBDOMAIN_MAX) return 'TOO_LONG';
  if (!SUBDOMAIN_PATTERN.test(v)) return 'BAD_CHARACTERS';
  if (RESERVED_SUBDOMAINS.includes(v)) return 'RESERVED';
  return null;
}

export const SUBDOMAIN_MESSAGES: Record<SubdomainProblem, string> = {
  TOO_SHORT: `Use at least ${SUBDOMAIN_MIN} characters.`,
  TOO_LONG: `Use at most ${SUBDOMAIN_MAX} characters.`,
  BAD_CHARACTERS: 'Use only lowercase letters, numbers and hyphens, with no hyphen at the start or end.',
  RESERVED: 'That address is kept for SocietyLedger. Please choose another.',
};

/** Suggest an address from the association's name, e.g. "Oko Youth Forum" -> "oko-youth-forum". */
export function suggestSubdomain(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SUBDOMAIN_MAX)
    .replace(/-+$/g, '');
}

/** Shown at signup on web and mobile, before the founder picks a name. */
export const SUBDOMAIN_REMINDER =
  'Choose your association name carefully. It becomes your web address (for example oko-youth-forum.societyledger.com.ng) once your account is approved, and it cannot easily be changed afterwards.';

const nameField = (label: string) => z.string().trim().min(1, `${label} is required`).max(60, `${label} is too long`);

/** A Nigerian-friendly phone check: digits with an optional leading +, 7 to 15 of them. */
export const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export const associationSignupSchema = z
  .object({
    association: z.object({
      name: z.string().trim().min(2, 'Enter the association name').max(100, 'The name is too long'),
      subdomain: z.string().trim().toLowerCase(),
      type: z.enum(TYPE_KEYS, { errorMap: () => ({ message: 'Choose the kind of association' }) }),
      customType: z.string().trim().max(CUSTOM_ASSOCIATION_TYPE_MAX, 'Keep it under 60 characters').optional(),
    }),
    admin: z.object({
      firstName: nameField('First name'),
      lastName: nameField('Last name'),
      email: z.string().trim().toLowerCase().email('Enter a valid email address'),
      phone: z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s()-]/g, ''))
        .refine((v) => PHONE_PATTERN.test(v), 'Enter a valid phone number'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
    }),
  })
  .superRefine((value, ctx) => {
    const problem = subdomainProblem(value.association.subdomain);
    if (problem) ctx.addIssue({ code: 'custom', path: ['association', 'subdomain'], message: SUBDOMAIN_MESSAGES[problem] });
    if (value.association.type === ASSOCIATION_TYPE_OTHER && !value.association.customType?.length) {
      ctx.addIssue({ code: 'custom', path: ['association', 'customType'], message: 'Tell us what kind of association it is' });
    }
  });

export type AssociationSignupInput = z.infer<typeof associationSignupSchema>;

/** The domain every association's address hangs off (the web app derives it from its own host; the phone has no host, so it uses this). */
export const PLATFORM_BASE_DOMAIN = 'societyledger.com.ng';

/** "oko-youth-forum" -> "oko-youth-forum.societyledger.com.ng" */
export function associationAddress(subdomain: string): string {
  return `${subdomain}.${PLATFORM_BASE_DOMAIN}`;
}
