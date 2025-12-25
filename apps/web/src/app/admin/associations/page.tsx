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

type Stats = {
  totalAssociations: number;
  activeAssociations: number;
  totalUsers: number;
  totalMembers: number;
};

export default function SuperAdminDashboard() {
  const { token, user } = useAuthStore();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const [assocRes, statsRes] = await Promise.all([
          fetch(API_ROUTES.ADMIN.ASSOCIATIONS, { 
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include'
          }),
          fetch(API_ROUTES.ADMIN.STATS, { 
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include'
          }),
        ]);
        const assocData = await assocRes.json();
        const statsData = await statsRes.json();
        if (assocData.success) setAssociations(assocData.data.associations);
        if (statsData.success) setStats(statsData.data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return <div className="p-8 text-red-600">Access denied. Super admin only.</div>;
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Associations" value={stats.totalAssociations} />
          <StatCard label="Active" value={stats.activeAssociations} />
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Total Members" value={stats.totalMembers} />
        </div>
      )}

      <h2 className="text-xl font-semibold">Associations</h2>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Subdomain</th>
            <th className="border px-2 py-1">Tier</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Plan</th>
            <th className="border px-2 py-1">Users</th>
            <th className="border px-2 py-1">Members</th>
          </tr>
        </thead>
        <tbody>
          {associations.map((a) => (
            <tr key={a.id}>
              <td className="border px-2 py-1">{a.id}</td>
              <td className="border px-2 py-1">{a.name}</td>
              <td className="border px-2 py-1">{a.subdomain}</td>
              <td className="border px-2 py-1">{a.tier}</td>
              <td className="border px-2 py-1">{a.status}</td>
              <td className="border px-2 py-1">{a.subscriptions?.[0]?.plan?.name ?? '-'}</td>
              <td className="border px-2 py-1">{a._count.users}</td>
              <td className="border px-2 py-1">{a._count.members}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-gray-600 text-sm">{label}</div>
    </div>
  );
}
