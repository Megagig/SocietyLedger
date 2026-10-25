import { onboardingApi } from './onboarding';
import { associationsApi } from './associations';

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    post: (...a: unknown[]) => mockPost(...a),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('onboardingApi', () => {
  it('reads the wizard status', async () => {
    mockGet.mockReturnValue(ok({ onboarding: { currentStep: 1 } }));
    expect(await onboardingApi.getStatus()).toEqual({ onboarding: { currentStep: 1 } });
    expect(mockGet).toHaveBeenCalledWith('/onboarding/status');
  });

  it('finishes or skips one step on the complete-step route', async () => {
    mockPatch.mockReturnValue(ok({ currentStep: 3 }));
    await onboardingApi.completeStep({ step: 2, stepName: 'team', skipped: true });
    expect(mockPatch).toHaveBeenCalledWith('/onboarding/complete-step', { step: 2, stepName: 'team', skipped: true });
  });

  it('skips the whole wizard with an empty post', async () => {
    mockPost.mockReturnValue(ok({}));
    await onboardingApi.skipAll();
    expect(mockPost).toHaveBeenCalledWith('/onboarding/skip', {});
  });

  it('sends the whole team in one request and hands back what happened to each person', async () => {
    const results = [{ email: 'ngozi@example.com', status: 'invited' }];
    mockPost.mockReturnValue(ok({ results }));
    const body = { invites: [{ firstName: 'Ngozi', lastName: 'Eze', email: 'ngozi@example.com', role: 'treasurer' as const }] };
    expect(await onboardingApi.inviteTeam(body)).toEqual({ results });
    expect(mockPost).toHaveBeenCalledWith('/onboarding/team', body);
  });
});

describe('associationsApi.signup', () => {
  it('posts the new association and its founding admin', async () => {
    const created = { association: { id: 9, name: 'Oko', subdomain: 'oko' }, requiresVerification: true, pendingApproval: true };
    mockPost.mockReturnValue(ok(created));
    const payload = {
      association: { name: 'Oko', subdomain: 'oko', type: 'alumni' },
      admin: { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com', phone: '08031234567', password: 'secret1' },
    };
    expect(await associationsApi.signup(payload)).toEqual(created);
    expect(mockPost).toHaveBeenCalledWith('/associations/signup', payload);
  });
});
