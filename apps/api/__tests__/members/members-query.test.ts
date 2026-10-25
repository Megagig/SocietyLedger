import { buildMemberWhere, memberQuerySchema, resolvePaging, startOfMonthLagos } from '../../src/modules/members/members.query';

describe('members list query', () => {
  it('scopes to the association and applies no filters by default', () => {
    expect(buildMemberWhere(7, memberQuerySchema.parse({}))).toEqual({ associationId: 7 });
  });

  it('searches name, email, phone and member ID case-insensitively', () => {
    const where = buildMemberWhere(7, memberQuerySchema.parse({ search: 'ada' }));
    expect(where.OR).toHaveLength(5);
    expect(where.OR?.[0]).toEqual({ firstName: { contains: 'ada', mode: 'insensitive' } });
  });

  it('filters by status, category and login status together', () => {
    const where = buildMemberWhere(7, memberQuerySchema.parse({ status: 'active', category: 'regular', loginStatus: 'invited' }));
    expect(where).toMatchObject({ associationId: 7, status: 'active', category: 'regular', loginStatus: 'invited' });
  });

  it('rejects an unknown login status and an unknown sort field', () => {
    expect(() => memberQuerySchema.parse({ loginStatus: 'banned' })).toThrow();
    expect(() => memberQuerySchema.parse({ sortBy: 'passwordHash' })).toThrow();
  });
});

describe('members paging', () => {
  it('defaults to page 1 of 10', () => {
    expect(resolvePaging({ page: '1', limit: '10' })).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('caps the page size at 100 and floors the page at 1', () => {
    expect(resolvePaging({ page: '0', limit: '100000' })).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(resolvePaging({ page: '-4', limit: 'abc' })).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('skips whole pages', () => {
    expect(resolvePaging({ page: '3', limit: '25' })).toEqual({ page: 3, limit: 25, skip: 50 });
  });
});

describe('startOfMonthLagos', () => {
  it('starts the month at midnight Lagos time (23:00 UTC the evening before)', () => {
    expect(startOfMonthLagos(new Date('2026-10-15T12:00:00Z')).toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('counts the last evening of a month in UTC as already next month in Lagos', () => {
    expect(startOfMonthLagos(new Date('2026-10-31T23:30:00Z')).toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });
});
