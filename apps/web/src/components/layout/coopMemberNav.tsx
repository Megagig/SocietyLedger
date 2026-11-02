'use client';

import type { ReactNode } from 'react';
import {
  IconBook2,
  IconBuildingBank,
  IconCashBanknote,
  IconCreditCard,
  IconCurrencyNaira,
  IconFileAnalytics,
  IconHistory,
  IconLayoutDashboard,
  IconPigMoney,
  IconReceipt,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import api from '@/lib/axios';
import { useScopedQuery } from '@/lib/query';
import { PERMISSIONS, hasAnyPermission } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';

export interface CoopNavItem {
  label: string;
  icon: ReactNode;
  href?: string;
  children?: CoopNavItem[];
}

/** The member's own cooperative pages, in the order the sidebar shows them. One list, so a member and an officer-who-is-a-member see the same menu. */
export const COOP_MEMBER_NAV: CoopNavItem[] = [
  { label: 'Cooperative Dashboard', icon: <IconLayoutDashboard size={20} />, href: '/dashboard/cooperatives/my-dashboard' },
  {
    label: 'Savings',
    icon: <IconPigMoney size={20} />,
    children: [
      { label: 'Savings', icon: <IconCurrencyNaira size={18} />, href: '/dashboard/cooperatives/my-savings' },
      { label: 'My Withdrawal', icon: <IconCashBanknote size={18} />, href: '/dashboard/cooperatives/my-withdrawal' },
    ],
  },
  {
    label: 'Transactions',
    icon: <IconReceipt size={20} />,
    children: [
      { label: 'My Transactions', icon: <IconFileAnalytics size={18} />, href: '/dashboard/cooperatives/my-transactions' },
      { label: 'My Cashbook', icon: <IconBook2 size={18} />, href: '/dashboard/cooperatives/my-cashbook' },
      { label: 'My Pending Payments', icon: <IconCreditCard size={18} />, href: '/dashboard/cooperatives/my-pending-payments' },
    ],
  },
  {
    label: 'Loans',
    icon: <IconWallet size={20} />,
    children: [
      { label: 'My Loans', icon: <IconWallet size={18} />, href: '/dashboard/cooperatives/my-loans' },
      { label: 'Loan Repayment', icon: <IconHistory size={18} />, href: '/dashboard/cooperatives/repay-loan' },
      { label: 'Guarantor Requests', icon: <IconUsers size={18} />, href: '/dashboard/cooperatives/guarantors' },
    ],
  },
  { label: 'Cooperative Bank Accounts', icon: <IconBuildingBank size={20} />, href: '/dashboard/cooperatives/bank-accounts' },
];

/**
 * The cooperative section of a member's menu: empty unless the association's plan includes the cooperatives module AND the signed-in
 * person may see their own cooperative pages. A plan without the module hides the section entirely instead of showing a locked one.
 */
export function useCoopMemberNav(): CoopNavItem[] {
  const permissions = useAuthStore((s) => s.user?.permissions);
  const modules = useScopedQuery<Array<{ code: string; isEnabled: boolean }>>({
    domain: 'modules',
    parts: ['mine'],
    queryFn: async () => (await api.get('/modules/mine')).data?.data?.modules ?? [],
  });
  const planHasIt = !!modules.data?.some((m) => m.code === 'cooperatives' && m.isEnabled);
  const mayView = hasAnyPermission(permissions || [], [PERMISSIONS.COOPERATIVE_VIEW_OWN, PERMISSIONS.COOPERATIVE_SAVINGS_DEPOSIT_OWN, PERMISSIONS.COOPERATIVE_REPAY_OWN]);
  return planHasIt && mayView ? COOP_MEMBER_NAV : [];
}
