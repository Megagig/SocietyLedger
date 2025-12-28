'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCooperativeDashboard } from '@/lib/api/cooperatives';
import { 
  IconWallet, IconCurrencyNaira, IconAlertTriangle,
  IconArrowRight, IconTrendingUp, IconTrendingDown,
  IconFileAnalytics, IconPlus
} from '@tabler/icons-react';

interface DashboardData {
  savingsSummary: {
    totalAccounts: number;
    activeAccounts: number;
    totalBalance: string;
    totalDepositsThisMonth: string;
    totalWithdrawalsThisMonth: string;
    averageBalance: string;
  };
  loansSummary: {
    totalActiveLoans: number;
    totalDisbursed: string;
    totalOutstanding: string;
    totalCollectedThisMonth: string;
    overdueLoans: number;
    overdueAmount: string;
    defaultRate: number;
  };
  pendingActions: {
    pendingLoanApplications: number;
    pendingGuarantorRequests: number;
    overdueRepayments: number;
  };
  recentActivity: {
    recentDeposits: any[];
    recentRepayments: any[];
    recentApplications: any[];
  };
}

export default function CooperativesDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const result = await getCooperativeDashboard();
      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Cooperative Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage savings accounts, loans, and member finances
          </p>
        </div>
        <span className="px-3 py-1 text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
          Enterprise
        </span>
      </div>

      {/* Pending Actions Alert */}
      {data && (data.pendingActions.pendingLoanApplications > 0 || 
                data.pendingActions.pendingGuarantorRequests > 0 || 
                data.pendingActions.overdueRepayments > 0) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <IconAlertTriangle className="text-amber-600" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">Pending Actions</h3>
              <div className="flex gap-4 mt-1 text-sm text-amber-700 dark:text-amber-300">
                {data.pendingActions.pendingLoanApplications > 0 && (
                  <span>{data.pendingActions.pendingLoanApplications} loan applications</span>
                )}
                {data.pendingActions.pendingGuarantorRequests > 0 && (
                  <span>{data.pendingActions.pendingGuarantorRequests} guarantor requests</span>
                )}
                {data.pendingActions.overdueRepayments > 0 && (
                  <span>{data.pendingActions.overdueRepayments} overdue repayments</span>
                )}
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/cooperatives/applications?status=PENDING_REVIEW')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Savings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Savings</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(data?.savingsSummary.totalBalance || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data?.savingsSummary.activeAccounts || 0} active accounts
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconCurrencyNaira className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        {/* Outstanding Loans */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding Loans</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(data?.loansSummary.totalOutstanding || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data?.loansSummary.totalActiveLoans || 0} active loans
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconWallet className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        {/* Overdue Loans */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(data?.loansSummary.overdueAmount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data?.loansSummary.overdueLoans || 0} loans overdue
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <IconAlertTriangle className="text-red-600 dark:text-red-400" size={24} />
            </div>
          </div>
        </div>

        {/* Default Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Default Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {(data?.loansSummary.defaultRate || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Portfolio health
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <IconTrendingDown className="text-gray-600 dark:text-gray-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* This Month Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          This Month
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <IconTrendingUp className="mx-auto text-green-600 mb-2" size={24} />
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(data?.savingsSummary.totalDepositsThisMonth || 0)}
            </p>
            <p className="text-sm text-gray-500">Deposits</p>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <IconTrendingDown className="mx-auto text-red-600 mb-2" size={24} />
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(data?.savingsSummary.totalWithdrawalsThisMonth || 0)}
            </p>
            <p className="text-sm text-gray-500">Withdrawals</p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <IconWallet className="mx-auto text-blue-600 mb-2" size={24} />
            <p className="text-xl font-bold text-blue-600">
              {formatCurrency(data?.loansSummary.totalDisbursed || 0)}
            </p>
            <p className="text-sm text-gray-500">Disbursed</p>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <IconCurrencyNaira className="mx-auto text-purple-600 mb-2" size={24} />
            <p className="text-xl font-bold text-purple-600">
              {formatCurrency(data?.loansSummary.totalCollectedThisMonth || 0)}
            </p>
            <p className="text-sm text-gray-500">Repayments</p>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard/cooperatives/savings?action=create')}
              className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconPlus className="text-green-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Open Savings Account</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/cooperatives/applications?action=create')}
              className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconFileAnalytics className="text-blue-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">New Loan Application</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/cooperatives/loans?action=repayment')}
              className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconCurrencyNaira className="text-purple-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Record Repayment</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/cooperatives/loan-products')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconWallet className="text-gray-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Manage Loan Products</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>

        {/* Recent Applications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Applications
            </h2>
            <button
              onClick={() => router.push('/dashboard/cooperatives/applications')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </button>
          </div>

          {data?.recentActivity.recentApplications && data.recentActivity.recentApplications.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.recentApplications.slice(0, 5).map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => router.push(`/dashboard/cooperatives/applications/${app.id}`)}
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {app.memberName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {app.loanProductName} • {formatCurrency(app.amount)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    app.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    app.status === 'DISBURSED' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {app.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No recent applications</p>
          )}
        </div>
      </div>
    </div>
  );
}
