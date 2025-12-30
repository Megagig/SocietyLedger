'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/lib/toast';
import {
  Settings, Save, Loader2, Users, Building2, CreditCard,
  AlertTriangle, Shield, ToggleLeft, ToggleRight, RefreshCw
} from 'lucide-react';

interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  maxAssociationsPerUser: number;
  defaultTrialDays: number;
  allowNewSignups: boolean;
  requireEmailVerification: boolean;
  requireAdminApproval: boolean;
  defaultAssociationTier: string;
  platformVersion: string;
}

interface PlatformStats {
  totalAssociations: number;
  activeAssociations: number;
  suspendedAssociations: number;
  totalUsers: number;
  totalMembers: number;
  totalTransactions: number;
  pendingApprovals: number;
}

const TIERS = [
  { value: 'STARTER', label: 'Starter' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

export default function PlatformSettingsPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, token]);

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/settings/platform`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }
      );

      const data = await response.json();
      if (data.success) {
        setSettings(data.data.settings);
        setStats(data.data.stats);
      } else {
        toast.error(data.message || 'Failed to load settings');
      }
    } catch (error) {
      toast.error('Failed to load platform settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof PlatformSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!settings || !token) return;
    setIsSaving(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/settings/platform`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(settings),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Platform settings updated');
        setHasChanges(false);
      } else {
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save platform settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Platform Settings</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Platform Settings
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAssociations}</p>
                <p className="text-sm text-gray-500">Associations</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
                <p className="text-sm text-gray-500">Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMembers}</p>
                <p className="text-sm text-gray-500">Members</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingApprovals}</p>
                <p className="text-sm text-gray-500">Pending Approvals</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {settings && (
        <div className="space-y-6">
          {/* Maintenance Mode */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Maintenance Mode
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">Enable Maintenance Mode</label>
                  <p className="text-sm text-gray-500">Temporarily disable access for all users except super admins</p>
                </div>
                <button
                  onClick={() => handleChange('maintenanceMode', !settings.maintenanceMode)}
                  className={`p-2 rounded-lg ${settings.maintenanceMode ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  {settings.maintenanceMode ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              {settings.maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Maintenance Message
                  </label>
                  <textarea
                    value={settings.maintenanceMessage || ''}
                    onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
                    rows={2}
                    placeholder="We're currently performing maintenance. Please check back soon."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Signup Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Signup & Registration
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">Allow New Signups</label>
                  <p className="text-sm text-gray-500">Allow new associations to register</p>
                </div>
                <button
                  onClick={() => handleChange('allowNewSignups', !settings.allowNewSignups)}
                  className={`p-2 rounded-lg ${settings.allowNewSignups ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  {settings.allowNewSignups ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">Require Email Verification</label>
                  <p className="text-sm text-gray-500">Users must verify email before accessing the platform</p>
                </div>
                <button
                  onClick={() => handleChange('requireEmailVerification', !settings.requireEmailVerification)}
                  className={`p-2 rounded-lg ${settings.requireEmailVerification ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  {settings.requireEmailVerification ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">Require Admin Approval</label>
                  <p className="text-sm text-gray-500">New associations require super admin approval</p>
                </div>
                <button
                  onClick={() => handleChange('requireAdminApproval', !settings.requireAdminApproval)}
                  className={`p-2 rounded-lg ${settings.requireAdminApproval ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  {settings.requireAdminApproval ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Default Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-500" />
              Default Settings
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Trial Days
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={settings.defaultTrialDays}
                  onChange={(e) => handleChange('defaultTrialDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Associations Per User
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxAssociationsPerUser}
                  onChange={(e) => handleChange('maxAssociationsPerUser', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Association Tier
                </label>
                <select
                  value={settings.defaultAssociationTier}
                  onChange={(e) => handleChange('defaultAssociationTier', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {TIERS.map(tier => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Platform Version
                </label>
                <input
                  type="text"
                  value={settings.platformVersion}
                  onChange={(e) => handleChange('platformVersion', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/associations"
                className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                Manage Associations
              </Link>
              <Link
                href="/admin/associations"
                className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                Pending Approvals ({stats?.pendingApprovals || 0})
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
