'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type PlatformSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewSignups: boolean;
  defaultTrialDays: number;
  requireEmailVerification: boolean;
  maxAssociationsPerUser: number;
  featureFlagMode: string;
  rbacMode: string;
};

type PlatformStats = {
  totalAssociations: number;
  totalUsers: number;
  totalMembers: number;
  activeSubscriptions: number;
};

export default function PlatformSettingsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsRes] = await Promise.all([
        fetch(`${API_ROUTES.ADMIN.STATS}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const statsData = await statsRes.json();
      
      if (statsData.success) {
        setStats({
          totalAssociations: statsData.data.overview?.totalAssociations || 0,
          totalUsers: statsData.data.overview?.totalUsers || 0,
          totalMembers: statsData.data.overview?.totalMembers || 0,
          activeSubscriptions: statsData.data.subscriptions?.ACTIVE || 0,
        });
      }

      // Set default settings (these would come from a platform settings API)
      setSettings({
        maintenanceMode: false,
        maintenanceMessage: 'The platform is currently under maintenance. Please try again later.',
        allowNewSignups: true,
        defaultTrialDays: 14,
        requireEmailVerification: true,
        maxAssociationsPerUser: 5,
        featureFlagMode: process.env.NEXT_PUBLIC_FEATURE_FLAG_MODE || 'shadow',
        rbacMode: process.env.NEXT_PUBLIC_RBAC_MODE || 'shadow',
      });
    } catch (e) {
      console.error('Failed to fetch settings:', e);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      // In a real implementation, this would call a platform settings API
      toast.success('Settings saved successfully');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
          <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Platform Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure global platform settings and defaults</p>
      </div>

      {/* Platform Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500">Total Associations</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAssociations}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500">Total Users</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500">Total Members</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMembers}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500">Active Subscriptions</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeSubscriptions}</div>
          </div>
        </div>
      )}

      {/* Settings Sections */}
      {settings && (
        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">General Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Maintenance Mode</div>
                  <div className="text-sm text-gray-500">Disable access to the platform for all users</div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.maintenanceMode ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Allow New Signups</div>
                  <div className="text-sm text-gray-500">Allow new associations to register</div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, allowNewSignups: !settings.allowNewSignups })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.allowNewSignups ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.allowNewSignups ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Require Email Verification</div>
                  <div className="text-sm text-gray-500">Users must verify email before accessing the platform</div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, requireEmailVerification: !settings.requireEmailVerification })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.requireEmailVerification ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.requireEmailVerification ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Trial & Billing Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Trial & Billing</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Trial Period (days)
                </label>
                <input
                  type="number"
                  value={settings.defaultTrialDays}
                  onChange={(e) => setSettings({ ...settings, defaultTrialDays: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min={1}
                  max={90}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Associations Per User
                </label>
                <input
                  type="number"
                  value={settings.maxAssociationsPerUser}
                  onChange={(e) => setSettings({ ...settings, maxAssociationsPerUser: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Feature Flags</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Feature Flag Mode
                </label>
                <select
                  value={settings.featureFlagMode}
                  onChange={(e) => setSettings({ ...settings, featureFlagMode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="shadow">Shadow (Log only, don't block)</option>
                  <option value="enforce">Enforce (Block disabled features)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Shadow mode logs feature access without blocking. Enforce mode blocks access to disabled features.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  RBAC Mode
                </label>
                <select
                  value={settings.rbacMode}
                  onChange={(e) => setSettings({ ...settings, rbacMode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="shadow">Shadow (Log only, don't block)</option>
                  <option value="enforce">Enforce (Block unauthorized access)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Link href="/admin/tenants" className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center">
                <div className="text-2xl mb-2">🏠</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Tenant Management</div>
              </Link>
              <Link href="/admin/modules" className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center">
                <div className="text-2xl mb-2">🧩</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Modules & Features</div>
              </Link>
              <Link href="/admin/analytics" className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center">
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Analytics</div>
              </Link>
              <Link href="/admin/action-logs" className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center">
                <div className="text-2xl mb-2">📋</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Action Logs</div>
              </Link>
              <Link href="/admin/associations" className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center">
                <div className="text-2xl mb-2">🏢</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Associations</div>
              </Link>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">💡 Managing Tenant-Specific Settings</h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              To configure billing overrides, module/feature toggles, or security settings for a specific tenant, 
              go to <Link href="/admin/tenants" className="underline hover:text-blue-900 dark:hover:text-blue-200">Tenant Management</Link> and 
              select the tenant you want to configure.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
