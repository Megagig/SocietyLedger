'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, TrendingUp, Database, Loader2 } from 'lucide-react';
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
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Contributions</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Total: {syncStatus.welfare.contributions.total}</span>
                <span className="text-green-600">Synced: {syncStatus.welfare.contributions.synced}</span>
                <span className="text-orange-600">Unsynced: {syncStatus.welfare.contributions.unsynced}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.welfare.contributions.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {syncStatus.welfare.contributions.syncRate}%
                </span>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Payouts</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Total: {syncStatus.welfare.payouts.total}</span>
                <span className="text-green-600">Synced: {syncStatus.welfare.payouts.synced}</span>
                <span className="text-orange-600">Unsynced: {syncStatus.welfare.payouts.unsynced}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.welfare.payouts.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {syncStatus.welfare.payouts.syncRate}%
                </span>
              </div>
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
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Savings Transactions</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Total: {syncStatus.cooperatives.savingsTransactions.total}</span>
                <span className="text-green-600">Synced: {syncStatus.cooperatives.savingsTransactions.synced}</span>
                <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.savingsTransactions.unsynced}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.cooperatives.savingsTransactions.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {syncStatus.cooperatives.savingsTransactions.syncRate}%
                </span>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Loans</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Total: {syncStatus.cooperatives.loans.total}</span>
                <span className="text-green-600">Synced: {syncStatus.cooperatives.loans.synced}</span>
                <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.loans.unsynced}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.cooperatives.loans.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {syncStatus.cooperatives.loans.syncRate}%
                </span>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Loan Repayments</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Total: {syncStatus.cooperatives.loanRepayments.total}</span>
                <span className="text-green-600">Synced: {syncStatus.cooperatives.loanRepayments.synced}</span>
                <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.loanRepayments.unsynced}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(syncStatus.cooperatives.loanRepayments.syncRate) >= 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {syncStatus.cooperatives.loanRepayments.syncRate}%
                </span>
              </div>
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
      const response = await fetch('/api/accounting/sync/status');
      const data = await response.json();
      
      if (data.success) {
        setSyncStatus(data.data);
      } else {
        toast.error('Failed to fetch sync status');
      }
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
      const response = await fetch('/api/accounting/sync/errors');
      const data = await response.json();
      
      if (data.success) {
        setSyncErrors(data.data);
      }
    } catch (error) {
      console.error('Error fetching sync errors:', error);
    }
  };

  // Bulk sync transactions
  const handleBulkSyncTransactions = async () => {
    setSyncing('transactions');
    try {
      const response = await fetch('/api/accounting/sync/transactions/bulk', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        fetchSyncStatus();
      } else {
        toast.error('Failed to sync transactions');
      }
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
      const response = await fetch('/api/accounting/sync/payments/bulk', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        fetchSyncStatus();
      } else {
        toast.error('Failed to sync payments');
      }
    } catch (error) {
      console.error('Error syncing payments:', error);
      toast.error('Failed to sync payments');
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Accounting Integration</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage automatic synchronization between financial modules and accounting
        </p>
      </div>

      {/* Overall Status Card */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Overall Sync Status
            </CardTitle>
            <CardDescription>
              System-wide synchronization metrics across all modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{syncStatus.overall.total.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Synced</p>
                <p className="text-2xl font-bold text-green-600">{syncStatus.overall.synced.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Unsynced</p>
                <p className="text-2xl font-bold text-orange-600">{syncStatus.overall.unsynced.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Sync Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{syncStatus.overall.syncRate}%</p>
                  <TrendingUp className={`w-5 h-5 ${parseFloat(syncStatus.overall.syncRate) >= 90 ? 'text-green-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finance Module */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Finance Module</CardTitle>
            <CardDescription>Transactions and payments synchronization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transactions */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Transactions</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.finance.transactions.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.finance.transactions.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.finance.transactions.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.finance.transactions.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.finance.transactions.syncRate}%
                  </Badge>
                </div>
              </div>
              <Button
                onClick={handleBulkSyncTransactions}
                disabled={syncing === 'transactions' || syncStatus.finance.transactions.unsynced === 0}
                size="sm"
              >
                {syncing === 'transactions' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>

            {/* Payments */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Payments</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.finance.payments.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.finance.payments.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.finance.payments.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.finance.payments.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.finance.payments.syncRate}%
                  </Badge>
                </div>
              </div>
              <Button
                onClick={handleBulkSyncPayments}
                disabled={syncing === 'payments' || syncStatus.finance.payments.unsynced === 0}
                size="sm"
              >
                {syncing === 'payments' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Welfare Module */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Welfare Module</CardTitle>
            <CardDescription>Contributions and payouts synchronization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contributions */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Contributions</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.welfare.contributions.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.welfare.contributions.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.welfare.contributions.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.welfare.contributions.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.welfare.contributions.syncRate}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Payouts */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Payouts</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.welfare.payouts.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.welfare.payouts.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.welfare.payouts.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.welfare.payouts.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.welfare.payouts.syncRate}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cooperatives Module */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Cooperatives Module</CardTitle>
            <CardDescription>Savings, loans, and repayments synchronization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Savings Transactions */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Savings Transactions</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.cooperatives.savingsTransactions.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.cooperatives.savingsTransactions.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.savingsTransactions.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.cooperatives.savingsTransactions.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.cooperatives.savingsTransactions.syncRate}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Loans */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Loans</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.cooperatives.loans.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.cooperatives.loans.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.loans.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.cooperatives.loans.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.cooperatives.loans.syncRate}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Loan Repayments */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Loan Repayments</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Total: {syncStatus.cooperatives.loanRepayments.total}</span>
                  <span className="text-green-600">Synced: {syncStatus.cooperatives.loanRepayments.synced}</span>
                  <span className="text-orange-600">Unsynced: {syncStatus.cooperatives.loanRepayments.unsynced}</span>
                  <Badge variant={parseFloat(syncStatus.cooperatives.loanRepayments.syncRate) >= 90 ? 'default' : 'secondary'}>
                    {syncStatus.cooperatives.loanRepayments.syncRate}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Errors */}
      {syncErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Recent Sync Errors
            </CardTitle>
            <CardDescription>
              Last {syncErrors.length} synchronization failures
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncErrors.slice(0, 10).map((error) => (
                <Alert key={error.id} variant="destructive">
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{error.tableName} (ID: {error.recordId})</p>
                        <p className="text-sm mt-1">{error.newValues?.error || 'Unknown error'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(error.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          <strong>Automatic Synchronization:</strong> All new financial transactions are automatically synced to the accounting module. 
          Use the manual sync buttons above only if you need to sync historical data or retry failed synchronizations.
        </AlertDescription>
      </Alert>
    </div>
  );
}
