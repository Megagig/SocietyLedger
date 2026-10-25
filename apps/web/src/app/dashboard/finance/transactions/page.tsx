'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, FinancialCategory } from '@/types';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { BulkEditModal } from '@/components/finance/BulkEditModal';
import { HelpLink } from '@/components/docs/HelpLink';
import { 
  Search, Plus, Eye, Trash2, CheckSquare, Square,
  CheckCircle, Clock, AlertTriangle, XCircle, Calendar, Info, Edit3
} from 'lucide-react';

interface TransactionWithDetails extends Transaction {
  member?: { id: number; memberId: string; firstName: string; lastName: string };
  category?: { id: number; name: string; type: string };
  payments?: { id: number; amountPaid: number; paymentDate: string }[];
  totalPaid?: number;
  balance?: number;
  isVoided?: boolean;
  voidReason?: string | null;
  lastEditedAt?: string | null;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Selection state
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'single' | 'bulk'>('single');
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastDeletedAuditLogId, setLastDeletedAuditLogId] = useState<number | null>(null);

  // Bulk Mark as Paid state
  const [showBulkPayModal, setShowBulkPayModal] = useState(false);
  const [isBulkPaying, setIsBulkPaying] = useState(false);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('cash');
  const [bulkPayForm, setBulkPayForm] = useState({
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Bulk Edit state
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchCategories();
    fetchDefaultPaymentMethod();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [search, statusFilter, categoryFilter, typeFilter, startDate, endDate, page, limit]);

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

  const fetchDefaultPaymentMethod = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/payments`);
      if (response.ok) {
        const data = await response.json();
        const defaultMethod = data.data?.defaultPaymentMethod;
        if (defaultMethod) {
          setDefaultPaymentMethod(defaultMethod);
          setBulkPayForm((prev) => ({ ...prev, paymentMethod: defaultMethod }));
        }
      }
    } catch (err) {
      console.error('Error fetching default payment method:', err);
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
        ...(startDate && { startDate: new Date(startDate).toISOString() }),
        ...(endDate && { endDate: new Date(endDate).toISOString() }),
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions?${params}`
      );

      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      setTransactions(data.data.transactions);
      setTotalPages(data.data.pagination.totalPages);
      setTotalCount(data.data.pagination.totalCount);
      setSelectedTransactions([]); // Clear selection on new data
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

  // Selection handlers
  const toggleTransactionSelection = (id: number) => {
    setSelectedTransactions(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map(t => t.id));
    }
  };

  // Delete handlers
  const handleDeleteClick = (id: number) => {
    setTransactionToDelete(id);
    setDeleteType('single');
    setShowDeleteModal(true);
  };

  const handleBulkDeleteClick = () => {
    setDeleteType('bulk');
    setShowDeleteModal(true);
  };

  const getTotalAmount = (): number => {
    if (deleteType === 'single' && transactionToDelete) {
      const txn = transactions.find(t => t.id === transactionToDelete);
      return Number(txn?.amount || 0);
    }
    return selectedTransactions.reduce((sum, id) => {
      const txn = transactions.find(t => t.id === id);
      return sum + Number(txn?.amount || 0);
    }, 0);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteType === 'single' && transactionToDelete) {
        const response = await apiDelete(
          `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/${transactionToDelete}?forceDelete=true`
        );
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message);
        
        setLastDeletedAuditLogId(data.data.auditLogId);
        toast.success('Transaction deleted successfully');
        
        // Show undo option after successful deletion
        setTimeout(() => {
          if (lastDeletedAuditLogId === data.data.auditLogId) {
            setLastDeletedAuditLogId(null);
          }
        }, 30000); // Clear after 30 seconds
      } else {
        const response = await apiPost(
          `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/bulk-delete`,
          { transactionIds: selectedTransactions, forceDelete: true }
        );
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message);
        
        setLastDeletedAuditLogId(data.data.auditLogId);
        toast.success(`${data.data.deletedCount} transaction(s) deleted successfully`);
        
        // Show undo option after successful deletion
        setTimeout(() => {
          if (lastDeletedAuditLogId === data.data.auditLogId) {
            setLastDeletedAuditLogId(null);
          }
        }, 30000); // Clear after 30 seconds
      }
      
      setShowDeleteModal(false);
      setTransactionToDelete(null);
      setSelectedTransactions([]);
      fetchTransactions();
      fetchStats();
    } catch (err: any) {
      toast.apiError(err, 'Failed to delete transaction(s)');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUndoDelete = async (auditLogId: number) => {
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/undo-delete/${auditLogId}`,
        {}
      );
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message);
      
      toast.success('Transaction restored successfully');
      fetchTransactions();
      fetchStats();
      setLastDeletedAuditLogId(null);
    } catch (err: any) {
      toast.apiError(err, 'Failed to restore transaction');
    }
  };

  // Bulk Mark as Paid handlers
  const handleBulkPayClick = () => {
    // Filter to only include unpaid/partial transactions
    const unpaidSelected = selectedTransactions.filter(id => {
      const txn = transactions.find(t => t.id === id);
      return txn && txn.status !== 'paid';
    });
    
    if (unpaidSelected.length === 0) {
      toast.error('All selected transactions are already paid');
      return;
    }
    
    setBulkPayForm({
      paymentMethod: defaultPaymentMethod,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowBulkPayModal(true);
  };

  const getUnpaidSelectedTransactions = () => {
    return selectedTransactions.filter(id => {
      const txn = transactions.find(t => t.id === id);
      return txn && txn.status !== 'paid';
    });
  };

  const getUnpaidTotalAmount = (): number => {
    return getUnpaidSelectedTransactions().reduce((sum, id) => {
      const txn = transactions.find(t => t.id === id);
      if (!txn) return sum;
      const balance = Number(txn.amount) - Number(txn.totalPaid || 0);
      return sum + balance;
    }, 0);
  };

  const confirmBulkPay = async () => {
    const unpaidIds = getUnpaidSelectedTransactions();
    if (unpaidIds.length === 0) return;

    setIsBulkPaying(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/payments/bulk`,
        {
          transactionIds: unpaidIds,
          paymentMethod: bulkPayForm.paymentMethod,
          paymentDate: new Date(bulkPayForm.paymentDate).toISOString(),
          notes: bulkPayForm.notes || undefined,
        }
      );
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message);
      
      toast.success(`${data.data.paymentsCreated} transaction(s) marked as paid (Batch: ${data.data.batchReference})`);
      setShowBulkPayModal(false);
      setSelectedTransactions([]);
      fetchTransactions();
      fetchStats();
    } catch (err: any) {
      toast.apiError(err, 'Failed to mark transactions as paid');
    } finally {
      setIsBulkPaying(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Undo Delete Banner */}
      {lastDeletedAuditLogId && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-900 dark:text-blue-100">
              Transaction(s) deleted. You can restore them within 30 seconds.
            </span>
          </div>
          <button
            onClick={() => handleUndoDelete(lastDeletedAuditLogId)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Undo Delete
          </button>
        </div>
      )}

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
        
        <div className="flex items-center gap-2">
          <HelpLink />
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
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

        {/* Date Range Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          {(startDate || endDate) && (
            <div className="flex items-end">
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Clear Dates
              </button>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedTransactions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedTransactions.length} transaction(s) selected
            </span>
            <div className="flex gap-2 flex-wrap">
              <Can permission={PERMISSIONS.TRANSACTION_EDIT}>
                <button
                  onClick={() => setShowBulkEditModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Bulk Edit
                </button>
              </Can>
              <Can permission={PERMISSIONS.PAYMENT_CREATE}>
                <button
                  onClick={handleBulkPayClick}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Paid
                </button>
              </Can>
              <Can permission={PERMISSIONS.TRANSACTION_DELETE}>
                <button
                  onClick={handleBulkDeleteClick}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </Can>
            </div>
          </div>
        )}
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
                >
                  <div className="flex items-start gap-3">
                    <Can anyPermissions={[PERMISSIONS.TRANSACTION_DELETE, PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.TRANSACTION_VIEW]}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTransactionSelection(txn.id);
                        }}
                        className="mt-1"
                      >
                        {selectedTransactions.includes(txn.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </Can>
                    <div 
                      className="flex-1"
                      onClick={() => router.push(`/dashboard/finance/transactions/${txn.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {txn.member ? `${txn.member.firstName} ${txn.member.lastName}` : '-'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{txn.member?.memberId}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(txn.status)}
                          {txn.isVoided && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium" title={txn.voidReason || 'Transaction voided'}>
                              VOIDED
                            </span>
                          )}
                          {!txn.isVoided && txn.lastEditedAt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium" title={`Last edited: ${formatDate(txn.lastEditedAt)}`}>
                              EDITED
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-gray-500">{txn.category?.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{txn.referenceNumber}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 mt-2">
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
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                        <span className="text-xs text-gray-500">
                          Due: {txn.dueDate ? formatDate(txn.dueDate) : '-'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/finance/transactions/${txn.id}`);
                            }}
                            className="flex items-center gap-1 text-blue-600 text-sm"
                          >
                            <Eye className="w-4 h-4" /> View
                          </button>
                          <Can permission={PERMISSIONS.TRANSACTION_DELETE}>
                            {!txn.payments || txn.payments.length === 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(txn.id);
                                }}
                                className="flex items-center gap-1 text-red-600 text-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </Can>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <Can anyPermissions={[PERMISSIONS.TRANSACTION_DELETE, PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.TRANSACTION_VIEW]}>
                      <th className="px-3 py-3 text-left">
                        <button
                          onClick={toggleSelectAll}
                          className="hover:text-blue-600"
                        >
                          {selectedTransactions.length === transactions.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                    </Can>
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
                      <Can anyPermissions={[PERMISSIONS.TRANSACTION_DELETE, PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.TRANSACTION_VIEW]}>
                        <td className="px-3 py-4">
                          <button
                            onClick={() => toggleTransactionSelection(txn.id)}
                          >
                            {selectedTransactions.includes(txn.id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                      </Can>
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
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(txn.status)}
                          {txn.isVoided && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium" title={txn.voidReason || 'Transaction voided'}>
                              VOIDED
                            </span>
                          )}
                          {!txn.isVoided && txn.lastEditedAt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium" title={`Last edited: ${formatDate(txn.lastEditedAt)}`}>
                              EDITED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/finance/transactions/${txn.id}`)}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Can permission={PERMISSIONS.TRANSACTION_DELETE}>
                            {!txn.payments || txn.payments.length === 0 ? (
                              <button
                                onClick={() => handleDeleteClick(txn.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete Transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </Can>
                        </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {getTotalAmount() >= 100000 ? '⚠️ High-Value Transaction Deletion' : 'Confirm Deletion'}
            </h3>
            <div className="space-y-3 mb-6">
              <p className="text-gray-600 dark:text-gray-400">
                {deleteType === 'single' 
                  ? 'Are you sure you want to delete this transaction?' 
                  : `Are you sure you want to delete ${selectedTransactions.length} transaction(s)?`
                }
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(getTotalAmount())}
                  </span>
                </div>
                {deleteType === 'bulk' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Count:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedTransactions.length} transaction(s)
                    </span>
                  </div>
                )}
              </div>
              {getTotalAmount() >= 100000 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ This is a high-value transaction (≥₦100,000). Please confirm you want to proceed.
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action can be undone within a short time window using the &quot;Undo&quot; button that appears after deletion.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTransactionToDelete(null);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 font-medium"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Mark as Paid Modal */}
      {showBulkPayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Mark Transactions as Paid
            </h3>
            
            {/* Summary */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
              <div className="text-sm text-green-800 dark:text-green-200">
                <p className="font-medium">
                  {getUnpaidSelectedTransactions().length} transaction(s) to be marked as paid
                </p>
                <p className="text-lg font-bold mt-1">
                  Total: ₦{getUnpaidTotalAmount().toLocaleString()}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method *
                </label>
                <select
                  value={bulkPayForm.paymentMethod}
                  onChange={(e) => setBulkPayForm({ ...bulkPayForm, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pos">POS</option>
                  <option value="cheque">Cheque</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={bulkPayForm.paymentDate}
                  onChange={(e) => setBulkPayForm({ ...bulkPayForm, paymentDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={bulkPayForm.notes}
                  onChange={(e) => setBulkPayForm({ ...bulkPayForm, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g., Collected at monthly meeting"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBulkPayModal(false)}
                disabled={isBulkPaying}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkPay}
                disabled={isBulkPaying}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 font-medium"
              >
                {isBulkPaying ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          transactionIds={selectedTransactions}
          onClose={() => setShowBulkEditModal(false)}
          onSuccess={() => {
            setSelectedTransactions([]);
            fetchTransactions();
            fetchStats();
          }}
        />
      )}
    </div>
  );
}
