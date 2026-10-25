import type { MemberDetailDTO } from '@/types/api/membersManage';
import { buildMemberFormSchema, emptyMemberFormValues, memberToFormValues, toMemberPayload } from './schemas';

const filled = () => ({ ...emptyMemberFormValues(new Date('2026-10-24T09:00:00.000Z')), firstName: 'Adaeze', lastName: 'Okafor' });

describe('member form schema', () => {
  it('accepts the minimum: a name and a join date', () => {
    expect(buildMemberFormSchema({ requireMemberId: false }).safeParse(filled()).success).toBe(true);
  });

  it('wants names of at least two characters and a valid email when one is given', () => {
    const schema = buildMemberFormSchema({ requireMemberId: false });
    expect(schema.safeParse({ ...filled(), firstName: 'A' }).success).toBe(false);
    expect(schema.safeParse({ ...filled(), email: 'not-an-email' }).success).toBe(false);
    expect(schema.safeParse({ ...filled(), email: '' }).success).toBe(true);
  });

  it('requires a member ID only when automatic IDs are off', () => {
    expect(buildMemberFormSchema({ requireMemberId: true }).safeParse(filled()).success).toBe(false);
    expect(buildMemberFormSchema({ requireMemberId: true }).safeParse({ ...filled(), memberId: 'AB-12' }).success).toBe(true);
  });
});

describe('toMemberPayload', () => {
  it('sends blanks as null so an emptied field clears it', () => {
    const payload = toMemberPayload({ ...filled(), phone: '  ', notes: '', occupation: 'Teacher' }, 'edit');
    expect(payload.phone).toBeNull();
    expect(payload.notes).toBeNull();
    expect(payload.occupation).toBe('Teacher');
    expect(payload.dateOfBirth).toBeNull();
  });

  it('sends the member ID on create when typed, never on edit', () => {
    const values = { ...filled(), memberId: ' AB-12 ' };
    expect(toMemberPayload(values, 'create').memberId).toBe('AB-12');
    expect(toMemberPayload(values, 'edit').memberId).toBeUndefined();
    expect(toMemberPayload({ ...values, memberId: '' }, 'create').memberId).toBeUndefined();
  });

  it('trims names', () => {
    const payload = toMemberPayload({ ...filled(), firstName: ' Adaeze ' }, 'create');
    expect(payload.firstName).toBe('Adaeze');
  });
});

describe('memberToFormValues', () => {
  const member = {
    id: 5,
    memberId: 'MEM0005',
    firstName: 'Tunde',
    lastName: 'Bakare',
    email: null,
    phone: '08031234567',
    gender: 'male',
    category: 'life_member',
    status: 'terminated',
    dateOfBirth: null,
    joinDate: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  } as unknown as MemberDetailDTO;

  it('turns missing values into empty strings and keeps a disabled status visible', () => {
    const values = memberToFormValues(member);
    expect(values.email).toBe('');
    expect(values.status).toBe('terminated');
    expect(values.joinDate).toBe('2026-01-02T00:00:00.000Z');
  });

  it('falls back to a known category when the stored one is unlisted', () => {
    expect(memberToFormValues(member).category).toBe('regular');
  });
});
