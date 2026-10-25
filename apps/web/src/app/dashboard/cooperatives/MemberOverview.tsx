'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@mantine/core';
import {
  IconWallet, IconCurrencyNaira, IconLock, IconArrowRight, IconFileAnalytics, IconUsers, IconClock
} from '@tabler/icons-react';
import {
  getMyCooperativeProfile, getSavingsDeposits, getLoanRepaymentRequests, getPendingGuarantorRequests
} from '@/lib/api/cooperatives';

interface Profile {
  memberName: string;
  savingsAccounts: unknown[];
  totalSavings: string;
  lockedSavings: string;
  availableSavings: string;
  activeLoans: unknown[];
  totalOutstandingLoans: string;
  loanEligibility: { maxLoanAmount: string };
}

/**
 * What a member sees at /dashboard/cooperatives: their own savings, loans and anything waiting on someone.
 * Officers get the association-wide dashboard instead (it needs ledger.view / payments.approve).
 */
export default function MemberOverview() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingRepayments, setPendingRepayments] = useState(0);
  const [guarantorRequests, setGuarantorRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, depositsRes, repaymentsRes, guarantorRes] = await Promise.all([
          getMyCooperativeProfile(),
          getSavingsDeposits({ status: 'PENDING', limit: 1 }).catch(() => null),
          getLoanRepaymentRequests({ status: 'PENDING', limit: 1 }).catch(() => null),
          getPendingGuarantorRequests().catch(() => null),
        ]);
        setProfile(profileRes.data);
        setPendingDeposits(depositsRes?.data?.pagination?.totalCount ?? 0);
        setPendingRepayments(repaymentsRes?.data?.pagination?.totalCount ?? 0);
        setGuarantorRequests(guarantorRes?.data?.requests?.length ?? 0);
      } catch {
        setError('We could not load your cooperative details. Your account may not be linked to a member record yet — please contact your association admin.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const formatCurrency = (amount: string | number) =>
    `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your cooperative...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-center px-4">
        <div className="text-gray-600 dark:text-gray-400 max-w-md">{error}</div>
      </div>
    );
  }

  const locked = Number(profile.lockedSavings || 0);
  const waiting = pendingDeposits + pendingRepayments;

  const links = [
    { label: 'My Savings', hint: 'Balances and deposits', href: '/dashboard/cooperatives/my-savings', icon: <IconCurrencyNaira size={20} /> },
    { label: 'My Loans', hint: 'Balances and payments', href: '/dashboard/cooperatives/my-loans', icon: <IconWallet size={20} /> },
    { label: 'Apply for Loan', hint: 'See how much you can borrow', href: '/dashboard/cooperatives/apply', icon: <IconFileAnalytics size={20} /> },
    { label: 'Guarantor Requests', hint: 'Members asking you to vouch', href: '/dashboard/cooperatives/guarantors', icon: <IconUsers size={20} />, badge: guarantorRequests },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Cooperative
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Your savings and loans at a glance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Total savings</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(profile.totalSavings)}</p>
          <p className="text-xs text-gray-500 mt-1">{profile.savingsAccounts.length} account(s)</p>
          {locked > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 flex items-center gap-1">
              <IconLock size={13} /> {formatCurrency(locked)} held against your loan · {formatCurrency(profile.availableSavings)} available
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Loans you owe</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(profile.totalOutstandingLoans)}</p>
          <p className="text-xs text-gray-500 mt-1">{profile.activeLoans.length} active loan(s)</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">You can borrow up to</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(profile.loanEligibility?.maxLoanAmount || 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Based on your available savings</p>
        </div>
      </div>

      {waiting > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <IconClock size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {pendingDeposits > 0 && <>{pendingDeposits} savings deposit{pendingDeposits > 1 ? 's' : ''} </>}
            {pendingDeposits > 0 && pendingRepayments > 0 && 'and '}
            {pendingRepayments > 0 && <>{pendingRepayments} loan payment{pendingRepayments > 1 ? 's' : ''} </>}
            waiting for an officer to confirm the money arrived.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className="flex items-center justify-between gap-3 p-4 text-left bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600">{link.icon}</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{link.label}</p>
                <p className="text-xs text-gray-500">{link.hint}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!!link.badge && <Badge color="red" size="sm">{link.badge}</Badge>}
              <IconArrowRight size={16} className="text-gray-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
