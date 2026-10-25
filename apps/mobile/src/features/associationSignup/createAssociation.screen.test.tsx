/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SUBDOMAIN_REMINDER } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import CreateAssociationScreen from '../../../app/(auth)/create-association';

// A13: a new association is created in two steps. The naming reminder shows first, the address is suggested from the name and checked,
// step 2 is only reached from a good step 1, and a created association becomes the current tenant before the email is verified.
let mockLookup: { isFetching: boolean; isError: boolean; isSuccess: boolean; error: unknown };
let mockCreateResult: { signup: unknown; tenant: unknown } | Error;
const mockMutate = jest.fn();
const mockReplace = jest.fn();
const mockSetCurrent = jest.fn();
const mockToastError = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), error: (...a: unknown[]) => mockToastError(...a) } }));
jest.mock('@/providers/ThemeProvider', () => ({ useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }) }) }));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/ui/AuthBrandMark', () => ({ AuthBrandMark: () => null }));
jest.mock('@/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: unknown) => value }));
jest.mock('@/stores/tenant', () => ({ useTenantStore: (select: (s: unknown) => unknown) => select({ setCurrent: mockSetCurrent }) }));
jest.mock('@/features/tenant/queries', () => ({ useCheckSubdomain: () => mockLookup }));
jest.mock('@/features/associationSignup/mutations', () => ({ useCreateAssociation: () => ({ mutate: mockMutate, isPending: false }) }));
// The kind-of-association picker opens a bottom sheet; here it is a plain text box wired to the same form field.
jest.mock('@/components/forms/SelectSheet', () => {
  const { TextInput } = require('react-native');
  const { useController } = require('react-hook-form');
  return {
    SelectSheet: ({ control, name, testID }: { control: unknown; name: string; testID: string }) => {
      const { field } = useController({ control, name });
      return <TextInput testID={testID} value={field.value} onChangeText={field.onChange} />;
    },
  };
});

const available = { isFetching: false, isError: true, isSuccess: false, error: new ApiError({ status: 404, message: 'Association not found' }) };
const taken = { isFetching: false, isError: false, isSuccess: true, error: null };

async function fillStepOne(name = 'Oko Youth Forum') {
  await fireEvent.changeText(screen.getByTestId('create-association-name'), name);
  await fireEvent.changeText(screen.getByTestId('create-association-type'), 'town_union');
}

async function fillStepTwo() {
  await fireEvent.changeText(screen.getByTestId('create-association-first-name'), 'Ada');
  await fireEvent.changeText(screen.getByTestId('create-association-last-name'), 'Obi');
  await fireEvent.changeText(screen.getByTestId('create-association-email'), 'ada@example.com');
  await fireEvent.changeText(screen.getByTestId('create-association-phone'), '0803 123 4567');
  await fireEvent.changeText(screen.getByTestId('create-association-password'), 'secret1');
  await fireEvent.changeText(screen.getByTestId('create-association-confirm-password'), 'secret1');
  await fireEvent.press(screen.getByTestId('create-association-terms'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLookup = available;
  mockCreateResult = {
    signup: { association: { id: 9, name: 'Oko Youth Forum', subdomain: 'oko-youth-forum' }, user: { id: 3, email: 'ada@example.com', emailVerified: false }, requiresVerification: true, pendingApproval: true, verificationEmailSent: true },
    tenant: { id: 9, name: 'Oko Youth Forum', slug: 'oko-youth-forum', subdomain: 'oko-youth-forum', tier: 'ENTERPRISE', status: 'ACTIVE', logo: null, primaryColor: null },
  };
  mockMutate.mockImplementation((_payload: unknown, options: { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }) => {
    if (mockCreateResult instanceof Error) options.onError?.(mockCreateResult);
    else options.onSuccess?.(mockCreateResult);
  });
});

describe('Create association (A13)', () => {
  it('reminds the founder, before anything else, that the name becomes their web address', async () => {
    await render(<CreateAssociationScreen />);
    expect(screen.getByTestId('create-association-reminder')).toHaveTextContent(SUBDOMAIN_REMINDER);
  });

  it('suggests the address from the name and says when it is free', async () => {
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    expect(screen.getByTestId('create-association-address').props.value).toBe('oko-youth-forum');
    expect(screen.getByTestId('create-association-preview')).toHaveTextContent('Members will sign in at oko-youth-forum.societyledger.com.ng');
    expect(screen.getByTestId('create-association-available')).toBeTruthy();
  });

  it('keeps the address they typed instead of overwriting it when the name changes', async () => {
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    await fireEvent.changeText(screen.getByTestId('create-association-address'), 'oko-forum');
    await fireEvent.changeText(screen.getByTestId('create-association-name'), 'Oko Youth Forum Lagos');
    expect(screen.getByTestId('create-association-address').props.value).toBe('oko-forum');
  });

  it('does not move on when the address is taken', async () => {
    mockLookup = taken;
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    expect(screen.getByTestId('create-association-taken')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('create-association-next'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('That address is already taken.'));
    expect(screen.queryByTestId('create-association-first-name')).toBeNull();
  });

  it('asks for the founder\'s own words when the kind is Other', async () => {
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    await fireEvent.changeText(screen.getByTestId('create-association-type'), 'other');
    await fireEvent.press(screen.getByTestId('create-association-next'));
    await waitFor(() => expect(screen.getByText('Tell us what kind of association it is')).toBeTruthy());
    expect(screen.queryByTestId('create-association-first-name')).toBeNull();
  });

  it('creates the association, adopts it as the current tenant, and goes to verify the email', async () => {
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    await fireEvent.press(screen.getByTestId('create-association-next'));
    await fillStepTwo();
    await fireEvent.press(screen.getByTestId('create-association-submit'));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({
      association: { name: 'Oko Youth Forum', subdomain: 'oko-youth-forum', type: 'town_union', customType: undefined },
      admin: { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com', phone: '08031234567', password: 'secret1' },
    });
    expect(mockSetCurrent).toHaveBeenCalledWith(expect.objectContaining({ subdomain: 'oko-youth-forum' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/verify-email', params: { email: 'ada@example.com' } });
  });

  it('goes straight to the waiting-for-approval screen when verification is switched off', async () => {
    mockCreateResult = {
      signup: { association: { id: 9, name: 'Oko', subdomain: 'oko' }, user: { id: 3, email: 'ada@example.com', emailVerified: true }, requiresVerification: false, pendingApproval: true, verificationEmailSent: false },
      tenant: { id: 9, name: 'Oko', slug: 'oko', subdomain: 'oko', tier: 'ENTERPRISE', status: 'ACTIVE', logo: null, primaryColor: null },
    };
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    await fireEvent.press(screen.getByTestId('create-association-next'));
    await fillStepTwo();
    await fireEvent.press(screen.getByTestId('create-association-submit'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/pending', params: { email: 'ada@example.com' } }));
  });

  it('sends them back to the address when the server says it was taken in the meantime', async () => {
    mockCreateResult = new ApiError({ status: 409, code: 'SUBDOMAIN_TAKEN', message: 'Slug or subdomain already exists' });
    await render(<CreateAssociationScreen />);
    await fillStepOne();
    await fireEvent.press(screen.getByTestId('create-association-next'));
    await fillStepTwo();
    await fireEvent.press(screen.getByTestId('create-association-submit'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Slug or subdomain already exists'));
    expect(screen.getByTestId('create-association-address')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
