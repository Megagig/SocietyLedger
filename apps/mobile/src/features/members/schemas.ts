import { z } from 'zod';

import type { MemberCategory, MemberDetailDTO, MemberFormPayload, MemberStatus } from '@/types/api/membersManage';
import { CATEGORY_OPTIONS } from './labels';

const GENDERS = ['male', 'female', 'other'] as const;
const FORM_STATUSES = ['active', 'inactive', 'suspended', 'terminated'] as const;

/** Every field is a string in form state (code-standards.md §8); `toMemberPayload` turns blanks into null and dates into ISO. */
export function buildMemberFormSchema(options: { requireMemberId: boolean }) {
  return z.object({
    firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
    memberId: options.requireMemberId ? z.string().trim().min(1, 'Enter the member ID') : z.string().trim(),
    email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
    phone: z.string().trim(),
    dateOfBirth: z.string(),
    gender: z.enum(GENDERS),
    occupation: z.string().trim(),
    address: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim(),
    country: z.string().trim(),
    category: z.enum(CATEGORY_OPTIONS as [MemberCategory, ...MemberCategory[]]),
    status: z.enum(FORM_STATUSES),
    joinDate: z.string().min(1, 'Choose the join date'),
    emergencyContactName: z.string().trim(),
    emergencyContactPhone: z.string().trim(),
    emergencyContactRelationship: z.string().trim(),
    notes: z.string().trim(),
  });
}

export type MemberFormValues = z.infer<ReturnType<typeof buildMemberFormSchema>>;

export function emptyMemberFormValues(now: Date = new Date()): MemberFormValues {
  return {
    firstName: '',
    lastName: '',
    memberId: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'male',
    occupation: '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
    category: 'regular',
    status: 'active',
    joinDate: now.toISOString(),
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    notes: '',
  };
}

const orEmpty = (value: string | null | undefined): string => value ?? '';

/** Prefills the edit form from a loaded member. */
export function memberToFormValues(member: MemberDetailDTO): MemberFormValues {
  const gender = (GENDERS as readonly string[]).includes(member.gender) ? (member.gender as MemberFormValues['gender']) : 'other';
  const category = (CATEGORY_OPTIONS as readonly string[]).includes(member.category) ? (member.category as MemberCategory) : 'regular';
  const status = (FORM_STATUSES as readonly string[]).includes(member.status) ? (member.status as MemberStatus) : 'active';
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    memberId: member.memberId,
    email: orEmpty(member.email),
    phone: orEmpty(member.phone),
    dateOfBirth: orEmpty(member.dateOfBirth),
    gender,
    occupation: orEmpty(member.occupation),
    address: orEmpty(member.address),
    city: orEmpty(member.city),
    state: orEmpty(member.state),
    country: orEmpty(member.country),
    category,
    status,
    joinDate: member.joinDate ?? member.createdAt,
    emergencyContactName: orEmpty(member.emergencyContactName),
    emergencyContactPhone: orEmpty(member.emergencyContactPhone),
    emergencyContactRelationship: orEmpty(member.emergencyContactRelationship),
    notes: orEmpty(member.notes),
  };
}

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/**
 * The API body. Blanks go as null so an emptied field clears it on edit. `memberId` is sent on create only, and only
 * when the officer typed one (the server reads it only when automatic IDs are off, and never changes it on edit).
 */
export function toMemberPayload(values: MemberFormValues, mode: 'create' | 'edit'): MemberFormPayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: blankToNull(values.email),
    phone: blankToNull(values.phone),
    dateOfBirth: values.dateOfBirth ? values.dateOfBirth : null,
    gender: values.gender,
    address: blankToNull(values.address),
    city: blankToNull(values.city),
    state: blankToNull(values.state),
    country: blankToNull(values.country),
    occupation: blankToNull(values.occupation),
    category: values.category,
    status: values.status,
    joinDate: values.joinDate,
    emergencyContactName: blankToNull(values.emergencyContactName),
    emergencyContactPhone: blankToNull(values.emergencyContactPhone),
    emergencyContactRelationship: blankToNull(values.emergencyContactRelationship),
    notes: blankToNull(values.notes),
    ...(mode === 'create' && values.memberId.trim() ? { memberId: values.memberId.trim() } : {}),
  };
}
