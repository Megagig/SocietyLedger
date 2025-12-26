'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, FinancialCategory } from '@/types';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet } from '@/utils/api';
import { 
  Search, Plus, Eye, 
  CheckCircle, Clock, AlertTriangle, XCircle 
} from 'lucide-react';

interface TransactionWithDetails extends Transaction {
  member?: { id: number; memberId: string; firstName: string; lastName: string };
  category?: { id: number; name: string; type: string };
  payments?: { id: number; amountPaid: number; paymentDate: string }[];
  totalPaid?: number;
  balance?: number;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [search, statusFilter, categoryFilter, typeFilter, page, limit]);

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

  const fetchStats = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/stats`
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(categoryFilter && { categoryId: categoryFilter }),
        ...(typeFilter && { type: typeFilter }),
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions?${params}`
      );

      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      setTransactions(data.data.transactions);
      setTotalPages(data.data.pagination.totalPages);
      setTotalCount(data.data.pagination.totalCount);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; icon: JSX.Element }> = {
      paid: { 
        class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: <CheckCircle className="w-3 h-3" />
      },
      pending: { 
        class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: <Clock className="w-3 h-3" />
      },
      overdue: { 
        class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      waived: { 
        class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        icon: <XCircle className="w-3 h-3" />
      },
      partial: { 
        class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: <Clock className="w-3 h-3" />
      },
    };

    const badge = badges[status] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
        {badge.icon}
        {status}
      </span>
    );
  };

  const formatCurrency = (amount: number | string) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track all financial transactions ({totalCount} total)
          </p>
        </div>
        
        <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
          <button
            onClick={() => router.push('/dashboard/finance/transactions/create')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Transaction
          </button>
        </Can>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.totalAmount || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalPaid || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalOutstanding || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
            <p className="text-2xl font-bold text-orange-600">
              {stats.byStatus?.overdue?.count || 0} transactions
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by reference or member..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="partial">Partial</option>
            <option value="waived">Waived</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="due">Dues</option>
            <option value="levy">Levies</option>
            <option value="donation">Donations</option>
            <option value="penalty">Penalties</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="text-center py-12">Loading transactions...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {txn.referenceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {txn.member ? `${txn.member.firstName} ${txn.member.lastName}` : '-'}
                        <br />
                        <span className="text-xs text-gray-500">{txn.member?.memberId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {txn.category?.name}
                        <br />
                        <span className="text-xs capitalize">{txn.category?.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {formatCurrency(txn.totalPaid || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {formatCurrency(txn.balance || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {txn.dueDate ? formatDate(txn.dueDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(txn.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/dashboard/finance/transactions/${txn.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount}
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>

              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              
              <span className="text-sm">Page {page} of {totalPages}</span>
              
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
