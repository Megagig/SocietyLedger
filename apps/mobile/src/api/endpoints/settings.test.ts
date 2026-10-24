import { settingsApi } from './settings';

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('settingsApi', () => {
  it('reads and saves the profile on the association profile route', async () => {
    mockGet.mockReturnValue(ok({ name: 'Opuogun Union' }));
    mockPatch.mockReturnValue(ok({ name: 'New' }));
    expect(await settingsApi.getProfile()).toEqual({ name: 'Opuogun Union' });
    const payload = { name: 'New', primaryColor: null, associationType: 'general' as const, address: null, city: null, state: null, country: null, phone: null, email: null, website: null };
    await settingsApi.updateProfile(payload);
    expect(mockGet).toHaveBeenCalledWith('/settings/association/profile');
    expect(mockPatch).toHaveBeenCalledWith('/settings/association/profile', payload);
  });

  it('sends the logo as multipart under the field "logo"', async () => {
    mockPost.mockReturnValue(ok({ logoUrl: '/uploads/logos/x.png' }));
    await settingsApi.uploadLogo({ uri: 'file:///x.png', name: 'x.png', type: 'image/png' });
    const [path, form, config] = mockPost.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(path).toBe('/settings/association/logo');
    expect(form).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('removes the logo with a delete on the same route', async () => {
    mockDelete.mockReturnValue(ok({}));
    await settingsApi.deleteLogo();
    expect(mockDelete).toHaveBeenCalledWith('/settings/association/logo');
  });

  it('uses one route per category, with the underscore in members_access', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPatch.mockReturnValue(ok({}));
    await settingsApi.getFinancial();
    await settingsApi.getPayments();
    await settingsApi.getIntegrations();
    await settingsApi.getNotifications();
    await settingsApi.getMembersAccess();
    expect(mockGet.mock.calls.map((c) => c[0])).toEqual([
      '/settings/financial',
      '/settings/payments',
      '/settings/integrations',
      '/settings/notifications',
      '/settings/members_access',
    ]);
    await settingsApi.updateFinancial({ enableLateFees: true });
    await settingsApi.updateMembersAccess({ inviteExpiryHours: 48 });
    expect(mockPatch).toHaveBeenCalledWith('/settings/financial', { enableLateFees: true });
    expect(mockPatch).toHaveBeenCalledWith('/settings/members_access', { inviteExpiryHours: 48 });
  });

  it('reads the plan and the modules it includes', async () => {
    mockGet.mockReturnValue(ok({}));
    await settingsApi.getSubscription();
    await settingsApi.getMyModules();
    expect(mockGet).toHaveBeenNthCalledWith(1, '/subscriptions/current');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/modules/mine');
  });
});
