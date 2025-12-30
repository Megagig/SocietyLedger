'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type PlatformModule = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isCore: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

type PlatformFeature = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  moduleCode: string;
  isActive: boolean;
  createdAt: string;
};

export default function PlatformModulesPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'modules' | 'features'>('modules');
  const [searchQuery, setSearchQuery] = useState('');

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
      const [modulesRes, featuresRes] = await Promise.all([
        fetch(API_ROUTES.PLATFORM_ADMIN.MODULES, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.PLATFORM_ADMIN.FEATURES, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const [modulesData, featuresData] = await Promise.all([
        modulesRes.json(),
        featuresRes.json(),
      ]);

      if (modulesData.success) setModules(modulesData.data || []);
      if (featuresData.success) setFeatures(featuresData.data || []);
    } catch (e) {
      console.error('Failed to fetch modules/features:', e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filteredModules = modules.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFeatures = features.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.moduleCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group features by module
  const featuresByModule = filteredFeatures.reduce((acc, feature) => {
    const key = feature.moduleCode || 'core';
    if (!acc[key]) acc[key] = [];
    acc[key].push(feature);
    return acc;
  }, {} as Record<string, PlatformFeature[]>);

  if (user?.platformRole !== 'SUPER_ADMIN') return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
          <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Modules & Features</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Modules & Features</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          View all platform modules and features. Use tenant management to override for specific associations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Modules</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{modules.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Core Modules</div>
          <div className="text-2xl font-bold text-blue-600">{modules.filter(m => m.isCore).length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Features</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{features.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Active Features</div>
          <div className="text-2xl font-bold text-green-600">{features.filter(f => f.isActive).length}</div>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('modules')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'modules' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
            Modules ({modules.length})
          </button>
          <button onClick={() => setActiveTab('features')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'features' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
            Features ({features.length})
          </button>
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full md:w-64"
        />
      </div>

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Module</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Code</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Description</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Features</th>
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((module) => (
                  <tr key={module.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 dark:text-white">{module.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{module.code}</code>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {module.description || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {module.isCore ? (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">Core</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded">Optional</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {module.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">Active</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">Inactive</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {features.filter(f => f.moduleCode === module.code).length}
                    </td>
                  </tr>
                ))}
                {filteredModules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">No modules found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          {Object.entries(featuresByModule).map(([moduleCode, moduleFeatures]) => (
            <div key={moduleCode} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white uppercase tracking-wide text-sm">
                  {moduleCode} Module ({moduleFeatures.length} features)
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {moduleFeatures.map((feature) => (
                  <div key={feature.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{feature.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{feature.code}</code>
                        {feature.description && <span className="ml-2">{feature.description}</span>}
                      </div>
                    </div>
                    <div>
                      {feature.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">Active</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">Inactive</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(featuresByModule).length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500 border border-gray-200 dark:border-gray-700">
              No features found
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">💡 Managing Module & Feature Access</h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          To enable or disable modules/features for a specific tenant, go to{' '}
          <Link href="/admin/tenants" className="underline hover:text-blue-900 dark:hover:text-blue-200">Tenant Management</Link>
          {' '}and select the tenant you want to configure. You can set overrides that take precedence over the default plan settings.
        </p>
      </div>
    </div>
  );
}
