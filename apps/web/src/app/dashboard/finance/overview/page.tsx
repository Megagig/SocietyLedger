'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/utils/api';
import { 
  DollarSign, TrendingUp, TrendingDown, Users, 
  AlertTriangle, CheckCircle, Clock, ArrowRight 
} from 'lucide-react';

interface DashboardData {
  overview: {
    totalMembers: number;
    activeCategories: number;
    overdueTransactions: number;
  };
  thisMonth: {
    transactionsCreated: number;
    transactionsAmount: number;
    paymentsReceived: number;
    paymentsAmount: number;
  };
  totals: {
    totalOutstanding: number;
    totalCollected: number;
  };
  recentPayments: any[];
}

export default function FinanceOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/dashboard`
      );

      if (!response.ok) throw new Error('Failed to fetch dashboard');

      const result = await response.json();
      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Financial Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your association's financial health
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Collected</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(data?.totals.totalCollected || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(data?.totals.totalOutstanding || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {data?.overview.overdueTransactions || 0}
              </p>
              <p className="text-xs text-gray-500">transactions</p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Members</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {data?.overview.totalMembers || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {data?.thisMonth.transactionsCreated || 0}
            </p>
            <p className="text-sm text-gray-500">Transactions Created</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(data?.thisMonth.transactionsAmount || 0)}
            </p>
            <p className="text-sm text-gray-500">Amount Billed</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {data?.thisMonth.paymentsReceived || 0}
            </p>
            <p className="text-sm text-gray-500">Payments Received</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(data?.thisMonth.paymentsAmount || 0)}
            </p>
            <p className="text-sm text-gray-500">Amount Collected</p>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard/finance/transactions/create')}
              className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900 dark:text-white">Record Transaction</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => router.push('/dashboard/finance/categories')}
              className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900 dark:text-white">Manage Categories</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => router.push('/dashboard/finance/transactions?status=overdue')}
              className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-gray-900 dark:text-white">View Overdue</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => router.push('/dashboard/finance/dues')}
              className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900 dark:text-white">Generate Dues</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Payments
            </h2>
            <button
              onClick={() => router.push('/dashboard/finance/transactions')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </button>
          </div>

          {data?.recentPayments && data.recentPayments.length > 0 ? (
            <div className="space-y-3">
              {data.recentPayments.map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {payment.transaction?.member?.firstName} {payment.transaction?.member?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {payment.transaction?.category?.name} • {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(payment.amountPaid)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No recent payments</p>
          )}
        </div>
      </div>
    </div>
  );
}
