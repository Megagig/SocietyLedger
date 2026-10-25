/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { PermissionDTO, RoleDTO, UserWithRolesDTO } from '@/types/api/rbac';
import RoleDetailScreen from '../../../app/(app)/(tabs)/manage/settings/roles/[id]';
import NewRoleScreen from '../../../app/(app)/(tabs)/manage/settings/roles/form';
import UserRolesScreen from '../../../app/(app)/(tabs)/manage/settings/user-roles';

// Roles can only be given and changed within what the person doing it holds, and never to or on yourself.
let mockAllowed: string[] = [];
let mockMe = { id: 1, permissions: ['members.view', 'roles.assign', 'roles.edit', 'roles.view'] };
let mockUsers: UserWithRolesDTO[] = [];
let mockRoles: RoleDTO[] = [];
let mockPermissions: PermissionDTO[] = [];
let mockParams: Record<string, string> = {};
const mockGive = jest.fn();
const mockTake = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/hooks/useCan', () => ({ useCan: (alias: string | string[]) => (Array.isArray(alias) ? alias.some((a) => mockAllowed.includes(a)) : mockAllowed.includes(alias)) }));
jest.mock('@/stores/session', () => ({ useSessionStore: (select: (s: unknown) => unknown) => select({ user: mockMe }) }));
jest.mock('@/providers/ThemeProvider', () => ({ useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }) }));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/feedback/ConfirmSheet', () => ({
  ConfirmSheet: ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="confirm" onPress={onConfirm}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/features/rbac/mutations', () => ({
  useAssignRole: () => ({ mutate: mockGive, isPending: false }),
  useRemoveRole: () => ({ mutate: mockTake, isPending: false }),
  useUpdateRole: () => ({ mutate: mockUpdate, isPending: false }),
  useDeleteRole: () => ({ mutate: mockDelete, isPending: false }),
  useCreateRole: () => ({ mutate: mockCreate, isPending: false }),
}));
jest.mock('@/features/rbac/queries', () => ({
  useUsersInfinite: () => ({ data: { pages: [{ users: mockUsers }] }, isPending: false, isError: false, refetch: jest.fn() }),
  useRoles: () => ({ data: { roles: mockRoles, total: mockRoles.length }, isPending: false, isError: false, refetch: jest.fn() }),
  usePermissions: () => ({ data: { permissions: mockPermissions, total: mockPermissions.length }, isPending: false, isError: false, refetch: jest.fn() }),
}));

const role = (over: Partial<RoleDTO> & { id: number; name: string }): RoleDTO => ({
  displayName: over.name,
  description: null,
  isSystemRole: false,
  isActive: true,
  userCount: 0,
  permissions: [],
  ...over,
});
const person = (id: number, roles: UserWithRolesDTO['roles']): UserWithRolesDTO => ({ id, email: `p${id}@x.ng`, name: `Person ${id}`, roles, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' });

beforeEach(() => {
  jest.clearAllMocks();
  mockAllowed = ['ROLES_VIEW', 'ROLES_ASSIGN', 'ROLES_EDIT'];
  mockMe = { id: 1, permissions: ['members.view', 'roles.assign', 'roles.edit', 'roles.view'] };
  mockRoles = [
    role({ id: 10, name: 'member', displayName: 'Member', isSystemRole: true, permissions: ['members.view'] }),
    role({ id: 11, name: 'treasurer', displayName: 'Treasurer', isSystemRole: true, permissions: ['members.view'] }),
    role({ id: 12, name: 'finance_chief', displayName: 'Finance chief', permissions: ['payments.approve'] }),
    role({ id: 13, name: 'committee', displayName: 'Committee', permissions: ['elections.run'] }),
  ];
  mockUsers = [person(2, [{ id: 10, name: 'member', displayName: 'Member', isSystemRole: true }]), person(1, [{ id: 10, name: 'member', displayName: 'Member', isSystemRole: true }])];
  mockParams = { userId: '2', email: 'p2@x.ng' };
  mockPermissions = [
    { id: 1, key: 'members.view', description: 'View members', module: 'Members' },
    { id: 2, key: 'members.create', description: 'Add members', module: 'Members' },
    { id: 3, key: 'payments.approve', description: 'Approve payments', module: 'Payments' },
  ];
});

describe('giving and taking a role', () => {
  it('offers only roles the person doing it could hold themselves, plus the Election Committee set', async () => {
    await render(<UserRolesScreen />);
    expect(screen.getByTestId('give-role-11')).toBeTruthy(); // treasurer: members.view is held
    expect(screen.queryByTestId('give-role-12')).toBeNull(); // payments.approve is not held
    expect(screen.getByTestId('give-role-13')).toBeTruthy(); // committee set, and roles.assign is held
    expect(screen.queryByTestId('give-role-10')).toBeNull(); // already held
  });

  it('gives a role only after the confirm', async () => {
    await render(<UserRolesScreen />);
    await fireEvent.press(screen.getByTestId('give-role-11'));
    expect(mockGive).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(mockGive).toHaveBeenCalledTimes(1);
    expect(mockGive.mock.calls[0]?.[0]).toEqual({ userId: 2, roleId: 11 });
  });

  it('takes a role away only after the confirm', async () => {
    await render(<UserRolesScreen />);
    await fireEvent.press(screen.getByTestId('remove-role-10'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(mockTake.mock.calls[0]?.[0]).toEqual({ userId: 2, roleId: 10 });
  });

  it('shows no way to change your own roles', async () => {
    mockParams = { userId: '1', email: 'p1@x.ng' };
    await render(<UserRolesScreen />);
    expect(screen.getByTestId('own-roles-note')).toBeTruthy();
    expect(screen.queryByTestId('remove-role-10')).toBeNull();
    expect(screen.queryByText('Give a role')).toBeNull();
  });

  it('shows no buttons to someone who can only view', async () => {
    mockAllowed = ['ROLES_VIEW'];
    await render(<UserRolesScreen />);
    expect(screen.queryByTestId('remove-role-10')).toBeNull();
    expect(screen.queryByText('Give a role')).toBeNull();
  });
});

describe('adding a role', () => {
  beforeEach(() => {
    mockAllowed = ['ROLES_VIEW', 'ROLES_CREATE'];
    mockMe = { id: 1, permissions: ['members.view', 'members.create', 'roles.create', 'roles.view'] };
  });

  it('will not add a role until a permission is chosen', async () => {
    await render(<NewRoleScreen />);
    expect(screen.getByTestId('role-create').props.accessibilityState.disabled).toBe(true);
  });

  it('adds the role with the name, description and permissions chosen, in one step', async () => {
    await render(<NewRoleScreen />);
    await fireEvent.changeText(screen.getByTestId('role-name'), 'Fund raiser');
    await fireEvent.press(screen.getByTestId('perm-group-Members'));
    await fireEvent.press(screen.getByTestId('perm-all-Members'));
    await fireEvent.press(screen.getByTestId('role-create'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const sent = mockCreate.mock.calls[0]?.[0] as { name: string; permissions: string[] };
    expect(sent.name).toBe('Fund raiser');
    expect(sent.permissions.sort()).toEqual(['members.create', 'members.view']);
  });
});

describe('a role\'s permissions', () => {
  const open = async () => {
    mockParams = { id: '11' };
    mockMe = { id: 1, permissions: ['members.view', 'members.create', 'roles.assign', 'roles.edit', 'roles.view'] };
    await render(<RoleDetailScreen />);
    await fireEvent.press(screen.getByTestId('perm-group-Members'));
  };

  it('saves the permissions switched on', async () => {
    await open();
    await fireEvent(screen.getByTestId('perm-members.create'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('role-save'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect((mockUpdate.mock.calls[0]?.[0] as { permissions: string[] }).permissions.sort()).toEqual(['members.create', 'members.view']);
  });

  it('keeps Save off until something changes', async () => {
    await open();
    expect(screen.getByTestId('role-save').props.accessibilityState.disabled).toBe(true);
  });

  it('does not offer a permission the person cannot give', async () => {
    mockParams = { id: '11' };
    await render(<RoleDetailScreen />);
    // Payments has nothing this person could switch on, so the group is not offered at all
    expect(screen.queryByTestId('perm-group-Payments')).toBeNull();
    expect(screen.getByTestId('perm-group-Members')).toBeTruthy();
  });

  it('locks the Administrator role', async () => {
    mockRoles = [role({ id: 11, name: 'admin', displayName: 'Administrator', isSystemRole: true, permissions: ['members.view'] })];
    mockParams = { id: '11' };
    await render(<RoleDetailScreen />);
    expect(screen.getByTestId('admin-locked-note')).toBeTruthy();
    expect(screen.queryByTestId('role-save')).toBeNull();
  });

  it('lets only a custom role with nobody in it be deleted', async () => {
    mockParams = { id: '12' };
    mockMe = { id: 1, permissions: ['members.view', 'roles.assign', 'roles.edit', 'roles.view', 'payments.approve'] };
    await render(<RoleDetailScreen />);
    await fireEvent.press(screen.getByTestId('role-delete'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('finds a permission by its wording and opens the group it is in', async () => {
    mockParams = { id: '11' };
    mockMe = { id: 1, permissions: ['members.view', 'members.create', 'roles.assign', 'roles.edit', 'roles.view'] };
    await render(<RoleDetailScreen />);
    await fireEvent.changeText(screen.getByTestId('perm-search'), 'add mem');
    // the search waits a moment after typing stops
    await waitFor(() => expect(screen.getByTestId('perm-members.create')).toBeTruthy());
    expect(screen.queryByTestId('perm-members.view')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('perm-search'), 'zzz');
    await waitFor(() => expect(screen.getByTestId('perm-none')).toBeTruthy());
  });

  it('turns a whole group on, then off', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('perm-all-Members'));
    await fireEvent.press(screen.getByTestId('role-save'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect((mockUpdate.mock.calls[0]?.[0] as { permissions: string[] }).permissions.sort()).toEqual(['members.create', 'members.view']);
    await fireEvent.press(screen.getByTestId('perm-all-Members'));
    expect(screen.getByTestId('perm-members.create').props.value).toBe(false);
    expect(screen.getByTestId('perm-members.view').props.value).toBe(false);
  });

  it('shows no delete for a built-in role or one that people hold', async () => {
    mockParams = { id: '11' };
    await render(<RoleDetailScreen />);
    expect(screen.queryByTestId('role-delete')).toBeNull();
  });
});
