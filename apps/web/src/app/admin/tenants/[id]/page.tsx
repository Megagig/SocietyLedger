'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type TenantStatus = {
  id: number;
  name: string;
  subdomain: string;
  tier: string;
  status: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletionReason: string | null;
  subscription: {
    status: string;
    plan: { name: string; priceMonthly: number };
    currentPeriodEnd: string;
    billingCycle: string;
  } | null;
  userCount: number;
  memberCount: number;
  securitySettings: {
    force2FA: boolean;
    passwordPolicyLevel: string;
    sessionTimeoutMinutes: number;
    ipRestrictions: string[];
  };
  createdAt: string;
  updatedAt: string;
};

type Module = {
  code: string;
  name: string;
  isCore: boolean;
  isEnabled: boolean;
  source: string;
  override?: { reason: string; expiresAt: string | null };
};

type Feature = {
  code: string;
  name: string;
  moduleCode: string;
  isEnabled: boolean;
  source: string;
  override?: { reason: string; expiresAt: string | null };
};

type BillingOverride = {
  id: number;
  overrideType: string;
  value: string | null;
  reason: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { token, user } = useAuthStore();
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'features' | 'billing' | 'security'>('overview');

  // Modal states
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [billingAction, setBillingAction] = useState<'extend-trial' | 'apply-credit' | 'bypass' | 'discount' | 'grace-period' | null>(null);

  const tenantId = Number(params.id);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, tenantId]);

  const fetchData = async () => {
    if (!token || !tenantId || isNaN(tenantId)) {
      setError('Invalid tenant ID or not authenticated');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const [statusRes, modulesRes, billingRes] = await Promise.all([
        fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_STATUS(tenantId), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_MODULES(tenantId), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_BILLING_HISTORY(tenantId), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const [statusData, modulesData, billingData] = await Promise.all([
        statusRes.json(),
        modulesRes.json(),
        billingRes.json(),
      ]);

      if (statusData.success && statusData.data) {
        setTenantStatus(statusData.data);
      } else {
        setError(statusData.message || 'Tenant not found');
      }
      if (modulesData.success) {
        setModules(modulesData.data?.modules || []);
        setFeatures(modulesData.data?.features || []);
      }
      if (billingData.success) {
        setBillingHistory(billingData.data?.overrides || []);
      }
    } catch (e) {
      console.error('Failed to fetch tenant data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load tenant data');
      toast.error('Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, body?: object) => {
    setActionLoading(true);
    try {
      let url = '';
      switch (action) {
        case 'suspend': url = API_ROUTES.PLATFORM_ADMIN.TENANT_SUSPEND(tenantId); break;
        case 'reactivate': url = API_ROUTES.PLATFORM_ADMIN.TENANT_REACTIVATE(tenantId); break;
        case 'soft-delete': url = API_ROUTES.PLATFORM_ADMIN.TENANT_SOFT_DELETE(tenantId); break;
        case 'restore': url = API_ROUTES.PLATFORM_ADMIN.TENANT_RESTORE(tenantId); break;
        case 'force-logout': url = API_ROUTES.PLATFORM_ADMIN.TENANT_FORCE_LOGOUT(tenantId); break;
        default: return;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Action completed');
        fetchData();
      } else {
        toast.error(data.message || 'Action failed');
      }
    } catch (e) {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleModuleToggle = async (moduleCode: string, isEnabled: boolean, reason?: string, expiresAt?: string) => {
    try {
      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_MODULE_OVERRIDE(tenantId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moduleCode, isEnabled, reason: reason || 'Manual override', expiresAt }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Module ${isEnabled ? 'enabled' : 'disabled'}`);
        fetchData();
        setShowModuleModal(false);
        setSelectedModule(null);
      } else {
        toast.error(data.message || 'Failed to update module');
      }
    } catch (e) {
      toast.error('Failed to update module');
    }
  };

  const handleFeatureToggle = async (featureCode: string, isEnabled: boolean, reason?: string, expiresAt?: string) => {
    try {
      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_FEATURE_OVERRIDE(tenantId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ featureCode, isEnabled, reason: reason || 'Manual override', expiresAt }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Feature ${isEnabled ? 'enabled' : 'disabled'}`);
        fetchData();
        setShowFeatureModal(false);
        setSelectedFeature(null);
      } else {
        toast.error(data.message || 'Failed to update feature');
      }
    } catch (e) {
      toast.error('Failed to update feature');
    }
  };

  const handleRemoveFeatureOverride = async (featureCode: string) => {
    if (!confirm('Remove override and revert to plan default?')) return;
    try {
      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_FEATURE_REMOVE(tenantId, featureCode), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Feature override removed');
        fetchData();
      } else {
        toast.error(data.message || 'Failed to remove override');
      }
    } catch (e) {
      toast.error('Failed to remove override');
    }
  };

  const handleRemoveOverride = async (moduleCode: string) => {
    if (!confirm('Remove override and revert to plan default?')) return;
    try {
      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_MODULE_REMOVE(tenantId, moduleCode), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Override removed');
        fetchData();
      } else {
        toast.error(data.message || 'Failed to remove override');
      }
    } catch (e) {
      toast.error('Failed to remove override');
    }
  };

  const handleBillingAction = async (action: string, formData: { days?: number; amount?: number; reason: string; endDate?: string; discountPercent?: number }) => {
    try {
      let url = '';
      let body: any = { reason: formData.reason };

      switch (action) {
        case 'extend-trial':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_EXTEND_TRIAL(tenantId);
          body.days = formData.days;
          break;
        case 'apply-credit':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_APPLY_CREDIT(tenantId);
          body.amount = formData.amount;
          break;
        case 'bypass':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_BILLING_OVERRIDE(tenantId);
          body.overrideType = 'BYPASS_BILLING';
          if (formData.endDate) body.endDate = formData.endDate;
          break;
        case 'discount':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_BILLING_OVERRIDE(tenantId);
          body.overrideType = 'APPLY_CREDIT';
          body.value = String(formData.discountPercent);
          if (formData.endDate) body.endDate = formData.endDate;
          break;
        case 'grace-period':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_BILLING_OVERRIDE(tenantId);
          body.overrideType = 'GRACE_PERIOD';
          body.value = String(formData.days);
          if (formData.endDate) body.endDate = formData.endDate;
          break;
        case 'pause':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_BILLING_OVERRIDE(tenantId);
          body.overrideType = 'PAUSE_BILLING';
          if (formData.endDate) body.endDate = formData.endDate;
          break;
        default:
          return;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Billing action completed');
        fetchData();
        setShowBillingModal(false);
        setBillingAction(null);
      } else {
        toast.error(data.message || 'Billing action failed');
      }
    } catch (e) {
      toast.error('Billing action failed');
    }
  };

  const handleRevokeBillingOverride = async (overrideId: number) => {
    const reason = prompt('Enter reason for revoking this override:');
    if (!reason) return;

    try {
      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.BILLING_OVERRIDE_REVOKE(overrideId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Override revoked');
        fetchData();
      } else {
        toast.error(data.message || 'Failed to revoke override');
      }
    } catch (e) {
      toast.error('Failed to revoke override');
    }
  };

  const handleSecurityUpdate = async () => {
    if (!tenantStatus || !securitySettings) return;
    const force2FA = confirm('Enforce 2FA for all users?');
    const sessionTimeout = prompt('Session timeout (minutes):', String(securitySettings.sessionTimeoutMinutes || 60));
    if (!sessionTimeout) return;

    try {
      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_SECURITY(tenantId), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          force2FA,
          sessionTimeoutMinutes: Number(sessionTimeout),
          reason: 'Security settings update',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Security settings updated');
        fetchData();
      } else {
        toast.error(data.message || 'Failed to update security settings');
      }
    } catch (e) {
      toast.error('Failed to update security settings');
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') return null;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading tenant details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Error Loading Tenant</h2>
          <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
          <div className="flex gap-3">
            <button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Retry
            </button>
            <Link href="/admin/tenants" className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
              Back to Tenants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!tenantStatus) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Tenant Not Found</h2>
          <p className="text-yellow-700 dark:text-yellow-400 mb-4">The requested tenant could not be found or you don't have permission to view it.</p>
          <Link href="/admin/tenants" className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 inline-block">
            Back to Tenants
          </Link>
        </div>
      </div>
    );
  }

  const { subscription, securitySettings } = tenantStatus;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/tenants" className="hover:text-blue-600">Tenants</Link>
            <span>/</span>
            <span>{tenantStatus.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {tenantStatus.name}
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              tenantStatus.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              tenantStatus.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {tenantStatus.status}
            </span>
            {tenantStatus.isDeleted && <span className="px-2 py-1 rounded text-sm font-medium bg-red-100 text-red-800">DELETED</span>}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{tenantStatus.subdomain}.societyledger.com</p>
        </div>
        <div className="flex gap-2">
          {tenantStatus.isDeleted ? (
            <button onClick={() => handleAction('restore')} disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              Restore
            </button>
          ) : (
            <>
              {tenantStatus.status === 'ACTIVE' ? (
                <button onClick={() => { const r = prompt('Suspension reason:'); if (r) handleAction('suspend', { reason: r }); }}
                  disabled={actionLoading} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50">
                  Suspend
                </button>
              ) : (
                <button onClick={() => handleAction('reactivate')} disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  Reactivate
                </button>
              )}
              <button onClick={() => { const r = prompt('Reason:'); if (r) handleAction('force-logout', { reason: r }); }}
                disabled={actionLoading} className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50">
                Force Logout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Users" value={tenantStatus.userCount} icon="👥" />
        <StatCard label="Members" value={tenantStatus.memberCount} icon="👤" />
        <StatCard label="Tier" value={tenantStatus.tier} icon="⭐" />
        <StatCard label="Status" value={tenantStatus.status} icon="📊" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'modules', 'features', 'billing', 'security'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm capitalize transition ${
                activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Tenant Details</h3>
            <dl className="space-y-3">
              <DetailRow label="ID" value={tenantStatus.id} />
              <DetailRow label="Subdomain" value={tenantStatus.subdomain} />
              <DetailRow label="Tier" value={tenantStatus.tier} />
              <DetailRow label="Created" value={new Date(tenantStatus.createdAt).toLocaleDateString()} />
              {tenantStatus.isDeleted && (
                <>
                  <DetailRow label="Deleted At" value={tenantStatus.deletedAt ? new Date(tenantStatus.deletedAt).toLocaleDateString() : '-'} />
                  <DetailRow label="Deletion Reason" value={tenantStatus.deletionReason || '-'} />
                </>
              )}
            </dl>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subscription</h3>
            {subscription ? (
              <dl className="space-y-3">
                <DetailRow label="Plan" value={subscription.plan?.name || 'N/A'} />
                <DetailRow label="Status" value={subscription.status} />
                <DetailRow label="Billing" value={subscription.billingCycle || 'N/A'} />
                <DetailRow label="Period Ends" value={subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'} />
              </dl>
            ) : (
              <p className="text-gray-500">No active subscription</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Module Management</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toggle modules on/off for this tenant. Overrides take precedence over plan defaults.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {modules.map((module) => (
              <div key={module.code} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{module.name}</span>
                    {module.isCore && <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">Core</span>}
                    {module.override && <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded">Override</span>}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Code: {module.code} • Source: {module.source}
                    {module.override && (
                      <span className="ml-2 text-purple-600 dark:text-purple-400">
                        Reason: {module.override.reason}
                        {module.override.expiresAt && ` • Expires: ${new Date(module.override.expiresAt).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {module.override && (
                    <button onClick={() => handleRemoveOverride(module.code)}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400">
                      Remove Override
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedModule(module); setShowModuleModal(true); }}
                    disabled={module.isCore}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Configure
                  </button>
                  <button
                    onClick={() => handleModuleToggle(module.code, !module.isEnabled, 'Quick toggle')}
                    disabled={module.isCore}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      module.isEnabled ? 'bg-green-600' : 'bg-gray-300'
                    } ${module.isCore ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      module.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
            {modules.length === 0 && (
              <p className="text-center text-gray-500 py-8">No modules found</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'features' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Feature Toggles</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable or disable specific features within modules. Features are grouped by their parent module.
              </p>
            </div>
          </div>
          {/* Group features by module */}
          {Object.entries(
            features.reduce((acc, feature) => {
              const key = feature.moduleCode || 'core';
              if (!acc[key]) acc[key] = [];
              acc[key].push(feature);
              return acc;
            }, {} as Record<string, Feature[]>)
          ).map(([moduleCode, moduleFeatures]) => (
            <div key={moduleCode} className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                {moduleCode} Features
              </h4>
              <div className="space-y-2">
                {moduleFeatures.map((feature) => (
                  <div key={feature.code} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{feature.name}</span>
                        {feature.override && <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded">Override</span>}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Code: {feature.code} • Source: {feature.source}
                        {feature.override && (
                          <span className="ml-2 text-purple-600 dark:text-purple-400">
                            Reason: {feature.override.reason}
                            {feature.override.expiresAt && ` • Expires: ${new Date(feature.override.expiresAt).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {feature.override && (
                        <button onClick={() => handleRemoveFeatureOverride(feature.code)}
                          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400">
                          Remove Override
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedFeature(feature); setShowFeatureModal(true); }}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Configure
                      </button>
                      <button
                        onClick={() => handleFeatureToggle(feature.code, !feature.isEnabled, 'Quick toggle')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          feature.isEnabled ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          feature.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {features.length === 0 && (
            <p className="text-center text-gray-500 py-8">No features found</p>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Billing Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing Actions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Apply billing overrides, credits, or special arrangements for this tenant.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <button onClick={() => { setBillingAction('extend-trial'); setShowBillingModal(true); }}
                className="flex flex-col items-center p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                <span className="text-2xl mb-2">📅</span>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Extend Trial</span>
              </button>
              <button onClick={() => { setBillingAction('apply-credit'); setShowBillingModal(true); }}
                className="flex flex-col items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition">
                <span className="text-2xl mb-2">💰</span>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Apply Credit</span>
              </button>
              <button onClick={() => { setBillingAction('bypass'); setShowBillingModal(true); }}
                className="flex flex-col items-center p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition">
                <span className="text-2xl mb-2">🔓</span>
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Bypass Billing</span>
              </button>
              <button onClick={() => { setBillingAction('discount'); setShowBillingModal(true); }}
                className="flex flex-col items-center p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition">
                <span className="text-2xl mb-2">🏷️</span>
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Apply Discount</span>
              </button>
              <button onClick={() => { setBillingAction('grace-period'); setShowBillingModal(true); }}
                className="flex flex-col items-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition">
                <span className="text-2xl mb-2">⏳</span>
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Grace Period</span>
              </button>
              <button onClick={() => { setBillingAction('pause' as any); setShowBillingModal(true); }}
                className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <span className="text-2xl mb-2">⏸️</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pause Billing</span>
              </button>
            </div>
          </div>

          {/* Active Overrides */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Active Billing Overrides</h3>
            {billingHistory.filter(o => o.isActive).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No active billing overrides</p>
            ) : (
              <div className="space-y-3">
                {billingHistory.filter(o => o.isActive).map((override) => (
                  <div key={override.id} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                          {override.overrideType.replace(/_/g, ' ')}
                        </span>
                        {override.value && <span className="text-sm text-gray-600 dark:text-gray-300">Value: {override.value}</span>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{override.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Started: {new Date(override.startDate).toLocaleDateString()}
                        {override.endDate && ` • Ends: ${new Date(override.endDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button onClick={() => handleRevokeBillingOverride(override.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Override History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing Override History</h3>
            {billingHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No billing override history</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Value</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Reason</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Start</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">End</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((override) => (
                      <tr key={override.id} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-2 px-3 text-gray-900 dark:text-white">{override.overrideType.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{override.value || '-'}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">{override.reason}</td>
                        <td className="py-2 px-3 text-gray-500">{new Date(override.startDate).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-gray-500">{override.endDate ? new Date(override.endDate).toLocaleDateString() : 'Indefinite'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            override.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {override.isActive ? 'Active' : 'Expired'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Security Settings</h3>
            <button onClick={handleSecurityUpdate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Update Settings
            </button>
          </div>
          <dl className="space-y-3">
            <DetailRow label="Force 2FA" value={securitySettings?.force2FA ? 'Yes' : 'No'} />
            <DetailRow label="Password Policy" value={securitySettings?.passwordPolicyLevel || 'standard'} />
            <DetailRow label="Session Timeout" value={`${securitySettings?.sessionTimeoutMinutes || 60} minutes`} />
            <DetailRow label="IP Restrictions" value={securitySettings?.ipRestrictions?.length > 0 ? securitySettings.ipRestrictions.join(', ') : 'None'} />
          </dl>
        </div>
      )}

      {/* Module Override Modal */}
      {showModuleModal && selectedModule && (
        <ModuleOverrideModal
          module={selectedModule}
          onClose={() => { setShowModuleModal(false); setSelectedModule(null); }}
          onSave={(isEnabled, reason, expiresAt) => handleModuleToggle(selectedModule.code, isEnabled, reason, expiresAt)}
        />
      )}

      {/* Feature Override Modal */}
      {showFeatureModal && selectedFeature && (
        <FeatureOverrideModal
          feature={selectedFeature}
          onClose={() => { setShowFeatureModal(false); setSelectedFeature(null); }}
          onSave={(isEnabled, reason, expiresAt) => handleFeatureToggle(selectedFeature.code, isEnabled, reason, expiresAt)}
        />
      )}

      {/* Billing Action Modal */}
      {showBillingModal && billingAction && (
        <BillingActionModal
          action={billingAction}
          onClose={() => { setShowBillingModal(false); setBillingAction(null); }}
          onSave={(formData) => handleBillingAction(billingAction, formData)}
        />
      )}
    </div>
  );
}

// Module Override Modal Component
function ModuleOverrideModal({ module, onClose, onSave }: {
  module: Module;
  onClose: () => void;
  onSave: (isEnabled: boolean, reason: string, expiresAt?: string) => void;
}) {
  const [isEnabled, setIsEnabled] = useState(module.isEnabled);
  const [reason, setReason] = useState(module.override?.reason || '');
  const [expiresAt, setExpiresAt] = useState(module.override?.expiresAt?.split('T')[0] || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Configure Module: {module.name}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Enable Module</span>
            <button onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isEnabled ? 'bg-green-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter reason for this override..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires At (optional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={() => onSave(isEnabled, reason, expiresAt || undefined)} disabled={!reason}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save Override</button>
        </div>
      </div>
    </div>
  );
}

// Feature Override Modal Component
function FeatureOverrideModal({ feature, onClose, onSave }: {
  feature: Feature;
  onClose: () => void;
  onSave: (isEnabled: boolean, reason: string, expiresAt?: string) => void;
}) {
  const [isEnabled, setIsEnabled] = useState(feature.isEnabled);
  const [reason, setReason] = useState(feature.override?.reason || '');
  const [expiresAt, setExpiresAt] = useState(feature.override?.expiresAt?.split('T')[0] || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Configure Feature: {feature.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Module: {feature.moduleCode}</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Enable Feature</span>
            <button onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isEnabled ? 'bg-green-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter reason for this override..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires At (optional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={() => onSave(isEnabled, reason, expiresAt || undefined)} disabled={!reason}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save Override</button>
        </div>
      </div>
    </div>
  );
}

// Billing Action Modal Component
function BillingActionModal({ action, onClose, onSave }: {
  action: 'extend-trial' | 'apply-credit' | 'bypass' | 'discount' | 'grace-period' | 'pause';
  onClose: () => void;
  onSave: (formData: { days?: number; amount?: number; reason: string; endDate?: string; discountPercent?: number }) => void;
}) {
  const [days, setDays] = useState(14);
  const [amount, setAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');

  const titles: Record<string, string> = {
    'extend-trial': 'Extend Trial Period',
    'apply-credit': 'Apply Account Credit',
    'bypass': 'Bypass Billing',
    'discount': 'Apply Discount',
    'grace-period': 'Set Grace Period',
    'pause': 'Pause Billing',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{titles[action]}</h3>
        <div className="space-y-4">
          {action === 'extend-trial' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days to Extend</label>
              <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} min={1} max={365}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          )}
          {action === 'apply-credit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credit Amount (NGN)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={0}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          )}
          {action === 'discount' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Percentage</label>
              <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} min={1} max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          )}
          {action === 'grace-period' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grace Period (Days)</label>
              <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} min={1} max={90}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          )}
          {['bypass', 'discount', 'grace-period', 'pause'].includes(action) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter reason for this billing action..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={() => onSave({ days, amount, reason, endDate: endDate || undefined, discountPercent })} disabled={!reason}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Apply</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-white font-medium">{value ?? '-'}</dd>
    </div>
  );
}
