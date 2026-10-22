/**
 * Support staff are told when a member opens a ticket or replies; the member is told when staff reply — in-app, push
 * (the mobile app opens the ticket) and email, through dispatchNotification. Internal notes tell no one.
 * Prisma and the dispatcher are mocked.
 */
const mockPrisma = {
  userRole: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  association: { findUnique: jest.fn() },
  supportTicket: { findUnique: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: (...args: unknown[]) => mockDispatch(...args) }));

import { supportService } from '../../src/modules/support/support.service';

const ticket = { id: 3, userId: 7, ticketNumber: 'TKT-20261022-0001', subject: 'My <b>payment</b> is missing', category: 'PAYMENTS', priority: 'HIGH' };

beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockResolvedValue({ inAppCreated: true, emailSent: true, smsSent: false });
  mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
  mockPrisma.user.findUnique.mockResolvedValue({ email: 'ada@example.com', member: { firstName: 'Ada', lastName: 'Obi' } });
  mockPrisma.association.findUnique.mockResolvedValue({ name: 'Oko Youth Forum' });
});

describe('notifyStaffOfNewTicket', () => {
  it('tells every support staff member in the association, with a push, an email and escaped text', async () => {
    await supportService.notifyStaffOfNewTicket(15, ticket);

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls.map((c) => c[0].userId)).toEqual([1, 2]);
    const call = mockDispatch.mock.calls[0][0];
    expect(call).toMatchObject({ associationId: 15, entityId: 3, pushType: 'support.ticket_created', sendEmail: true, emailTemplate: 'support-ticket-new' });
    expect(call.message).toContain('Ada Obi');
    expect(call.emailData.subject).toBe('My &lt;b&gt;payment&lt;/b&gt; is missing');
  });

  it('only looks for staff in the ticket’s own association', async () => {
    await supportService.notifyStaffOfNewTicket(15, ticket);

    expect(mockPrisma.userRole.findMany.mock.calls[0][0].where.associationId).toBe(15);
  });

  it("does not notify the ticket's own opener if they are also staff", async () => {
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 7 }, { userId: 2 }]);

    await supportService.notifyStaffOfNewTicket(15, ticket);

    expect(mockDispatch.mock.calls.map((c) => c[0].userId)).toEqual([2]);
  });

  it('never throws, and keeps going when one notification fails', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('provider down'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(supportService.notifyStaffOfNewTicket(15, ticket)).resolves.toBeUndefined();

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});

describe('notifyOfReply', () => {
  const row = { id: 3, userId: 7, assignedToId: null, ticketNumber: 'TKT-20261022-0001', subject: 'Missing payment', association: { name: 'Oko Youth Forum' } };

  beforeEach(() => mockPrisma.supportTicket.findUnique.mockResolvedValue(row));

  it('tells the member about a staff reply, with a push that opens their ticket', async () => {
    await supportService.notifyOfReply(15, 3, { userId: 1, message: 'We have found it.', isStaff: true, isInternal: false });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({ userId: 7, pushType: 'support.ticket_reply', entityId: 3, emailTemplate: 'support-ticket-reply' });
    expect(mockDispatch.mock.calls[0][0].emailData.fromStaff).toBe(true);
  });

  it('tells nobody about an internal note', async () => {
    await supportService.notifyOfReply(15, 3, { userId: 1, message: 'Check the bank feed.', isStaff: true, isInternal: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('sends a member reply to the assigned staff member only', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue({ ...row, assignedToId: 2 });

    await supportService.notifyOfReply(15, 3, { userId: 7, message: 'Still not there.', isStaff: false, isInternal: false });

    expect(mockDispatch.mock.calls.map((c) => c[0].userId)).toEqual([2]);
    expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
  });

  it('sends a member reply to all staff when nobody is assigned', async () => {
    await supportService.notifyOfReply(15, 3, { userId: 7, message: 'Still not there.', isStaff: false, isInternal: false });

    expect(mockDispatch.mock.calls.map((c) => c[0].userId)).toEqual([1, 2]);
  });

  it('shortens a very long message in the notification', async () => {
    await supportService.notifyOfReply(15, 3, { userId: 1, message: 'x'.repeat(1000), isStaff: true, isInternal: false });

    expect(mockDispatch.mock.calls[0][0].message.length).toBeLessThan(330);
  });
});
