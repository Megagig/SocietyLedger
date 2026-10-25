import { associationSignupSchema } from '@societyledger/shared';

import { createAssociationSchema, toSignupPayload, type CreateAssociationFormValues } from './schemas';

const valid: CreateAssociationFormValues = {
  name: 'Oko Youth Forum',
  type: 'town_union',
  customType: '',
  subdomain: 'oko-youth-forum',
  firstName: 'Ada',
  lastName: 'Obi',
  email: 'Ada@Example.com',
  phone: '0803 123 4567',
  password: 'secret1',
  confirmPassword: 'secret1',
  acceptTerms: true,
};

const issues = (values: Partial<CreateAssociationFormValues>) => {
  const result = createAssociationSchema.safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('the create-association form (A13)', () => {
  it('accepts a complete form', () => {
    expect(issues({})).toEqual([]);
  });

  it('applies the same address rules as the server and the web', () => {
    expect(issues({ subdomain: 'ab' })[0]).toMatch(/^subdomain: Use at least 3/);
    expect(issues({ subdomain: 'oko forum' })[0]).toMatch(/^subdomain: Use only lowercase/);
    expect(issues({ subdomain: 'admin' })[0]).toMatch(/kept for SocietyLedger/);
  });

  it('needs the association\'s own words when the kind is Other', () => {
    expect(issues({ type: 'other', customType: '' })).toEqual(['customType: Tell us what kind of association it is']);
    expect(issues({ type: 'other', customType: 'Village development union' })).toEqual([]);
  });

  it('checks the founder\'s details: names, a real phone, matching passwords and the terms', () => {
    expect(issues({ firstName: '' })).toEqual(['firstName: Enter your first name']);
    expect(issues({ phone: 'call me' })).toEqual(['phone: Enter a valid phone number']);
    expect(issues({ confirmPassword: 'different' })).toEqual(["confirmPassword: Passwords don't match"]);
    expect(issues({ password: '12345', confirmPassword: '12345' })).toEqual(['password: Must be at least 6 characters']);
    expect(issues({ acceptTerms: false })).toEqual(['acceptTerms: You must accept the terms to continue']);
  });
});

describe('toSignupPayload', () => {
  it('builds a body the API\'s own schema accepts, with the email and phone tidied', () => {
    const payload = toSignupPayload(valid);
    expect(payload.admin.email).toBe('ada@example.com');
    expect(payload.admin.phone).toBe('08031234567');
    expect(payload.association.customType).toBeUndefined();
    expect(associationSignupSchema.safeParse(payload).success).toBe(true);
  });

  it('sends the typed-in kind only when Other was chosen', () => {
    expect(toSignupPayload({ ...valid, type: 'other', customType: ' Village union ' }).association.customType).toBe('Village union');
    expect(toSignupPayload({ ...valid, type: 'alumni', customType: 'leftover text' }).association.customType).toBeUndefined();
  });
});
