import { associationCodeSchema } from './schemas';

describe('associationCodeSchema', () => {
  it('accepts a normal lowercase subdomain', () => {
    expect(associationCodeSchema.safeParse({ subdomain: 'opuogunstate' }).success).toBe(true);
  });

  it('lowercases and trims before validating', () => {
    const result = associationCodeSchema.safeParse({ subdomain: '  OpuogunState  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subdomain).toBe('opuogunstate');
  });

  it('rejects fewer than 3 characters', () => {
    expect(associationCodeSchema.safeParse({ subdomain: 'ab' }).success).toBe(false);
  });

  it('rejects characters outside lowercase letters, numbers and hyphens', () => {
    expect(associationCodeSchema.safeParse({ subdomain: 'opuogun_state' }).success).toBe(false);
    expect(associationCodeSchema.safeParse({ subdomain: 'opuogun state' }).success).toBe(false);
  });

  it('rejects a reserved subdomain', () => {
    expect(associationCodeSchema.safeParse({ subdomain: 'admin' }).success).toBe(false);
    expect(associationCodeSchema.safeParse({ subdomain: 'docs' }).success).toBe(false);
  });
});
