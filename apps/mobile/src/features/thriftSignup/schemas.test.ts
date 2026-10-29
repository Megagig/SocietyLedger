import { thriftSignupSchema, toThriftPayload } from './schemas';

const good = { groupName: 'Market Women', subdomain: 'market-women', firstName: 'Ada', lastName: 'Obi', email: 'ADA@Example.com', phone: '0803 123 4567', password: 'secret1', confirmPassword: 'secret1', acceptTerms: true };

describe('thriftSignupSchema', () => {
  it('accepts a complete form and builds an "Other / Thrift group" payload', () => {
    const parsed = thriftSignupSchema.safeParse(good);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(toThriftPayload(parsed.data)).toEqual({
        association: { name: 'Market Women', subdomain: 'market-women', type: 'other', customType: 'Thrift group' },
        admin: { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com', phone: '08031234567', password: 'secret1' },
      });
    }
  });
  it('refuses mismatched passwords, a bad address and unaccepted terms', () => {
    expect(thriftSignupSchema.safeParse({ ...good, confirmPassword: 'other' }).success).toBe(false);
    expect(thriftSignupSchema.safeParse({ ...good, subdomain: 'www' }).success).toBe(false);
    expect(thriftSignupSchema.safeParse({ ...good, subdomain: 'a' }).success).toBe(false);
    expect(thriftSignupSchema.safeParse({ ...good, acceptTerms: false }).success).toBe(false);
  });
});
