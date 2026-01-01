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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Transactions
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Track all financial transactions ({totalCount} total)
          </p>
        </div>
        
        <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
          <button
            onClick={() => router.push('/dashboard/finance/transactions/create')}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Record Transaction
          </button>
        </Can>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.totalAmount || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalPaid || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
            <p className="text-lg sm:text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalOutstanding || 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Overdue</p>
            <p className="text-lg sm:text-2xl font-bold text-orange-600">
              {stats.byStatus?.overdue?.count || 0} <span className="text-xs font-normal">txns</span>
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <div className="sm:col-span-2 md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by reference or member..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((txn) => (
                <div 
                  key={txn.id} 
                  className="p-4 space-y-3"
                  onClick={() => router.push(`/dashboard/finance/transactions/${txn.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {txn.member ? `${txn.member.firstName} ${txn.member.lastName}` : '-'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{txn.member?.memberId}</p>
                    </div>
                    {getStatusBadge(txn.status)}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{txn.category?.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{txn.referenceNumber}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatCurrency(txn.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="font-semibold text-green-600 text-sm">{formatCurrency(txn.totalPaid || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className="font-semibold text-red-600 text-sm">{formatCurrency(txn.balance || 0)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">
                      Due: {txn.dueDate ? formatDate(txn.dueDate) : '-'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/finance/transactions/${txn.id}`);
                      }}
                      className="flex items-center gap-1 text-blue-600 text-sm"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 rounded-lg shadow px-4 sm:px-6 py-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2">
              <select
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50 text-sm"
                >
                  Previous
                </button>
                
                <span className="text-sm whitespace-nowrap">{page} / {totalPages}</span>
                
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50 text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
