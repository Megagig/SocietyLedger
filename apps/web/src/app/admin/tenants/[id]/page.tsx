'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type TenantStatus = {
  association: {
    id: number;
    name: string;
    subdomain: string;
    tier: string;
    status: string;
    deletedAt: string | null;
    deletedBy: number | null;
    deletionReason: string | null;
    force2FA: boolean;
    passwordPolicyLevel: string;
    sessionTimeoutMinutes: number;
    ipRestrictions: string[];
    createdAt: string;
  };
  subscription: {
    status: string;
    plan: { name: string; priceMonthly: number };
    currentPeriodEnd: string;
    billingCycle: string;
  } | null;
  counts: { users: number; members: number; transactions: number };
  billingOverrides: { type: string; isActive: boolean; endDate: string | null }[];
};

type Module = {
  code: string;
  name: string;
  isCore: boolean;
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
  const [billingHistory, setBillingHistory] = useState<BillingOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'billing' | 'security'>('overview');

  const tenantId = Number(params.id);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, tenantId]);

  const fetchData = async () => {
    if (!token || !tenantId) return;
    setLoading(true);
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

      if (statusData.success) setTenantStatus(statusData.data);
      if (modulesData.success) setModules(modulesData.data.modules || []);
      if (billingData.success) setBillingHistory(billingData.data.overrides || []);
    } catch (e) {
      console.error('Failed to fetch tenant data:', e);
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

  const handleModuleToggle = async (moduleCode: string, isEnabled: boolean) => {
    try {
      const reason = prompt(`Enter reason for ${isEnabled ? 'enabling' : 'disabling'} ${moduleCode}:`);
      if (reason === null) return;

      const res = await fetch(API_ROUTES.PLATFORM_ADMIN.TENANT_MODULE_OVERRIDE(tenantId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moduleCode, isEnabled, reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Module ${isEnabled ? 'enabled' : 'disabled'}`);
        fetchData();
      } else {
        toast.error(data.message || 'Failed to update module');
      }
    } catch (e) {
      toast.error('Failed to update module');
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

  const handleBillingAction = async (action: 'extend-trial' | 'apply-credit' | 'bypass', value?: string) => {
    const reason = prompt('Enter reason for this billing action:');
    if (!reason) return;

    try {
      let url = '';
      let body: any = { reason };

      switch (action) {
        case 'extend-trial':
          const days = prompt('Enter number of days to extend trial:');
          if (!days || isNaN(Number(days))) return;
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_EXTEND_TRIAL(tenantId);
          body.days = Number(days);
          break;
        case 'apply-credit':
          const amount = prompt('Enter credit amount (in NGN):');
          if (!amount || isNaN(Number(amount))) return;
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_APPLY_CREDIT(tenantId);
          body.amount = Number(amount);
          break;
        case 'bypass':
          const endDate = prompt('Enter end date (YYYY-MM-DD) or leave empty for indefinite:');
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_BILLING_OVERRIDE(tenantId);
          body.overrideType = 'BYPASS_BILLING';
          if (endDate) body.endDate = endDate;
          break;
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
      } else {
        toast.error(data.message || 'Billing action failed');
      }
    } catch (e) {
      toast.error('Billing action failed');
    }
  };

  const handleSecurityUpdate = async () => {
    if (!tenantStatus) return;
    const force2FA = confirm('Enforce 2FA for all users?');
    const sessionTimeout = prompt('Session timeout (minutes):', String(tenantStatus.association.sessionTimeoutMinutes));
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!tenantStatus) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">Tenant not found</div>
      </div>
    );
  }

  const { association, subscription, counts } = tenantStatus;

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
            <span>{association.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {association.name}
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              association.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              association.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {association.status}
            </span>
            {association.deletedAt && <span className="px-2 py-1 rounded text-sm font-medium bg-red-100 text-red-800">DELETED</span>}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{association.subdomain}.societyledger.com</p>
        </div>
        <div className="flex gap-2">
          {association.deletedAt ? (
            <button onClick={() => handleAction('restore')} disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              Restore
            </button>
          ) : (
            <>
              {association.status === 'ACTIVE' ? (
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
        <StatCard label="Users" value={counts.users} icon="👥" />
        <StatCard label="Members" value={counts.members} icon="👤" />
        <StatCard label="Transactions" value={counts.transactions} icon="💳" />
        <StatCard label="Tier" value={association.tier} icon="⭐" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'modules', 'billing', 'security'] as const).map((tab) => (
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
              <DetailRow label="ID" value={association.id} />
              <DetailRow label="Subdomain" value={association.subdomain} />
              <DetailRow label="Tier" value={association.tier} />
              <DetailRow label="Created" value={new Date(association.createdAt).toLocaleDateString()} />
              {association.deletedAt && (
                <>
                  <DetailRow label="Deleted At" value={new Date(association.deletedAt).toLocaleDateString()} />
                  <DetailRow label="Deletion Reason" value={association.deletionReason || '-'} />
                </>
              )}
            </dl>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subscription</h3>
            {subscription ? (
              <dl className="space-y-3">
                <DetailRow label="Plan" value={subscription.plan.name} />
                <DetailRow label="Status" value={subscription.status} />
                <DetailRow label="Billing" value={subscription.billingCycle} />
                <DetailRow label="Period Ends" value={new Date(subscription.currentPeriodEnd).toLocaleDateString()} />
              </dl>
            ) : (
              <p className="text-gray-500">No active subscription</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Module & Feature Management</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Toggle modules on/off for this tenant. Overrides take precedence over plan defaults.
          </p>
          <div className="space-y-3">
            {modules.map((module) => (
              <div key={module.code} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{module.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {module.code} • {module.isCore ? 'Core Module' : `Source: ${module.source}`}
                    {module.override && <span className="ml-2 text-blue-600">Override: {module.override.reason}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {module.override && (
                    <button onClick={() => handleRemoveOverride(module.code)}
                      className="text-xs text-gray-500 hover:text-red-600">
                      Remove Override
                    </button>
                  )}
                  <button
                    onClick={() => handleModuleToggle(module.code, !module.isEnabled)}
                    disabled={module.isCore}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      module.isEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    } ${module.isCore ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      module.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleBillingAction('extend-trial')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Extend Trial
              </button>
              <button onClick={() => handleBillingAction('apply-credit')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Apply Credit
              </button>
              <button onClick={() => handleBillingAction('bypass')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Bypass Billing
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing Override History</h3>
            {billingHistory.length === 0 ? (
              <p className="text-gray-500">No billing overrides</p>
            ) : (
              <div className="space-y-3">
                {billingHistory.map((override) => (
                  <div key={override.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          override.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {override.overrideType.replace('_', ' ')}
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{override.reason}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{new Date(override.startDate).toLocaleDateString()}</div>
                        {override.endDate && <div>Ends: {new Date(override.endDate).toLocaleDateString()}</div>}
                      </div>
                    </div>
                  </div>
                ))}
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
            <DetailRow label="Force 2FA" value={association.force2FA ? 'Yes' : 'No'} />
            <DetailRow label="Password Policy" value={association.passwordPolicyLevel} />
            <DetailRow label="Session Timeout" value={`${association.sessionTimeoutMinutes} minutes`} />
            <DetailRow label="IP Restrictions" value={association.ipRestrictions?.length > 0 ? association.ipRestrictions.join(', ') : 'None'} />
          </dl>
        </div>
      )}
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
