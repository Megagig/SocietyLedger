'use client';

import { useState, useEffect } from 'react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { apiGet, apiPost } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  Users, Search, Shield, UserCog, Check, X, 
  ChevronDown, Mail, Calendar
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
  memberId: string | null;
  legacyRole: string;
  platformRole: string | null;
  roles: Array<{
    id: number;
    name: string;
    displayName: string;
    isSystemRole: boolean;
  }>;
  isActive: boolean;
  createdAt: string;
}

interface Role {
  id: number;
  name: string;
  displayName: string;
  isSystemRole: boolean;
}

export default function UsersRolesPage() {
  const { isAdmin, isSuperAdmin } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [page, search]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search })
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/users?${params}`
      );
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.totalPages);
        setTotalCount(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/roles`
      );
      const data = await response.json();
      if (data.success) {
        setRoles(data.data.roles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleAssignRole = async (userId: number, roleId: number) => {
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/assign`,
        { userId, roleId }
      );
      const data = await response.json();
      
      if (data.success) {
        toast.success('Role assigned successfully');
        fetchUsers();
        setIsAssigning(false);
        setSelectedUser(null);
      } else {
        toast.error(data.message || 'Failed to assign role');
      }
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const handleRemoveRole = (user: User, role: Role) => {
    modals.openConfirmModal({
      title: 'Remove Role',
      children: (
        <Text size="sm">
          Are you sure you want to remove the "{role.displayName}" role from {user.name}?
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiPost(
            `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/remove`,
            { userId: user.id, roleId: role.id }
          );
          const data = await response.json();
          
          if (data.success) {
            toast.success('Role removed successfully');
            fetchUsers();
          } else {
            toast.error(data.message || 'Failed to remove role');
          }
        } catch (error) {
          toast.error('Failed to remove role');
        }
      }
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadgeColor = (role: Role) => {
    if (role.isSystemRole) {
      switch (role.name) {
        case 'admin':
          return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
        case 'treasurer':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'financial_secretary':
          return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'member':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        default:
          return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      }
    }
    return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <UserCog className="w-8 h-8 text-teal-500" />
            User Role Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Assign and manage roles for association members ({totalCount} users)
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading users...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-600 dark:text-gray-400">No users found</div>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Member ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center text-white font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {user.memberId || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.platformRole && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium">
                              {user.platformRole}
                            </span>
                          )}
                          {user.roles.map(role => (
                            <span
                              key={role.id}
                              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getRoleBadgeColor(role)}`}
                            >
                              {role.displayName}
                              <Can permission={PERMISSIONS.USER_EDIT}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveRole(user, role);
                                  }}
                                  className="ml-1 hover:text-red-600"
                                  title="Remove role"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Can>
                            </span>
                          ))}
                          {user.roles.length === 0 && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No roles assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Can permission={PERMISSIONS.USER_EDIT}>
                          <div className="relative">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setIsAssigning(true);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors text-sm"
                            >
                              <Shield className="w-4 h-4" />
                              Assign Role
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow px-6 py-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Role Assignment Modal */}
      {isAssigning && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Assign Role to {selectedUser.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select a role to assign to this user
              </p>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto">
              <div className="space-y-2">
                {roles.map(role => {
                  const isAssigned = selectedUser.roles.some(r => r.id === role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => !isAssigned && handleAssignRole(selectedUser.id, role.id)}
                      disabled={isAssigned}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isAssigned
                          ? 'border-green-300 bg-green-50 dark:bg-green-900/20 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-700 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {role.displayName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {role.isSystemRole ? 'System Role' : 'Custom Role'}
                        </div>
                      </div>
                      {isAssigned && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setIsAssigning(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}