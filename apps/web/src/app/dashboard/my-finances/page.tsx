'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Progress, Button } from '@mantine/core';
import { 
  IconCurrencyNaira, IconReceipt, IconWallet, IconHeart,
  IconBadge, IconAlertTriangle, IconCheck, IconClock,
  IconArrowRight, IconUserPlus
} from '@tabler/icons-react';
import { apiGet, apiPost } from '@/utils/api';
import { toast } from '@/lib/toast';

interface FinanceSummary {
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  duesSummary: { total: number; paid: number; outstanding: number; count: number };
  leviesSummary: { total: number; paid: number; outstanding: number; count: number };
  donationsSummary: { total: number; count: number };
  penaltiesSummary: { total: number; paid: number; outstanding: number; count: number };
  recentTransactions: any[];
  upcomingPayments: any[];
  hasMemberProfile?: boolean;
}

export default function MyFinancesPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/finance-summary`);
      if (!response.ok) throw new Error('Failed to fetch finance summary');
      const result = await response.json();
      setSummary(result.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    setIsCreatingProfile(true);
    try {
      const response = await apiPost(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/profile`, {});
      if (!response.ok) throw new Error('Failed to create member profile');
      const result = await response.json();
      toast.success(result.message || 'Member profile created successfully');
      // Refresh the summary after creating profile
      await fetchSummary();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

  const getPaymentProgress = () => {
    if (!summary || summary.totalDue === 0) return 100;
    return (summary.totalPaid / summary.totalDue) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your finances...</div>
      </div>
    );
  }

  // Show "No Member Profile" UI when hasMemberProfile is false
  if (summary && summary.hasMemberProfile === false) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Finances
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View your dues, levies, donations, and payment history
          </p>
        </div>

        {/* No Member Profile Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
              <IconUserPlus className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Member Profile Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You don't have a member profile linked to your account in this association. 
              Create one to view your financial information and make payments.
            </p>
            <Button
              size="lg"
              color="blue"
              leftSection={<IconUserPlus size={18} />}
              onClick={handleCreateProfile}
              loading={isCreatingProfile}
            >
              Create My Member Profile
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
              This will create a member record using your account information.
              If you already have a member profile with the same email, it will be linked automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Finances
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your dues, levies, donations, and payment history
        </p>
      </div>

      {/* Overdue Alert */}
      {summary && summary.overdueCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <IconAlertTriangle className="text-red-600" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-200">Overdue Payments</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                You have {summary.overdueCount} overdue payment(s) totaling {formatCurrency(summary.overdueAmount)}
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/my-finances/pay')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Pay Now
            </button>
          </div>
        </div>
      )}

      {/* Overall Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Progress</h2>
          <Badge color={getPaymentProgress() >= 100 ? 'green' : getPaymentProgress() >= 50 ? 'yellow' : 'red'}>
            {getPaymentProgress().toFixed(0)}% Complete
          </Badge>
        </div>
        <Progress value={getPaymentProgress()} size="xl" color={getPaymentProgress() >= 100 ? 'green' : 'blue'} />
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-green-600">Paid: {formatCurrency(summary?.totalPaid || 0)}</span>
          <span className="text-gray-500">Total Due: {formatCurrency(summary?.totalDue || 0)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(summary?.totalOutstanding || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <IconCurrencyNaira className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        {/* Dues */}
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/dashboard/my-finances/dues')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dues</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(summary?.duesSummary.outstanding || 0)}
              </p>
              <p className="text-xs text-gray-500">{summary?.duesSummary.count || 0} items</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconReceipt className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        {/* Levies */}
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/dashboard/my-finances/levies')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Levies</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {formatCurrency(summary?.leviesSummary.outstanding || 0)}
              </p>
              <p className="text-xs text-gray-500">{summary?.leviesSummary.count || 0} campaigns</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <IconWallet className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* Penalties */}
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/dashboard/my-finances/penalties')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Penalties</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {formatCurrency(summary?.penaltiesSummary.outstanding || 0)}
              </p>
              <p className="text-xs text-gray-500">{summary?.penaltiesSummary.count || 0} items</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <IconBadge className="text-amber-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard/my-finances/pay')}
              className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconCurrencyNaira className="text-green-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Make a Payment</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/my-finances/payments')}
              className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconClock className="text-blue-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Payment History</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/my-finances/donations')}
              className="w-full flex items-center justify-between p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconHeart className="text-pink-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Make a Donation</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Payments</h2>
            <button
              onClick={() => router.push('/dashboard/my-finances/dues')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </button>
          </div>

          {summary?.upcomingPayments && summary.upcomingPayments.length > 0 ? (
            <div className="space-y-3">
              {summary.upcomingPayments.slice(0, 5).map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{payment.category?.name}</p>
                    <p className="text-sm text-gray-500">
                      Due: {formatDate(payment.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(payment.amount)}
                    </p>
                    <Badge color={payment.status === 'overdue' ? 'red' : 'yellow'} size="sm">
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <IconCheck size={40} className="mx-auto text-green-500 mb-2" />
              <p className="text-gray-500">No upcoming payments</p>
            </div>
          )}
        </div>
      </div>

      {/* Donations Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Contributions</h2>
          <button
            onClick={() => router.push('/dashboard/my-finances/donations')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View All
          </button>
        </div>
        <div className="flex items-center gap-6">
          <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
            <IconHeart className="text-pink-600" size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Donations</p>
            <p className="text-2xl font-bold text-pink-600">{formatCurrency(summary?.donationsSummary.total || 0)}</p>
            <p className="text-sm text-gray-500">{summary?.donationsSummary.count || 0} donation(s) made</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => router.push('/dashboard/my-finances/donations')}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            >
              Donate Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
