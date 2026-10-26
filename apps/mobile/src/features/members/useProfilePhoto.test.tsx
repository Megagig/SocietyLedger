import { act } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { renderHookWithQueryClient } from '@/test-utils/renderWithProviders';

const mockSetMine = jest.fn();
const mockRemoveMine = jest.fn();
const mockSetFor = jest.fn();
jest.mock('@/api/endpoints/members', () => ({ membersApi: { setMyPhoto: (...a: unknown[]) => mockSetMine(...a), removeMyPhoto: () => mockRemoveMine() } }));
jest.mock('@/api/endpoints/membersManage', () => ({ membersManageApi: { setMemberPhoto: (...a: unknown[]) => mockSetFor(...a), removeMemberPhoto: jest.fn() } }));

const mockPick = jest.fn();
jest.mock('@/components/forms/attachmentPickers', () => ({
  pickProfilePhoto: (...a: unknown[]) => mockPick(...a),
  validateAttachment: (attachment: { type: string }, allowed: string[]) => (allowed.includes(attachment.type) ? null : 'That file type is not supported.'),
}));
jest.mock('@/features/session/queries', () => ({ sessionKeys: { profile: () => ['profile'] } }));
jest.mock('./queries', () => ({ membersKeys: { all: (tenant: string) => [tenant, 'members'] } }));
jest.mock('@/hooks/useTenantKey', () => ({ useTenantKey: () => 'tenant' }));
jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the mocks above
const { useProfilePhoto } = require('./useProfilePhoto');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toast } = require('sonner-native');

type SheetButton = { text: string; onPress?: () => void };
function sheetButtons(): SheetButton[] {
  return (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
}
function press(label: string) {
  return act(async () => {
    sheetButtons().find((b) => b.text === label)!.onPress!();
  });
}

describe('useProfilePhoto', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    [mockSetMine, mockRemoveMine, mockSetFor, mockPick].forEach((m) => m.mockReset());
    (toast.error as jest.Mock).mockClear();
    (toast.success as jest.Mock).mockClear();
  });

  it('offers remove only when there is a photo to remove', async () => {
    const without = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, false));
    await act(async () => {
      without.result.current.choose();
    });
    expect(sheetButtons().map((b) => b.text)).not.toContain('Remove photo');

    const withPhoto = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, true));
    await act(async () => {
      withPhoto.result.current.choose();
    });
    expect(sheetButtons().map((b) => b.text)).toContain('Remove photo');
  });

  it('uploads my own photo through the member endpoint', async () => {
    mockPick.mockResolvedValue({ attachment: { uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/jpeg', size: 1000 } });
    mockSetMine.mockResolvedValue({});
    const { result } = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, false));
    await act(async () => {
      result.current.choose();
    });
    await press('Choose from your photos');
    expect(mockPick).toHaveBeenCalledWith('library');
    expect(mockSetMine).toHaveBeenCalledWith({ uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/jpeg' });
    expect(toast.success).toHaveBeenCalled();
  });

  it('uploads for another member through the officer endpoint with that member id', async () => {
    mockPick.mockResolvedValue({ attachment: { uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/png' } });
    mockSetFor.mockResolvedValue({});
    const { result } = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'member', id: 42 }, true));
    await act(async () => {
      result.current.choose();
    });
    await press('Take a photo');
    expect(mockPick).toHaveBeenCalledWith('camera');
    expect(mockSetFor).toHaveBeenCalledWith(42, { uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/png' });
    expect(mockSetMine).not.toHaveBeenCalled();
  });

  it('does nothing when the person cancels the picker', async () => {
    mockPick.mockResolvedValue(null);
    const { result } = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, false));
    await act(async () => {
      result.current.choose();
    });
    await press('Take a photo');
    expect(mockSetMine).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the permission message, and refuses a type that is not allowed, without uploading', async () => {
    mockPick.mockResolvedValue({ error: 'Camera permission is needed to take a photo.' });
    const { result } = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, false));
    await act(async () => {
      result.current.choose();
    });
    await press('Take a photo');
    expect(toast.error).toHaveBeenCalledWith('Camera permission is needed to take a photo.');

    mockPick.mockResolvedValue({ attachment: { uri: 'file:///x.gif', name: 'x.gif', type: 'image/gif' } });
    await act(async () => {
      result.current.choose();
    });
    await press('Take a photo');
    expect(mockSetMine).not.toHaveBeenCalled();
  });

  it('tells the person when the upload fails', async () => {
    mockPick.mockResolvedValue({ attachment: { uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/jpeg' } });
    mockSetMine.mockRejectedValue(new Error('network'));
    const { result } = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, false));
    await act(async () => {
      result.current.choose();
    });
    await press('Choose from your photos');
    expect(toast.error).toHaveBeenCalledWith('Could not update the photo. Try again.');
  });

  it('removes my photo', async () => {
    mockRemoveMine.mockResolvedValue({});
    const { result } = await renderHookWithQueryClient(() => useProfilePhoto({ kind: 'me' }, true));
    await act(async () => {
      result.current.choose();
    });
    await press('Remove photo');
    expect(mockRemoveMine).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Photo removed');
  });
});
