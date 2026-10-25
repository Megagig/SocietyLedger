/** The audit log: filters that are checked, and secrets that never leave the server. */
import { REDACTED, parseAuditQuery, redactAuditValues } from '../../src/modules/settings/audit-log';
import { RuleError } from '../../src/modules/finance/rule-error';

describe('redactAuditValues', () => {
  it('hides anything that looks like a secret, at any depth', () => {
    expect(redactAuditValues({ name: 'Ada', passwordHash: 'x', nested: { apiKey: 'k', resetToken: 't', ok: 1 }, list: [{ otp: '1' }] })).toEqual({
      name: 'Ada',
      passwordHash: REDACTED,
      nested: { apiKey: REDACTED, resetToken: REDACTED, ok: 1 },
      list: [{ otp: REDACTED }],
    });
  });

  it('leaves plain values and empty ones alone', () => {
    expect(redactAuditValues(null)).toBeNull();
    expect(redactAuditValues('text')).toBe('text');
    expect(redactAuditValues({ category: 'financial', changes: [{ key: 'lateFeeAmount', new: '500' }] })).toEqual({
      category: 'financial',
      changes: [{ key: 'lateFeeAmount', new: '500' }],
    });
  });
});

describe('parseAuditQuery', () => {
  it('is always scoped to the association and starts at page 1 of 20', () => {
    const q = parseAuditQuery(7, {});
    expect(q).toMatchObject({ page: 1, limit: 20, skip: 0 });
    expect(q.where).toEqual({ associationId: 7 });
  });

  it('caps a page at 100 and ignores nonsense', () => {
    expect(parseAuditQuery(7, { limit: '5000', page: '-3' })).toMatchObject({ limit: 100, page: 1 });
    expect(parseAuditQuery(7, { limit: 'abc', page: '3' })).toMatchObject({ limit: 20, skip: 40 });
  });

  it('cuts a day in Lagos time', () => {
    const { where } = parseAuditQuery(7, { from: '2026-10-01', to: '2026-10-02' });
    expect(where.createdAt).toEqual({ gte: new Date('2026-09-30T23:00:00.000Z'), lte: new Date('2026-10-02T22:59:59.999Z') });
  });

  it('refuses a date that is not one, and an end before the start', () => {
    const fail = (q: object) => {
      try {
        parseAuditQuery(7, q);
      } catch (error) {
        return (error as RuleError).code;
      }
      return 'NO_ERROR';
    };
    expect(fail({ from: 'soon' })).toBe('INVALID_DATE');
    expect(fail({ from: '2026-10-05', to: '2026-10-01' })).toBe('INVALID_DATE');
  });

  it('filters by person, table and activity', () => {
    const { where } = parseAuditQuery(7, { userId: '12', tableName: 'roles', action: 'ROLE_' });
    expect(where).toMatchObject({ associationId: 7, userId: 12, tableName: 'roles', action: { contains: 'ROLE_', mode: 'insensitive' } });
  });
});
