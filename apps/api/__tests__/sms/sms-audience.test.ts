/**
 * Who a message goes to. These guard the bugs this replaced: campaigns asked for status 'ACTIVE' while members are stored as 'active'
 * (so "all members" and "by category" matched nobody), and "owing" matched everyone because everyone owes at least ₦0.
 */
const db: any = {
  member: { findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  notificationPreference: { findMany: jest.fn() },
};

import { loadAudienceMembers, outstandingByMember, resolveSmsAudience } from '../../src/modules/sms/sms-audience';

const member = (id: number, over: object = {}) => ({ id, firstName: `M${id}`, lastName: 'Obi', phone: `0803000000${id}`, userId: null, ...over });

beforeEach(() => {
  jest.resetAllMocks();
  db.notificationPreference.findMany.mockResolvedValue([]);
  db.transaction.findMany.mockResolvedValue([]);
});

describe('all members, and by category', () => {
  it("asks for members who are 'active' as they are stored", async () => {
    db.member.findMany.mockResolvedValue([member(1), member(2)]);
    const audience = await resolveSmsAudience(db, 1, 'ALL_MEMBERS', null);
    expect(db.member.findMany.mock.calls[0][0].where).toMatchObject({ associationId: 1, status: 'active' });
    expect(audience.willText).toHaveLength(2);
  });

  it('a category is matched in lowercase, as categories are stored', async () => {
    db.member.findMany.mockResolvedValue([member(1)]);
    await loadAudienceMembers(db, 1, 'MEMBER_CATEGORY', { categories: ['Regular', 'EXECUTIVE'] });
    expect(db.member.findMany.mock.calls[0][0].where).toMatchObject({ status: 'active', category: { in: ['regular', 'executive'] } });
  });

  it('an empty selection or category list is no one', async () => {
    expect(await loadAudienceMembers(db, 1, 'SELECTED_MEMBERS', { memberIds: [] })).toEqual([]);
    expect(await loadAudienceMembers(db, 1, 'MEMBER_CATEGORY', { categories: [] })).toEqual([]);
    expect(db.member.findMany).not.toHaveBeenCalled();
  });
});

describe('owing and paid up', () => {
  const charges = [
    { memberId: 1, amount: 5000, payments: [] }, // owes 5,000
    { memberId: 2, amount: 5000, payments: [{ amountPaid: 5000 }] }, // paid in full: owes nothing
    { memberId: 3, amount: 5000, payments: [{ amountPaid: 3000 }] }, // owes the rest
  ];

  it('what is owed is what is still unpaid, and a member who has paid in full owes nothing', async () => {
    db.transaction.findMany.mockResolvedValue(charges);
    const owed = await outstandingByMember(db, 1);
    expect([...owed.entries()]).toEqual([[1, 5000], [3, 2000]]);
    expect(db.transaction.findMany.mock.calls[0][0].where).toMatchObject({ isVoided: false, status: { in: ['pending', 'partial', 'overdue'] } });
  });

  it('"owing" is only members who owe something, even with no minimum', async () => {
    db.member.findMany.mockResolvedValue([member(1), member(2), member(3), member(4)]);
    db.transaction.findMany.mockResolvedValue(charges);
    const owing = await loadAudienceMembers(db, 1, 'OWING_MEMBERS', null);
    expect(owing.map((m) => m.id)).toEqual([1, 3]);
  });

  it('"owing" can have a minimum', async () => {
    db.member.findMany.mockResolvedValue([member(1), member(3)]);
    db.transaction.findMany.mockResolvedValue(charges);
    expect((await loadAudienceMembers(db, 1, 'OWING_MEMBERS', { owingMinAmount: 3000 })).map((m) => m.id)).toEqual([1]);
  });

  it('"paid up" is everyone who owes nothing', async () => {
    db.member.findMany.mockResolvedValue([member(1), member(2), member(3), member(4)]);
    db.transaction.findMany.mockResolvedValue(charges);
    expect((await loadAudienceMembers(db, 1, 'PAID_MEMBERS', null)).map((m) => m.id)).toEqual([2, 4]);
  });
});

describe('opting out and missing numbers', () => {
  it('members who opted out of texts are left out and counted; members with no number are counted too', async () => {
    db.member.findMany.mockResolvedValue([member(1, { userId: 11 }), member(2, { userId: 12 }), member(3, { phone: null }), member(4)]);
    db.notificationPreference.findMany.mockResolvedValue([{ userId: 12 }]);
    const audience = await resolveSmsAudience(db, 1, 'ALL_MEMBERS', null);
    expect(audience.willText.map((r) => r.memberId)).toEqual([1, 4]);
    expect(audience.optedOut.map((m) => m.id)).toEqual([2]);
    expect(audience.noPhone.map((m) => m.id)).toEqual([3]);
    expect(audience.members).toHaveLength(4);
    expect(db.notificationPreference.findMany.mock.calls[0][0].where).toMatchObject({ announcementSmsOptOut: true, userId: { in: [11, 12] } });
  });

  it('asks nothing about preferences when nobody in the audience has a login', async () => {
    db.member.findMany.mockResolvedValue([member(1), member(2)]);
    await resolveSmsAudience(db, 1, 'ALL_MEMBERS', null);
    expect(db.notificationPreference.findMany).not.toHaveBeenCalled();
  });
});

describe('custom numbers', () => {
  it('are texted as given: tidied, once each, and the ones that are not numbers are reported', async () => {
    const audience = await resolveSmsAudience(db, 1, 'CUSTOM_NUMBERS', { customNumbers: ['0803 123 4567', '+2348031234567', '12345', '08039999999'] });
    expect(audience.willText.map((r) => r.phone)).toEqual(['2348031234567', '2348039999999']);
    expect(audience.invalidNumbers).toEqual(['12345']);
    expect(db.member.findMany).not.toHaveBeenCalled();
  });
});
