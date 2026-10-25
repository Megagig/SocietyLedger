/**
 * Guarantors are told when they are named, and the applicant is told when a guarantor answers — in-app, push and
 * email through dispatchNotification (which applies each recipient's preferences). Prisma and the dispatcher are mocked.
 */
const mockPrisma = {
  loanApplication: { findUnique: jest.fn() },
  member: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));

const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: (...args: unknown[]) => mockDispatch(...args) }));

import { Decimal } from '@prisma/client/runtime/library';
import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';

const application = {
  id: 5,
  applicationNumber: 'LA-2610-00001',
  amount: new Decimal('100000'),
  purpose: 'Stock <b>for</b> my shop',
  member: { firstName: 'Austin', lastName: 'Anthony', userId: 7 },
  loanProduct: { name: 'Emergency Loan' },
  association: { name: 'Oko Youth Forum' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockResolvedValue({ inAppCreated: true, emailSent: true, smsSent: false });
  mockPrisma.loanApplication.findUnique.mockResolvedValue(application);
});

describe('notifyGuarantorsRequested', () => {
  it('notifies each guarantor with an account — in-app, a push that opens Guarantor Requests, and an email', async () => {
    mockPrisma.member.findMany.mockResolvedValue([
      { firstName: 'Ada', lastName: 'Obi', userId: 21 },
      { firstName: 'Chidi', lastName: 'Eze', userId: 22 },
    ]);

    await cooperativesService.notifyGuarantorsRequested(15, 5, [3, 4], 50000);

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    const first = mockDispatch.mock.calls[0][0];
    expect(first).toMatchObject({
      associationId: 15,
      userId: 21,
      kind: 'approval',
      entityId: 5,
      pushType: 'guarantor.requested',
      sendEmail: true,
      emailTemplate: 'guarantor-request',
    });
    expect(first.message).toContain('Austin Anthony');
    expect(first.message).toContain('₦50,000');
    expect(first.emailData).toMatchObject({ guarantorName: 'Ada Obi', loanAmount: 100000, guaranteeAmount: 50000 });
  });

  it('skips a guarantor who has no user account', async () => {
    mockPrisma.member.findMany.mockResolvedValue([
      { firstName: 'Ada', lastName: 'Obi', userId: null },
      { firstName: 'Chidi', lastName: 'Eze', userId: 22 },
    ]);

    await cooperativesService.notifyGuarantorsRequested(15, 5, [3, 4], 50000);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].userId).toBe(22);
  });

  it("escapes member-typed text before it goes into the email's HTML", async () => {
    mockPrisma.member.findMany.mockResolvedValue([{ firstName: 'Ada', lastName: 'Obi', userId: 21 }]);

    await cooperativesService.notifyGuarantorsRequested(15, 5, [3], 100000);

    expect(mockDispatch.mock.calls[0][0].emailData.purpose).toBe('Stock &lt;b&gt;for&lt;/b&gt; my shop');
  });

  it("keeps notifying the others when one guarantor's notification fails", async () => {
    mockPrisma.member.findMany.mockResolvedValue([
      { firstName: 'Ada', lastName: 'Obi', userId: 21 },
      { firstName: 'Chidi', lastName: 'Eze', userId: 22 },
    ]);
    mockDispatch.mockRejectedValueOnce(new Error('provider down'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(cooperativesService.notifyGuarantorsRequested(15, 5, [3, 4], 50000)).resolves.toBeUndefined();

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});

describe('notifyGuarantorResponse', () => {
  const guarantor = { guarantorMember: { firstName: 'Ada', lastName: 'Obi' } };

  it('tells the applicant a guarantor accepted, and when the application has moved on to the officers', async () => {
    await cooperativesService.notifyGuarantorResponse(15, 5, guarantor, 'accept', undefined, true);

    const call = mockDispatch.mock.calls[0][0];
    expect(call).toMatchObject({
      userId: 7,
      title: 'Guarantor accepted',
      pushType: 'loan.application_updated',
      sendEmail: true,
      emailTemplate: 'guarantor-response',
    });
    expect(call.message).toContain('Ada Obi agreed to guarantee');
    expect(call.message).toContain('now with the officers');
    expect(call.emailData).toMatchObject({ accepted: true, movedToReview: true });
  });

  it("includes the decline reason, escaped for the email but plain in the app", async () => {
    await cooperativesService.notifyGuarantorResponse(15, 5, guarantor, 'decline', 'Can\'t <afford> it', false);

    const call = mockDispatch.mock.calls[0][0];
    expect(call.title).toBe('Guarantor declined');
    expect(call.message).toContain("declined to guarantee");
    expect(call.message).toContain("Can't <afford> it");
    expect(call.emailData.declineReason).toBe('Can&#39;t &lt;afford&gt; it');
    expect(call.emailData.accepted).toBe(false);
  });

  it('does nothing when the applicant has no user account', async () => {
    mockPrisma.loanApplication.findUnique.mockResolvedValue({ ...application, member: { ...application.member, userId: null } });

    await cooperativesService.notifyGuarantorResponse(15, 5, guarantor, 'accept', undefined, false);

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
