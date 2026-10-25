import { z } from 'zod';
import { ASSOCIATION_TYPE_OTHER, CUSTOM_ASSOCIATION_TYPE_MAX, PHONE_PATTERN, SUBDOMAIN_MESSAGES, subdomainProblem } from '@societyledger/shared';

import type { SignupPayload } from '@/types/api/associations';

/** A13 — the two-step create-association form. The rules are the shared package's, the same ones the API and the web signup apply. */
export const createAssociationSchema = z
  .object({
    // Step 1 — the association
    name: z.string().trim().min(2, 'Enter the association name').max(100, 'The name is too long'),
    type: z.string().min(1, 'Choose the kind of association'),
    customType: z.string().trim().max(CUSTOM_ASSOCIATION_TYPE_MAX, `Use ${CUSTOM_ASSOCIATION_TYPE_MAX} characters or fewer`),
    subdomain: z.string().trim().toLowerCase(),
    // Step 2 — the founding admin
    firstName: z.string().trim().min(1, 'Enter your first name').max(60, 'Too long'),
    lastName: z.string().trim().min(1, 'Enter your last name').max(60, 'Too long'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .refine((v) => PHONE_PATTERN.test(v.replace(/[\s()-]/g, '')), 'Enter a valid phone number'),
    password: z.string().min(6, 'Must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.boolean().refine((value) => value === true, { message: 'You must accept the terms to continue' }),
  })
  .superRefine((values, ctx) => {
    const problem = subdomainProblem(values.subdomain);
    if (problem) ctx.addIssue({ code: 'custom', path: ['subdomain'], message: SUBDOMAIN_MESSAGES[problem] });
    if (values.type === ASSOCIATION_TYPE_OTHER && values.customType === '') {
      ctx.addIssue({ code: 'custom', path: ['customType'], message: 'Tell us what kind of association it is' });
    }
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: "Passwords don't match" });
    }
  });

export type CreateAssociationFormValues = z.infer<typeof createAssociationSchema>;

/** The fields each step owns, so "Continue" checks only the first step. */
export const STEP_ONE_FIELDS = ['name', 'type', 'customType', 'subdomain'] as const;
export const STEP_TWO_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword', 'acceptTerms'] as const;

export function toSignupPayload(values: CreateAssociationFormValues): SignupPayload {
  return {
    association: {
      name: values.name.trim(),
      subdomain: values.subdomain.trim().toLowerCase(),
      type: values.type,
      customType: values.type === ASSOCIATION_TYPE_OTHER ? values.customType.trim() : undefined,
    },
    admin: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.replace(/[\s()-]/g, ''),
      password: values.password,
    },
  };
}
