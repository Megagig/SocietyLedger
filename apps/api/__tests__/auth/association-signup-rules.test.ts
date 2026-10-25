/** What an association signup must contain, checked the same way on the API, web and mobile (the rules live in the shared package). */
import {
  ASSOCIATION_TYPES,
  ASSOCIATION_TYPE_OTHER,
  associationSignupSchema,
  subdomainProblem,
  suggestSubdomain,
} from '@societyledger/shared';

const valid = {
  association: { name: 'Oko Youth Forum', subdomain: 'oko-youth-forum', type: 'town_union' },
  admin: { firstName: 'Ada', lastName: 'Obi', email: 'Ada@Example.com ', phone: '0803 123 4567', password: 'secret1' },
};

const issuesOf = (input: unknown) => {
  const result = associationSignupSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('the signup form', () => {
  it('accepts a complete signup and tidies it: lowercase email, phone without spaces', () => {
    const result = associationSignupSchema.parse(valid);
    expect(result.admin.email).toBe('ada@example.com');
    expect(result.admin.phone).toBe('08031234567');
    expect(result.association.subdomain).toBe('oko-youth-forum');
  });

  it('asks for the founder\'s name and phone, which the old signup never collected', () => {
    const issues = issuesOf({ ...valid, admin: { email: 'a@b.com', password: 'secret1' } });
    expect(issues.some((i) => i.startsWith('admin.firstName'))).toBe(true);
    expect(issues.some((i) => i.startsWith('admin.lastName'))).toBe(true);
    expect(issues.some((i) => i.startsWith('admin.phone'))).toBe(true);
  });

  it('rejects a phone number that is not a phone number', () => {
    expect(issuesOf({ ...valid, admin: { ...valid.admin, phone: 'call me' } })).toEqual(['admin.phone: Enter a valid phone number']);
  });

  it('keeps the password rule the same as sign-in and reset: at least 6 characters', () => {
    expect(issuesOf({ ...valid, admin: { ...valid.admin, password: '12345' } })).toEqual(['admin.password: Password must be at least 6 characters']);
  });
});

describe('the association type', () => {
  it('offers a preset list that ends with Other', () => {
    expect(ASSOCIATION_TYPES.length).toBeGreaterThan(5);
    expect(ASSOCIATION_TYPES[ASSOCIATION_TYPES.length - 1].key).toBe(ASSOCIATION_TYPE_OTHER);
  });

  it('needs the founder\'s own words when they pick Other', () => {
    const other = { ...valid, association: { ...valid.association, type: ASSOCIATION_TYPE_OTHER } };
    expect(issuesOf(other)).toEqual(['association.customType: Tell us what kind of association it is']);
    expect(issuesOf({ ...other, association: { ...other.association, customType: 'Village development union' } })).toEqual([]);
  });

  it('rejects a type that is not on the list', () => {
    expect(issuesOf({ ...valid, association: { ...valid.association, type: 'pirates' } })).toHaveLength(1);
  });
});

describe('the address (subdomain)', () => {
  it('accepts lowercase letters, numbers and hyphens inside', () => {
    expect(subdomainProblem('oko-youth-forum')).toBeNull();
    expect(subdomainProblem('abc')).toBeNull();
    expect(subdomainProblem('club-2026')).toBeNull();
  });

  it('rejects the wrong length, odd characters, edge hyphens and double hyphens', () => {
    expect(subdomainProblem('ab')).toBe('TOO_SHORT');
    expect(subdomainProblem('a'.repeat(31))).toBe('TOO_LONG');
    expect(subdomainProblem('oko_forum')).toBe('BAD_CHARACTERS');
    expect(subdomainProblem('-oko')).toBe('BAD_CHARACTERS');
    expect(subdomainProblem('oko-')).toBe('BAD_CHARACTERS');
    expect(subdomainProblem('oko--forum')).toBe('BAD_CHARACTERS');
  });

  it('rejects the addresses SocietyLedger keeps for itself', () => {
    for (const name of ['admin', 'www', 'api', 'support']) expect(subdomainProblem(name)).toBe(name.length < 3 ? 'TOO_SHORT' : 'RESERVED');
    expect(issuesOf({ ...valid, association: { ...valid.association, subdomain: 'admin' } })[0]).toMatch(/kept for SocietyLedger/);
  });

  it('suggests an address from the association name', () => {
    expect(suggestSubdomain('Oko Youth Forum')).toBe('oko-youth-forum');
    expect(suggestSubdomain("  St. Mary's  Alumni (Class of '95) ")).toBe('st-mary-s-alumni-class-of-95');
    expect(suggestSubdomain('Ọ̀kọ́ Union')).toBe('oko-union'); // accents fold to plain letters
    expect(suggestSubdomain('A'.repeat(50)).length).toBeLessThanOrEqual(30);
  });
});
