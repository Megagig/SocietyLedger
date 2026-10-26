'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

const isOfficer = (user: User | null) =>
  !!user && ['admin', 'treasurer', 'financial_secretary'].includes(user.role) && !user.platformRole;

const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

/** How many whole days remain until `iso` (rounded up, never negative). */
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/**
 * Shown to the people who can renew when the free trial or the paid period is nearly over (a week or less), or when the paid period
 * has ended and only the grace period is keeping the association in.
 */
export function TrialEndingBanner() {
  const user = useAuthStore((s) => s.user);
  const access = user?.subscriptionAccess;
  if (!user || !isOfficer(user) || !access || !access.allowed) return null;

  let headline: string | null = null;
  let detail = '';
  let urgent = false;

  if (access.inGrace && access.graceEndsAt) {
    headline = 'Your subscription period has ended';
    detail = `You can keep using SocietyLedger until ${dateText(access.graceEndsAt)}. After that, you and your members are paused until you renew.`;
    urgent = true;
  } else if (access.status === 'TRIALING' && access.trialDaysLeft !== null && access.trialDaysLeft <= 7) {
    headline = access.trialDaysLeft <= 1 ? 'Your free trial ends today or tomorrow' : `Your free trial ends in ${access.trialDaysLeft} days`;
    detail = 'After it ends, you and your members are paused until a subscription payment is made.';
    urgent = access.trialDaysLeft <= 3;
  } else if (access.status !== 'TRIALING' && access.periodEndsAt && daysUntil(access.periodEndsAt) <= 7) {
    const days = daysUntil(access.periodEndsAt);
    headline = days <= 1 ? 'Your subscription ends today or tomorrow' : `Your subscription ends in ${days} days`;
    detail = `It ends on ${dateText(access.periodEndsAt)}. Renew before then so you and your members keep access.`;
    urgent = days <= 3;
  }
  if (!headline) return null;

  return (
    <div
      role="status"
      className={`mb-4 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${urgent ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'}`}
    >
      <div>
        <p className={`font-semibold ${urgent ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'}`}>{headline}</p>
        <p className={`text-sm ${urgent ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>{detail}</p>
      </div>
      <Link
        href="/dashboard/subscription/plans"
        className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${urgent ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
      >
        {access.status === 'TRIALING' ? 'Choose a plan' : 'Renew now'}
      </Link>
    </div>
  );
}

/**
 * Full-page notice when the association's trial or subscription has ended. Everything except billing is paused (the server refuses it
 * too). Officers can resubscribe; members are pointed to them. No records are deleted.
 */
export function SubscriptionBlockedScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canRenew = isOfficer(user);
  const access = user?.subscriptionAccess;
  const trialEnded = access?.reason === 'TRIAL_ENDED';
  const endedOn = !trialEnded && access?.periodEndsAt ? dateText(access.periodEndsAt) : trialEnded && access?.trialEndsAt ? dateText(access.trialEndsAt) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center" role="alert">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{trialEnded ? 'Your free trial has ended' : 'Your subscription has expired'}</h1>
        {endedOn && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ended on {endedOn}</p>}
        {canRenew ? (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {user?.association?.name ?? 'Your association'} is paused until you choose a plan and pay. All your records, members and transactions are safe, and everything comes back as soon as you resubscribe.
            </p>
            <Link href="/dashboard/subscription/plans" className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base">
              Resubscribe Now
            </Link>
            <Link href="/dashboard/subscription" className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View billing details
            </Link>
          </>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 mb-6">Your association&apos;s subscription has expired. Please contact your administrator.</p>
        )}
        <div className="mt-4">
          <Link href="/dashboard/help" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-4">
            Contact support
          </Link>
          <button type="button" onClick={() => logout()} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
