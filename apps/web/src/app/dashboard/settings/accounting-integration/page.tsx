'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, TrendingUp, Database, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

interface SyncStatus {
  finance: {
    transactions: { total: number; synced: number; unsynced: number; syncRate: string };
    payments: { total: number; synced: number; unsynced: number; syncRate: string };
  };
  welfare: {
    contributions: { total: number; synced: number; unsynced: number; syncRate: string };
    payouts: { total: number; synced: number; unsynced: number; syncRate: string };
  };
  cooperatives: {
    savingsTransactions: { total: number; synced: number; unsynced: number; syncRate: string };
    loans: { total: number; synced: number; unsynced: number; syncRate: string };
    loanRepayments: { total: number; synced: number; unsynced: number; syncRate: string };
  };
  overall: {
    total: number;
    synced: number;
    unsynced: number;
    syncRate: string;
  };
}

interface SyncError {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  newValues: any;
  createdAt: string;
}

export default function AccountingIntegrationPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await api.get('/accounting/sync/status');
      setSyncStatus(response.data.data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
      toast.error('Failed to fetch sync status');
    } finally {
      setLoading(false);
    }
  };

  // Fetch sync errors
  const fetchSyncErrors = async () => {
    try {
      const response = await api.get('/accounting/sync/errors');
      setSyncErrors(response.data.data);
    } catch (error) {
      console.error('Error fetching sync errors:', error);
    }
  };

  // Bulk sync transactions
  const handleBulkSyncTransactions = async () => {
    setSyncing('transactions');
    try {
      const response = await api.post('/accounting/sync/transactions/bulk');
      toast.success(response.data.message);
      fetchSyncStatus();
    } catch (error) {
      console.error('Error syncing transactions:', error);
      toast.error('Failed to sync transactions');
    } finally {
      setSyncing(null);
    }
  };

  // Bulk sync payments
  const handleBulkSyncPayments = async () => {
    setSyncing('payments');
    try {
      const response = await api.post('/accounting/sync/payments/bulk');
      toast.success(response.data.message);
      fetchSyncStatus();
    } catch (error) {
      console.error('Error syncing payments:', error);
      toast.error('Failed to sync payments');
    } finally {
      setSyncing(null);
    }
  };

  // Generic bulk sync for the welfare/cooperatives record types below
  const handleBulkSync = async (key: string, endpoint: string) => {
    setSyncing(key);
    try {
      const response = await api.post(`/accounting/sync/${endpoint}/bulk`);
      toast.success(response.data.message);
      fetchSyncStatus();
    } catch (error) {
      console.error(`Error syncing ${key}:`, error);
      toast.error(`Failed to sync ${key}`);
    } finally {
      setSyncing(null);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    fetchSyncErrors();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Accounting Integration</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage automatic synchronization between financial modules and accounting
        </p>
      </div>

      {/* Overall Status Card */}
      {syncStatus && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Overall Sync Status</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            System-wide synchronization metrics across all modules
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Total Records</p>
              <p className="text-3xl font-bold text-gray-900">{syncStatus.overall.total.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Synced</p>
              <p className="text-3xl font-bold text-green-600">{syncStatus.overall.synced.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Unsynced</p>
              <p className="text-3xl font-bold text-orange-600">{syncStatus.overall.unsynced.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Sync Rate</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-gray-900">{syncStatus.overall.syncRate}%</p>
                <TrendingUp className={`w-5 h-5 ${parseFloat(syncStatus.overall.syncRate) >= 90 ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finance Module */}
      {syncStatus && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-2">Finance Module</h2>
          <p className="text-sm text-gray-600 mb-6">Transactions and payments synchronization</p>
          <div className="space-y-4">
            {/* Transactions */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Transactions</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.finance.transactions.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.finance.transactions.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.finance.transactions.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.finance.transactions.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.finance.transactions.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={handleBulkSyncTransactions}
                disabled={syncing === 'transactions' || syncStatus.finance.transactions.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'transactions' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>

            {/* Payments */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Payments</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.finance.payments.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.finance.payments.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.finance.payments.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.finance.payments.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.finance.payments.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={handleBulkSyncPayments}
                disabled={syncing === 'payments' || syncStatus.finance.payments.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'payments' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welfare Module */}
      {syncStatus && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-2">Welfare Module</h2>
          <p className="text-sm text-gray-600 mb-6">Contributions and payouts synchronization</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Contributions</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.welfare.contributions.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.welfare.contributions.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.welfare.contributions.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.welfare.contributions.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.welfare.contributions.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBulkSync('welfare contributions', 'welfare-contributions')}
                disabled={syncing === 'welfare contributions' || syncStatus.welfare.contributions.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'welfare contributions' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Payouts</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.welfare.payouts.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.welfare.payouts.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.welfare.payouts.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.welfare.payouts.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.welfare.payouts.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBulkSync('welfare payouts', 'welfare-payouts')}
                disabled={syncing === 'welfare payouts' || syncStatus.welfare.payouts.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'welfare payouts' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cooperatives Module */}
      {syncStatus && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-2">Cooperatives Module</h2>
          <p className="text-sm text-gray-600 mb-6">Savings, loans, and repayments synchronization</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Savings Transactions</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.cooperatives.savingsTransactions.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.cooperatives.savingsTransactions.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.savingsTransactions.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.cooperatives.savingsTransactions.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.cooperatives.savingsTransactions.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBulkSync('savings transactions', 'savings-transactions')}
                disabled={syncing === 'savings transactions' || syncStatus.cooperatives.savingsTransactions.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'savings transactions' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Loans</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.cooperatives.loans.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.cooperatives.loans.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.loans.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.cooperatives.loans.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.cooperatives.loans.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBulkSync('loans', 'loans')}
                disabled={syncing === 'loans' || syncStatus.cooperatives.loans.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'loans' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Loan Repayments</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total: {syncStatus.cooperatives.loanRepayments.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.cooperatives.loanRepayments.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.loanRepayments.unsynced}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.cooperatives.loanRepayments.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {syncStatus.cooperatives.loanRepayments.syncRate}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBulkSync('loan repayments', 'loan-repayments')}
                disabled={syncing === 'loan repayments' || syncStatus.cooperatives.loanRepayments.unsynced === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing === 'loan repayments' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Errors */}
      {syncErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900">Recent Sync Errors</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Last {syncErrors.length} synchronization failures
          </p>
          <div className="space-y-3">
            {syncErrors.slice(0, 10).map((error) => (
              <div key={error.id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-red-900">{error.tableName} (ID: {error.recordId})</p>
                    <p className="text-sm text-red-700 mt-1">{error.newValues?.error || 'Unknown error'}</p>
                    <p className="text-xs text-red-600 mt-1">
                      {new Date(error.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>Automatic Synchronization:</strong> All new financial transactions are automatically synced to the accounting module. 
            Use the manual sync buttons above only if you need to sync historical data or retry failed synchronizations.
          </div>
        </div>
      </div>
    </div>
  );
}
