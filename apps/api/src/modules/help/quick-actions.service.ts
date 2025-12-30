// ============================================
// PHASE 21: QUICK ACTIONS SERVICE
// Role-based quick action cards for help center
// ============================================

import { QuickAction } from './help.types';

// ============================================
// QUICK ACTIONS BY ROLE
// ============================================

const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'onboarding',
    title: 'Complete Onboarding',
    description: 'Finish setting up your association',
    icon: 'rocket',
    href: '/dashboard/onboarding',
    roles: ['admin'],
  },
  {
    id: 'bulk-import',
    title: 'Import Members',
    description: 'Bulk import members from CSV/Excel',
    icon: 'upload',
    href: '/dashboard/members/import',
    roles: ['admin'],
  },
  {
    id: 'manage-roles',
    title: 'Manage Roles',
    description: 'Configure user roles and permissions',
    icon: 'shield',
    href: '/dashboard/settings/roles',
    roles: ['admin'],
  },
  {
    id: 'view-reports',
    title: 'View Reports',
    description: 'Access financial and member reports',
    icon: 'chart-bar',
    href: '/dashboard/reports',
    roles: ['admin'],
  },
  {
    id: 'association-settings',
    title: 'Association Settings',
    description: 'Configure your association profile',
    icon: 'cog',
    href: '/dashboard/settings',
    roles: ['admin'],
  },
];

const TREASURER_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'record-payment',
    title: 'Record Payment',
    description: 'Record a new member payment',
    icon: 'currency-dollar',
    href: '/dashboard/finance/payments/new',
    roles: ['treasurer', 'admin'],
  },
  {
    id: 'view-ledger',
    title: 'View Ledger',
    description: 'Access the financial ledger',
    icon: 'book-open',
    href: '/dashboard/finance/ledger',
    roles: ['treasurer', 'admin'],
  },
  {
    id: 'member-statements',
    title: 'Member Statements',
    description: 'Generate member financial statements',
    icon: 'document-text',
    href: '/dashboard/finance/statements',
    roles: ['treasurer', 'admin'],
  },
  {
    id: 'reconciliation',
    title: 'Bank Reconciliation',
    description: 'Reconcile bank transactions',
    icon: 'scale',
    href: '/dashboard/finance/reconciliation',
    roles: ['treasurer', 'admin'],
  },
  {
    id: 'financial-reports',
    title: 'Financial Reports',
    description: 'Generate P&L, Balance Sheet, Cash Flow',
    icon: 'presentation-chart-line',
    href: '/dashboard/reports/financial',
    roles: ['treasurer', 'admin'],
  },
];

const MEMBER_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'my-statement',
    title: 'My Statement',
    description: 'View your financial statement',
    icon: 'document',
    href: '/dashboard/my-finance/statement',
    roles: ['member'],
  },
  {
    id: 'make-payment',
    title: 'Make Payment',
    description: 'Pay your dues online',
    icon: 'credit-card',
    href: '/dashboard/my-finance/pay',
    roles: ['member'],
  },
  {
    id: 'payment-history',
    title: 'Payment History',
    description: 'View your payment history',
    icon: 'clock',
    href: '/dashboard/my-finance/history',
    roles: ['member'],
  },
  {
    id: 'update-profile',
    title: 'Update Profile',
    description: 'Update your member profile',
    icon: 'user',
    href: '/dashboard/profile',
    roles: ['member'],
  },
  {
    id: 'contact-support',
    title: 'Contact Support',
    description: 'Create a support ticket',
    icon: 'chat-bubble-left-right',
    href: '/dashboard/help/tickets/new',
    roles: ['member', 'treasurer', 'admin'],
  },
];

// ============================================
// QUICK ACTIONS SERVICE
// ============================================

export const quickActionsService = {
  /**
   * Get quick actions for a specific role
   */
  getQuickActionsForRole(role: string): QuickAction[] {
    const actions: QuickAction[] = [];

    // Add role-specific actions
    switch (role.toLowerCase()) {
      case 'admin':
      case 'super_admin':
        actions.push(...ADMIN_QUICK_ACTIONS);
        actions.push(...TREASURER_QUICK_ACTIONS.filter(a => a.roles.includes('admin')));
        break;
      case 'treasurer':
        actions.push(...TREASURER_QUICK_ACTIONS);
        break;
      case 'member':
      default:
        actions.push(...MEMBER_QUICK_ACTIONS);
        break;
    }

    // Always add contact support for all roles
    const hasSupport = actions.some(a => a.id === 'contact-support');
    if (!hasSupport) {
      actions.push(MEMBER_QUICK_ACTIONS.find(a => a.id === 'contact-support')!);
    }

    // Remove duplicates and return
    const seen = new Set<string>();
    return actions.filter(action => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
  },

  /**
   * Get all quick actions
   */
  getAllQuickActions(): QuickAction[] {
    const allActions = [
      ...ADMIN_QUICK_ACTIONS,
      ...TREASURER_QUICK_ACTIONS,
      ...MEMBER_QUICK_ACTIONS,
    ];

    // Remove duplicates
    const seen = new Set<string>();
    return allActions.filter(action => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
  },

  /**
   * Get quick actions filtered by multiple roles
   */
  getQuickActionsForRoles(roles: string[]): QuickAction[] {
    const actions: QuickAction[] = [];

    roles.forEach(role => {
      const roleActions = this.getQuickActionsForRole(role);
      actions.push(...roleActions);
    });

    // Remove duplicates
    const seen = new Set<string>();
    return actions.filter(action => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
  },
};

export default quickActionsService;
