'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getWelfareDashboard, getFundSummaries, getMyWelfareProfile } from '@/lib/api/welfare';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import {
  IconHeart, IconCurrencyNaira, IconWallet, IconUsers,
  IconArrowRight, IconPlus, IconAlertTriangle, IconCheck,
  IconClock, IconChartBar
} from '@tabler/icons-react';

interface DashboardData {
  totalFunds: number;
  activeFunds: number;
  totalBalance: string;
  totalContributions: string;
  totalPayouts: string;
  pendingPayoutRequests: number;
  memberParticipationRate: number;
}

interface FundSummary {
  fundId: number;
  fundName: string;
  fundType: string;
  currentBalance: string;
  totalContributions: string;
  totalPayouts: string;
  contributorCount: number;
  pendingPayouts: number;
}

interface MemberProfile {
  memberId: number;
  memberName: string;
  totalContributions: string;
  contributionCount: number;
  lastContributionDate?: string;
  totalPayoutsReceived: string;
  payoutCount: number;
  eligibleFunds: number[];
  pendingRequests: number;
}

export default function WelfareDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [fundSummaries, setFundSummaries] = useState<FundSummary[]>([]);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role && hasPermission(user.role, PERMISSIONS.WELFARE_MANAGE);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardRes, summariesRes, profileRes] = await Promise.all([
        getWelfareDashboard(),
        getFundSummaries(),
        getMyWelfareProfile().catch(() => null),
      ]);
      setDashboard(dashboardRes.data);
      setFundSummaries(summariesRes.data || []);
      if (profileRes) setMemberProfile(profileRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  const getFundTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      BEREAVEMENT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      MEDICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      EDUCATION: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      EMERGENCY: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      MATERNITY: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      WEDDING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      GENERAL: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return colors[type] || colors.GENERAL;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading welfare dashboard...</div>
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
            Welfare & Social Funds
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage welfare contributions and support requests
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => router.push('/dashboard/welfare/social-funds?action=create')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all"
          >
            <IconPlus size={18} />
            Create Fund
          </button>
        )}
      </div>

      {/* Pending Actions Alert */}
      {dashboard && dashboard.pendingPayoutRequests > 0 && isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <IconAlertTriangle className="text-amber-600" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">Pending Actions</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {dashboard.pendingPayoutRequests} payout request(s) awaiting review
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/welfare/requests?status=PENDING')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Balance</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(dashboard?.totalBalance || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard?.activeFunds || 0} active funds
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconWallet className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Contributions</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(dashboard?.totalContributions || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconCurrencyNaira className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Payouts</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {formatCurrency(dashboard?.totalPayouts || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Disbursed</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <IconHeart className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Participation</p>
              <p className="text-2xl font-bold text-teal-600 mt-1">
                {dashboard?.memberParticipationRate || 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Members contributing</p>
            </div>
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <IconUsers className="text-teal-600 dark:text-teal-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Member Profile Card (for non-admin users) */}
      {memberProfile && !isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            My Welfare Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <IconCurrencyNaira className="mx-auto text-green-600 mb-2" size={24} />
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(memberProfile.totalContributions)}
              </p>
              <p className="text-sm text-gray-500">My Contributions</p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <IconHeart className="mx-auto text-purple-600 mb-2" size={24} />
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(memberProfile.totalPayoutsReceived)}
              </p>
              <p className="text-sm text-gray-500">Received</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <IconCheck className="mx-auto text-blue-600 mb-2" size={24} />
              <p className="text-xl font-bold text-blue-600">
                {memberProfile.eligibleFunds.length}
              </p>
              <p className="text-sm text-gray-500">Eligible Funds</p>
            </div>
            <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <IconClock className="mx-auto text-amber-600 mb-2" size={24} />
              <p className="text-xl font-bold text-amber-600">
                {memberProfile.pendingRequests}
              </p>
              <p className="text-sm text-gray-500">Pending Requests</p>
            </div>
          </div>
        </div>
      )}

      {/* Fund Summaries & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fund Summaries */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Fund Overview
            </h2>
            <button
              onClick={() => router.push('/dashboard/welfare/social-funds')}
              className="text-sm text-teal-600 hover:text-teal-800"
            >
              View All
            </button>
          </div>

          {fundSummaries.length > 0 ? (
            <div className="space-y-3">
              {fundSummaries.slice(0, 5).map((fund) => (
                <div
                  key={fund.fundId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => router.push(`/dashboard/welfare/social-funds?fundId=${fund.fundId}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {fund.fundName}
                      </p>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getFundTypeColor(fund.fundType)}`}>
                        {fund.fundType}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {fund.contributorCount} contributors • {fund.pendingPayouts} pending
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(fund.currentBalance)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No welfare funds created yet</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => router.push('/dashboard/welfare/social-funds?action=create')}
                  className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <IconPlus className="text-green-600" size={20} />
                    <span className="font-medium text-gray-900 dark:text-white">Create New Fund</span>
                  </div>
                  <IconArrowRight className="text-gray-400" size={16} />
                </button>

                <button
                  onClick={() => router.push('/dashboard/welfare/contributions?action=record')}
                  className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <IconCurrencyNaira className="text-blue-600" size={20} />
                    <span className="font-medium text-gray-900 dark:text-white">Record Contribution</span>
                  </div>
                  <IconArrowRight className="text-gray-400" size={16} />
                </button>

                <button
                  onClick={() => router.push('/dashboard/welfare/requests?status=PENDING')}
                  className="w-full flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <IconClock className="text-amber-600" size={20} />
                    <span className="font-medium text-gray-900 dark:text-white">Review Pending Requests</span>
                  </div>
                  <IconArrowRight className="text-gray-400" size={16} />
                </button>
              </>
            )}

            <button
              onClick={() => router.push('/dashboard/welfare/requests?action=create')}
              className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconHeart className="text-purple-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Request Support</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/welfare/contributions')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconChartBar className="text-gray-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">View Contributions</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
