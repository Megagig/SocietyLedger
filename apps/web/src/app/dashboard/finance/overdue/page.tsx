'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  AlertTriangle, Clock, DollarSign, Users, 
  CheckCircle, XCircle, Eye, RefreshCw
} from 'lucide-react';

interface OverdueTransaction {
  id: number;
  referenceNumber: string;
  amount: number;
  dueDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  member: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  category: {
    id: number;
    name: string;
    type: string;
  };
  totalPaid: number;
  balance: number;
}

interface OverdueStats {
  totalOverdue: number;
  totalAmount: number;
  membersAffected: number;
  oldestOverdue: number; // days
}

export default function OverduePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<OverdueTransaction[]>([]);
  const [stats, setStats] = useState<OverdueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('dueDate');
  const [categories, setCategories] = useState<{id: number; name: string}[]>([]);

  useEffect(() => {
    fetchOverdue();
    fetchCategories();
  }, [categoryFilter, sortBy]);

  const fetchOverdue = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'overdue',
        sortBy,
        sortOrder: 'asc',
        limit: '100',
        ...(categoryFilter && { categoryId: categoryFilter }),
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions?${params}`
      );

      if (!response.ok) throw new Error('Failed to fetch overdue transactions');

      const data = await response.json();
      setTransactions(data.data.transactions);

      // Calculate stats
      const uniqueMembers = new Set(data.data.transactions.map((t: any) => t.member.id));
      const totalAmount = data.data.transactions.reduce((sum: number, t: any) => sum + Number(t.balance), 0);
      
      let oldestDays = 0;
      data.data.transactions.forEach((t: any) => {
        if (t.dueDate) {
          const days = Math.floor((Date.now() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          if (days > oldestDays) oldestDays = days;
        }
      });

      setStats({
        totalOverdue: data.data.transactions.length,
        totalAmount,
        membersAffected: uniqueMembers.size,
        oldestOverdue: oldestDays,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?isActive=true`
      );
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.length === 0) return;
    
    modals.openConfirmModal({
      title: 'Mark Transactions as Paid',
      children: (
        <Text size="sm">
          Are you sure you want to mark {selectedIds.length} transaction(s) as paid?
        </Text>
      ),
      labels: { confirm: 'Mark as Paid', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const response = await apiPost(
            `${process.env.NEXT_PUBLIC_API_URL}/api/finance/payments/bulk`,
            {
              transactionIds: selectedIds,
              paymentMethod: 'cash',
            }
          );

          const data = await response.json();
          if (!response.ok) throw new Error(data.message);

          toast.success(data.message || 'Transactions marked as paid');
          setSelectedIds([]);
          fetchOverdue();
        } catch (err: any) {
          toast.error(err.message || 'Failed to mark transactions as paid');
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleWaive = async (id: number) => {
    modals.openConfirmModal({
      title: 'Waive Transaction',
      children: (
        <Text size="sm">
          Are you sure you want to waive this transaction? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Waive', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: async () => {
        try {
          const response = await apiPatch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/${id}`,
            { status: 'waived' }
          );

          const data = await response.json();
          if (!response.ok) throw new Error(data.message);

          toast.success('Transaction waived successfully');
          fetchOverdue();
        } catch (err: any) {
          toast.error(err.message || 'Failed to waive transaction');
        }
      },
    });
  };

  const getDaysOverdue = (dueDate: string | null) => {
    if (!dueDate) return 'N/A';
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} days` : 'Due today';
  };

  const getUrgencyColor = (dueDate: string | null) => {
    if (!dueDate) return 'text-gray-500';
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 90) return 'text-red-600 font-bold';
    if (days > 30) return 'text-orange-600';
    return 'text-yellow-600';
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            Overdue Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track and manage overdue payments
          </p>
        </div>
        
        <button
          onClick={fetchOverdue}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue Transactions</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {stats?.totalOverdue || 0}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Outstanding</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                ₦{(stats?.totalAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Members Affected</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {stats?.membersAffected || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Oldest Overdue</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {stats?.oldestOverdue || 0} days
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="dueDate">Sort by Due Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="createdAt">Sort by Created</option>
            </select>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedIds.length} selected
              </span>
              <Can permission={PERMISSIONS.PAYMENT_CREATE}>
                <button
                  onClick={handleBulkMarkPaid}
                  disabled={isProcessing}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Paid
                </button>
              </Can>
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      {transactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Overdue Transactions
          </h3>
          <p className="text-gray-500">
            All payments are up to date!
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === transactions.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Days Overdue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(txn.id)}
                        onChange={() => handleToggleSelect(txn.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {txn.referenceNumber}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {txn.member.firstName} {txn.member.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {txn.member.memberId}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {txn.category.name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-red-600">
                        ₦{Number(txn.balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${getUrgencyColor(txn.dueDate)}`}>
                        {getDaysOverdue(txn.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/finance/transactions/${txn.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Can permission={PERMISSIONS.TRANSACTION_EDIT}>
                          <button
                            onClick={() => handleWaive(txn.id)}
                            className="text-orange-600 hover:text-orange-800"
                            title="Waive"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
