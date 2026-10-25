import { membersManageApi } from './membersManage';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('membersManageApi writes', () => {
  it('creates and edits a member', async () => {
    mockPost.mockReturnValue(ok({ id: 3 }));
    mockPatch.mockReturnValue(ok({ id: 3 }));

    await membersManageApi.createMember({
      firstName: 'Ada',
      lastName: 'Obi',
      gender: 'female',
      category: 'regular',
      status: 'active',
      joinDate: '2026-10-24T09:00:00.000Z',
    });
    await membersManageApi.updateMember(3, { status: 'active' });

    expect(mockPost).toHaveBeenCalledWith('/members', expect.objectContaining({ firstName: 'Ada' }));
    expect(mockPatch).toHaveBeenCalledWith('/members/3', { status: 'active' });
  });

  it('disables a member with DELETE', async () => {
    mockDelete.mockResolvedValue({ data: { success: true } });
    await membersManageApi.disableMember(3);
    expect(mockDelete).toHaveBeenCalledWith('/members/3');
  });
});

describe('membersManageApi invites', () => {
  it('lists invitable members and pending invites', async () => {
    mockGet.mockReturnValueOnce(ok({ members: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }));
    mockGet.mockReturnValueOnce(ok({ invites: [{ id: 1 }] }));

    await membersManageApi.listInvitable({ page: 1, limit: 25, search: 'ada' });
    const pending = await membersManageApi.listPendingInvites();

    expect(mockGet).toHaveBeenNthCalledWith(1, '/member-invites/invitable', { params: { page: 1, limit: 25, search: 'ada' } });
    expect(pending).toEqual([{ id: 1 }]);
  });

  it('bulk-invites by member id', async () => {
    mockPost.mockReturnValue(ok({ results: [{ memberId: 4, success: true, emailSent: true, message: 'Invite sent' }] }));
    const { results } = await membersManageApi.bulkInvite([4]);
    expect(mockPost).toHaveBeenCalledWith('/member-invites/bulk-invite', { memberIds: [4] });
    expect(results[0]?.emailSent).toBe(true);
  });

  it('reports whether a resent invite was emailed', async () => {
    mockPost.mockReturnValue(Promise.resolve({ data: { success: true, message: 'Invite renewed', data: { emailSent: false } } }));
    await expect(membersManageApi.resendInvite(9)).resolves.toEqual({ emailSent: false, message: 'Invite renewed' });
    expect(mockPost).toHaveBeenCalledWith('/member-invites/9/resend');
  });

  it('revokes an invite with DELETE', async () => {
    mockDelete.mockResolvedValue({ data: { success: true } });
    await membersManageApi.revokeInvite(9);
    expect(mockDelete).toHaveBeenCalledWith('/member-invites/9');
  });
});

describe('membersManageApi approvals', () => {
  it('lists registrations by decision status', async () => {
    mockGet.mockReturnValue(ok({ approvals: [], total: 0, page: 1, limit: 25, totalPages: 0 }));
    await membersManageApi.listApprovals({ status: 'pending', page: 1, limit: 25 });
    expect(mockGet).toHaveBeenCalledWith('/members/approvals', { params: { status: 'pending', page: 1, limit: 25 } });
  });

  it('sends a decision and passes on whether the email went out', async () => {
    mockPatch.mockReturnValue(Promise.resolve({ data: { success: true, message: 'Approved', emailSent: false } }));
    const result = await membersManageApi.decideApproval(12, { status: 'rejected', rejectionReason: 'Not a member' });
    expect(mockPatch).toHaveBeenCalledWith('/members/approvals/12', { status: 'rejected', rejectionReason: 'Not a member' });
    expect(result).toEqual({ message: 'Approved', emailSent: false });
  });
});
