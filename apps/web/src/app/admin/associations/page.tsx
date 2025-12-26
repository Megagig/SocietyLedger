'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';

type Association = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: string;
  status: string;
  createdAt: string;
  _count: { users: number; members: number };
  subscriptions: { plan: { name: string } }[];
};

type PendingApproval = {
  id: number;
  userId: number;
  approvalStatus: string;
  createdAt: string;
  user: {
    id: number;
    email: string;
    role: string;
    emailVerified: boolean;
    createdAt: string;
    association: {
      id: number;
      name: string;
      subdomain: string;
    } | null;
  };
};

type Stats = {
  totalAssociations: number;
  activeAssociations: number;
  totalUsers: number;
  totalMembers: number;
  pendingApprovals: number;
};

export default function SuperAdminDashboard() {
  const { token, user } = useAuthStore();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'associations' | 'approvals'>('associations');

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    
    try {
      const [assocRes, statsRes, approvalsRes] = await Promise.all([
        fetch(API_ROUTES.ADMIN.ASSOCIATIONS, { 
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        }),
        fetch(API_ROUTES.ADMIN.STATS, { 
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        }),
        fetch(API_ROUTES.ADMIN.APPROVALS, { 
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        }),
      ]);
      
      const assocData = await assocRes.json();
      const statsData = await statsRes.json();
      const approvalsData = await approvalsRes.json();
      
      if (assocData.success) {
        setAssociations(assocData.data.associations || []);
      }
      
      if (statsData.success) {
        setStats(statsData.data);
      }
      
      if (approvalsData.success) {
        setPendingApprovals(approvalsData.data.approvals || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleApproval = async (userId: number, status: 'approved' | 'rejected', rejectionReason?: string) => {
    if (!token) return;
    setActionLoading(userId);
    
    try {
      const res = await fetch(API_ROUTES.ADMIN.APPROVAL_BY_ID(userId), {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status, rejectionReason }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Refresh data
        await fetchData();
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (e: any) {
      alert(e?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: number) => {
    const reason = prompt('Enter rejection reason (optional):');
    await handleApproval(userId, 'rejected', reason || undefined);
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return <div className="p-8 text-red-600">Access denied. Super admin only.</div>;
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Associations" value={stats.totalAssociations} />
          <StatCard label="Active" value={stats.activeAssociations} />
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Total Members" value={stats.totalMembers} />
          <StatCard 
            label="Pending Approvals" 
            value={stats.pendingApprovals} 
            highlight={stats.pendingApprovals > 0}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('associations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'associations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Associations ({associations.length})
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'approvals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approvals ({pendingApprovals.length})
            {pendingApprovals.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Associations Tab */}
      {activeTab === 'associations' && (
        <>
          <h2 className="text-xl font-semibold">Associations</h2>
          {associations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No associations found. New associations will appear here once created.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">ID</th>
                    <th className="border px-3 py-2 text-left">Name</th>
                    <th className="border px-3 py-2 text-left">Subdomain</th>
                    <th className="border px-3 py-2 text-left">Tier</th>
                    <th className="border px-3 py-2 text-left">Status</th>
                    <th className="border px-3 py-2 text-left">Plan</th>
                    <th className="border px-3 py-2 text-center">Users</th>
                    <th className="border px-3 py-2 text-center">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {associations.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{a.id}</td>
                      <td className="border px-3 py-2 font-medium">{a.name}</td>
                      <td className="border px-3 py-2">
                        <a 
                          href={`http://${a.subdomain}.localhost:3000`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {a.subdomain}
                        </a>
                      </td>
                      <td className="border px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          a.tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800' :
                          a.tier === 'PROFESSIONAL' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {a.tier}
                        </span>
                      </td>
                      <td className="border px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          a.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          a.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="border px-3 py-2">
                        {a.subscriptions?.[0]?.plan?.name || (
                          <span className="text-gray-400 capitalize">{a.tier.toLowerCase()} Plan</span>
                        )}
                      </td>
                      <td className="border px-3 py-2 text-center">{a._count.users}</td>
                      <td className="border px-3 py-2 text-center">{a._count.members}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Pending Approvals Tab */}
      {activeTab === 'approvals' && (
        <>
          <h2 className="text-xl font-semibold">Pending User Approvals</h2>
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending approvals. All users have been reviewed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">User ID</th>
                    <th className="border px-3 py-2 text-left">Email</th>
                    <th className="border px-3 py-2 text-left">Association</th>
                    <th className="border px-3 py-2 text-left">Role</th>
                    <th className="border px-3 py-2 text-center">Email Verified</th>
                    <th className="border px-3 py-2 text-left">Registered</th>
                    <th className="border px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((approval) => (
                    <tr key={approval.id} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{approval.user.id}</td>
                      <td className="border px-3 py-2 font-medium">{approval.user.email}</td>
                      <td className="border px-3 py-2">
                        {approval.user.association ? (
                          <span>
                            {approval.user.association.name}
                            <span className="text-gray-400 text-xs ml-1">
                              ({approval.user.association.subdomain})
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="border px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          approval.user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {approval.user.role}
                        </span>
                      </td>
                      <td className="border px-3 py-2 text-center">
                        {approval.user.emailVerified ? (
                          <span className="text-green-600">✓ Yes</span>
                        ) : (
                          <span className="text-red-600">✗ No</span>
                        )}
                      </td>
                      <td className="border px-3 py-2 text-gray-500 text-xs">
                        {new Date(approval.createdAt).toLocaleDateString()}
                      </td>
                      <td className="border px-3 py-2 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleApproval(approval.user.id, 'approved')}
                            disabled={actionLoading === approval.user.id}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === approval.user.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(approval.user.id)}
                            disabled={actionLoading === approval.user.id}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`border rounded p-4 text-center ${highlight ? 'border-red-300 bg-red-50' : ''}`}>
      <div className={`text-2xl font-bold ${highlight ? 'text-red-600' : ''}`}>{value}</div>
      <div className={`text-sm ${highlight ? 'text-red-600' : 'text-gray-600'}`}>{label}</div>
    </div>
  );
}
