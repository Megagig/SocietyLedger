'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

const isOfficer = (user: User | null) =>
  !!user && ['admin', 'treasurer', 'financial_secretary'].includes(user.role) && !user.platformRole;

/** Shown to the people who can renew when the free trial is nearly over (3 days left or fewer). */
export function TrialEndingBanner() {
  const user = useAuthStore((s) => s.user);
  const access = user?.subscriptionAccess;
  if (!user || !isOfficer(user) || !access || !access.allowed || access.status !== 'TRIALING') return null;
  if (access.trialDaysLeft === null || access.trialDaysLeft > 3) return null;

  const days = access.trialDaysLeft;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="font-semibold text-amber-900 dark:text-amber-200">
          {days <= 1 ? 'Your free trial ends today or tomorrow' : `Your free trial ends in ${days} days`}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          After it ends, you and your members are blocked until a subscription payment is made.
        </p>
      </div>
      <Link
        href="/dashboard/subscription/plans"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
      >
        Choose a plan
      </Link>
    </div>
  );
}

/** Full-page notice when the association's trial or subscription has ended. Officers can renew; members are pointed to them. */
export function SubscriptionBlockedScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canRenew = isOfficer(user);
  const trialEnded = user?.subscriptionAccess?.reason === 'TRIAL_ENDED';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {trialEnded ? 'Your free trial has ended' : 'Your subscription has ended'}
        </h1>
        {canRenew ? (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {user?.association?.name ?? 'Your association'} is paused until a subscription payment is made. Your data is safe and
              everything comes back as soon as you renew.
            </p>
            <Link
              href="/dashboard/subscription/plans"
              className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Renew now
            </Link>
          </>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your association&apos;s subscription has expired. Please contact your administrator.
          </p>
        )}
        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
