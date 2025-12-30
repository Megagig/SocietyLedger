'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  Shield, Plus, Edit, Trash2, Users, ChevronRight, 
  Lock, Settings, Search, Check, X 
} from 'lucide-react';

interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  userCount: number;
  permissions: string[];
  createdAt: string;
}

interface Permission {
  id: number;
  key: string;
  description: string;
  module: string;
  examples: string[];
}

export default function RolesPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/roles`
      );
      const data = await response.json();
      if (data.success) {
        setRoles(data.data.roles);
        if (data.data.roles.length > 0 && !selectedRole) {
          setSelectedRole(data.data.roles[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/permissions`
      );
      const data = await response.json();
      if (data.success) {
        setPermissions(data.data.permissions);
        setGroupedPermissions(data.data.grouped);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/roles`,
        {
          name: formData.displayName.toLowerCase().replace(/\s+/g, '_'),
          displayName: formData.displayName,
          description: formData.description,
          permissions: formData.permissions
        }
      );
      const data = await response.json();
      
      if (data.success) {
        toast.success('Role created successfully');
        setIsCreating(false);
        resetForm();
        fetchRoles();
      } else {
        toast.error(data.message || 'Failed to create role');
      }
    } catch (error) {
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;
    
    try {
      const response = await apiPut(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/roles/${selectedRole.id}`,
        {
          displayName: formData.displayName,
          description: formData.description,
          permissions: formData.permissions
        }
      );
      const data = await response.json();
      
      if (data.success) {
        toast.success('Role updated successfully');
        setIsEditing(false);
        fetchRoles();
      } else {
        toast.error(data.message || 'Failed to update role');
      }
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = (role: Role) => {
    if (role.isSystemRole) {
      toast.error('Cannot delete system roles');
      return;
    }

    modals.openConfirmModal({
      title: 'Delete Role',
      children: (
        <Text size="sm">
          Are you sure you want to delete the role "{role.displayName}"? 
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/rbac/roles/${role.id}`
          );
          const data = await response.json();
          
          if (data.success) {
            toast.success('Role deleted successfully');
            if (selectedRole?.id === role.id) {
              setSelectedRole(null);
            }
            fetchRoles();
          } else {
            toast.error(data.message || 'Failed to delete role');
          }
        } catch (error) {
          toast.error('Failed to delete role');
        }
      }
    });
  };

  const startEditing = (role: Role) => {
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissions: role.permissions
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
    setIsEditing(false);
    setSelectedRole(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      permissions: []
    });
  };

  const togglePermission = (permKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey]
    }));
  };

  const toggleModulePermissions = (module: string) => {
    const modulePerms = groupedPermissions[module]?.map(p => p.key) || [];
    const allSelected = modulePerms.every(p => formData.permissions.includes(p));
    
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !modulePerms.includes(p))
        : [...new Set([...prev.permissions, ...modulePerms])]
    }));
  };

  const filteredPermissions = search
    ? Object.entries(groupedPermissions).reduce((acc, [module, perms]) => {
        const filtered = perms.filter(p => 
          p.key.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
        );
        if (filtered.length > 0) acc[module] = filtered;
        return acc;
      }, {} as Record<string, Permission[]>)
    : groupedPermissions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-teal-500" />
            Roles & Permissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage user roles and their permissions
          </p>
        </div>
        
        <Can permission={PERMISSIONS.SETTINGS_EDIT}>
          <button
            onClick={startCreating}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </Can>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Roles</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => {
                  setSelectedRole(role);
                  setIsEditing(false);
                  setIsCreating(false);
                }}
                className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedRole?.id === role.id ? 'bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {role.isSystemRole ? (
                      <Lock className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Settings className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {role.displayName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        {role.userCount} users
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Details / Edit Form */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
          {isCreating ? (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Create New Role
              </h2>
              <RoleForm
                formData={formData}
                setFormData={setFormData}
                groupedPermissions={filteredPermissions}
                search={search}
                setSearch={setSearch}
                togglePermission={togglePermission}
                toggleModulePermissions={toggleModulePermissions}
                onSave={handleCreateRole}
                onCancel={() => {
                  setIsCreating(false);
                  resetForm();
                }}
                isSystemRole={false}
              />
            </div>
          ) : isEditing && selectedRole ? (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Edit Role: {selectedRole.displayName}
                {selectedRole.isSystemRole && (
                  <span className="ml-2 text-sm text-amber-500">(System Role - Limited Editing)</span>
                )}
              </h2>
              <RoleForm
                formData={formData}
                setFormData={setFormData}
                groupedPermissions={filteredPermissions}
                search={search}
                setSearch={setSearch}
                togglePermission={togglePermission}
                toggleModulePermissions={toggleModulePermissions}
                onSave={handleUpdateRole}
                onCancel={() => {
                  setIsEditing(false);
                  resetForm();
                }}
                isSystemRole={selectedRole.isSystemRole}
              />
            </div>
          ) : selectedRole ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {selectedRole.displayName}
                    {selectedRole.isSystemRole && (
                      <span title="System Role">
                        <Lock className="w-4 h-4 text-amber-500" />
                      </span>
                    )}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedRole.description || 'No description'}
                  </p>
                </div>
                <Can permission={PERMISSIONS.SETTINGS_EDIT}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(selectedRole)}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    {!selectedRole.isSystemRole && (
                      <button
                        onClick={() => handleDeleteRole(selectedRole)}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </Can>
              </div>

              {/* Role Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                    {selectedRole.userCount}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Users Assigned</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedRole.permissions.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Permissions</div>
                </div>
              </div>

              {/* Permissions List */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Assigned Permissions
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {Object.entries(groupedPermissions).map(([module, perms]) => {
                    const modulePerms = perms.filter(p => selectedRole.permissions.includes(p.key));
                    if (modulePerms.length === 0) return null;
                    
                    return (
                      <div key={module} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">{module}</h4>
                        <div className="flex flex-wrap gap-2">
                          {modulePerms.map(perm => (
                            <span
                              key={perm.key}
                              className="px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded text-sm"
                              title={perm.description}
                            >
                              {perm.key}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 flex items-center justify-center min-h-[400px] text-gray-500 dark:text-gray-400">
              Select a role to view details or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Role Form Component
interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
}

interface RoleFormProps {
  formData: RoleFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoleFormData>>;
  groupedPermissions: Record<string, Permission[]>;
  search: string;
  setSearch: (search: string) => void;
  togglePermission: (key: string) => void;
  toggleModulePermissions: (module: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSystemRole: boolean;
}

function RoleForm({
  formData,
  setFormData,
  groupedPermissions,
  search,
  setSearch,
  togglePermission,
  toggleModulePermissions,
  onSave,
  onCancel,
  isSystemRole
}: RoleFormProps) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      {!isSystemRole && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Finance Manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              placeholder="Brief description of this role"
            />
          </div>
        </div>
      )}

      {/* Permissions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Permissions ({formData.permissions.length} selected)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="Search permissions..."
            />
          </div>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          {Object.entries(groupedPermissions).map(([module, perms]) => {
            const allSelected = perms.every(p => formData.permissions.includes(p.key));
            const someSelected = perms.some(p => formData.permissions.includes(p.key));
            
            return (
              <div key={module} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                <div 
                  className="flex items-center gap-2 mb-2 cursor-pointer"
                  onClick={() => toggleModulePermissions(module)}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    allSelected 
                      ? 'bg-teal-500 border-teal-500' 
                      : someSelected 
                        ? 'bg-teal-200 border-teal-500' 
                        : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {allSelected && <Check className="w-3 h-3 text-white" />}
                    {someSelected && !allSelected && <div className="w-2 h-2 bg-teal-500 rounded-sm" />}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{module}</span>
                  <span className="text-sm text-gray-500">({perms.length})</span>
                </div>
                
                <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {perms.map(perm => (
                    <div
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        formData.permissions.includes(perm.key) ? 'bg-teal-50 dark:bg-teal-900/20' : ''
                      }`}
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${
                        formData.permissions.includes(perm.key)
                          ? 'bg-teal-500 border-teal-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {formData.permissions.includes(perm.key) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {perm.key}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {perm.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!formData.displayName || formData.permissions.length === 0}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Role
        </button>
      </div>
    </div>
  );
}