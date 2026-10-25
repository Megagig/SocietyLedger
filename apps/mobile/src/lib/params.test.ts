import { z } from 'zod';

import { parseParams } from './params';

const schema = z.object({ email: z.string().email() });

describe('parseParams', () => {
  it('returns the parsed value when params match the schema', () => {
    expect(parseParams(schema, { email: 'ada@example.com' })).toEqual({ email: 'ada@example.com' });
  });

  it('returns null when params do not match the schema', () => {
    expect(parseParams(schema, { email: 'not-an-email' })).toBeNull();
  });

  it('returns null for missing params', () => {
    expect(parseParams(schema, {})).toBeNull();
  });
});
