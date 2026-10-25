import { router } from 'expo-router';

import { routePushNotification } from '@/lib/push';

jest.mock('expo', () => ({ requireOptionalNativeModule: () => null }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/api/endpoints/devices', () => ({ devicesApi: {} }));
jest.mock('@/lib/storage', () => ({
  getBoolean: jest.fn(),
  setBoolean: jest.fn(),
  getString: jest.fn(),
  setString: jest.fn(),
  remove: jest.fn(),
}));

describe('routePushNotification — Phase 4 notification types', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['savings.deposit_decision', '/(app)/(tabs)/money/savings'],
    ['loan.repayment_decision', '/(app)/(tabs)/money/loans'],
    ['guarantor.requested', '/(app)/(tabs)/money/guarantor-requests'],
    ['savings.deposit_submitted', '/(app)/(tabs)/manage'],
    ['loan.repayment_submitted', '/(app)/(tabs)/manage'],
    ['loan.application_submitted', '/(app)/(tabs)/manage'],
    ['user.approval_pending', '/(app)/(tabs)/manage'],
  ])('%s opens %s', (type, href) => {
    routePushNotification({ type, entityId: 5 });
    expect(router.push).toHaveBeenCalledWith(href);
  });

  it('opens the right side of a support ticket', () => {
    routePushNotification({ type: 'support.ticket_created', entityId: 5 });
    expect(router.push).toHaveBeenCalledWith('/(app)/(tabs)/manage/support/5');
    routePushNotification({ type: 'support.ticket_reply', entityId: 5 });
    expect(router.push).toHaveBeenCalledWith('/(app)/(tabs)/profile/help/tickets/5');
  });
});
