'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Text } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconUsers,
  IconCurrencyNaira,
  IconReceipt,
  IconChartBar,
  IconHeart,
  IconBell,
  IconSettings,
  IconHelp,
  IconMenu2,
  IconX,
  IconLogout,
  IconWallet,
  IconFileAnalytics,
  IconCreditCard,
  IconChevronDown,
  IconBuildingCommunity,
  IconBadge,
  IconBuildingBank,
  IconCalendarEvent,
  IconClipboardCheck,
  IconMessage,
  IconMail,
  IconBrandWhatsapp,
  IconHistory,
  IconTemplate,
  IconSpeakerphone,
  IconRobot,
  IconMessageChatbot,
  IconBrain,
  IconSparkles,
  IconChecklist,
  IconChartPie,
  IconUserPlus,
  IconQuestionMark,
  IconTicket,
  IconPlus,
  IconClock,
  IconWebhook,
  IconArticle,
  IconBook,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  permission?: string | string[];
  roleRequired?: 'admin' | 'treasurer' | 'financial_secretary'; // Admin-only sections
  hideForSuperAdmin?: boolean; // Hide for Super Admin users
  comingSoon?: boolean;
  badge?: string;
  children?: NavItem[];
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { user, logout, _hasHydrated } = useAuthStore();

  // Track client-side mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-expand Finance section if on Nigerian Payments page
  useEffect(() => {
    if (pathname.startsWith('/dashboard/payments/nigerian')) {
      setExpandedItems(prev => {
        if (!prev.includes('Finance')) {
          return [...prev, 'Finance'];
        }
        return prev;
      });
    }
  }, [pathname]);

  // Auto-expand Notifications section if on notifications page
  useEffect(() => {
    if (pathname.startsWith('/dashboard/notifications')) {
      setExpandedItems(prev => {
        if (!prev.includes('Notifications')) {
          return [...prev, 'Notifications'];
        }
        return prev;
      });
    }
  }, [pathname]);

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const checkPermission = (permission: string | string[] | undefined, roleRequired?: string, hideForSuperAdmin?: boolean): boolean => {
    // Wait for client-side mount and store hydration before showing permission-gated items
    // This prevents hydration mismatch between server and client
    if (!isMounted || !_hasHydrated) {
      // During SSR or before hydration, only show items without permissions
      if (!permission && !roleRequired) return true;
      return false;
    }
    
    // Check if item should be hidden for Super Admin
    if (hideForSuperAdmin && user?.platformRole === 'SUPER_ADMIN') {
      return false;
    }
    
    if (!permission && !roleRequired) return true;
    
    // Super admin has access to everything (except items explicitly hidden)
    if (user?.platformRole === 'SUPER_ADMIN') return true;
    
    // Admin role has access to all features including SMS/Communications
    // This ensures admins can see all menu items regardless of specific permissions
    if (user?.role === 'admin') {
      return true;
    }
    
    // After hydration, do proper permission checks
    
    // Check role requirement first (more restrictive)
    if (roleRequired && user?.role !== roleRequired) {
      return false;
    }
    
    // If no permission check needed, role check passed
    if (!permission) return true;
    
    // Get permissions array from user (fetched from API/database)
    const userPermissions = user?.permissions || [];
    
    // If no permissions loaded yet, fall back to showing items for admin role
    // This handles the case where permissions haven't been fetched yet
    if (userPermissions.length === 0 && user?.role === 'admin') {
      return true;
    }
    
    // Also show for members if they have any role and the item requires member-finance permission
    if (userPermissions.length === 0 && user?.role) {
      const permArray = Array.isArray(permission) ? permission : [permission];
      if (permArray.includes(PERMISSIONS.MEMBER_FINANCE_VIEW)) {
        return true;
      }
    }
    
    if (Array.isArray(permission)) {
      return permission.some(p => hasPermission(userPermissions, p as any));
    }
    
    return hasPermission(userPermissions, permission as any);
  };

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: <IconLayoutDashboard size={20} />,
      href: '/dashboard',
    },
    {
      label: 'Members',
      icon: <IconUsers size={20} />,
      href: '/dashboard/members',
      permission: PERMISSIONS.MEMBER_VIEW,
    },
    // Member Self-Service Finance Section (visible to both members and admins)
    // Note: Hidden for Super Admins as they don't have member records
    {
      label: 'My Finances',
      icon: <IconCurrencyNaira size={20} />,
      permission: [PERMISSIONS.MEMBER_FINANCE_VIEW, PERMISSIONS.FINANCE_VIEW], // Accept either member or admin permission
      hideForSuperAdmin: true, // Super admins don't have member records
      children: [
        {
          label: 'Overview',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/my-finances',
        },
        {
          label: 'My Ledger',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/my-finances/ledger',
        },
        {
          label: 'My Dues',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/my-finances/dues',
        },
        {
          label: 'My Levies',
          icon: <IconWallet size={18} />,
          href: '/dashboard/my-finances/levies',
        },
        {
          label: 'My Donations',
          icon: <IconHeart size={18} />,
          href: '/dashboard/my-finances/donations',
        },
        {
          label: 'Penalties',
          icon: <IconBadge size={18} />,
          href: '/dashboard/my-finances/penalties',
        },
        {
          label: 'Payment History',
          icon: <IconCreditCard size={18} />,
          href: '/dashboard/my-finances/payments',
        },
        {
          label: 'Make Payment',
          icon: <IconBuildingBank size={18} />,
          href: '/dashboard/my-finances/pay',
        },
      ],
    },
    // Admin Finance Section (visible to roles with FINANCE_VIEW permission)
    {
      label: 'Finance',
      icon: <IconCurrencyNaira size={20} />,
      permission: PERMISSIONS.FINANCE_VIEW,
      children: [
        {
          label: 'Overview',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/finance/overview',
        },
        {
          label: 'Member Ledgers',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/finance/member-ledger',
        },
        {
          label: 'Categories',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/finance/categories',
        },
        {
          label: 'Transactions',
          icon: <IconCreditCard size={18} />,
          href: '/dashboard/finance/transactions',
        },
        {
          label: 'Dues',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/finance/dues',
        },
        {
          label: 'Levies',
          icon: <IconWallet size={18} />,
          href: '/dashboard/finance/levies',
        },
        {
          label: 'Donations',
          icon: <IconHeart size={18} />,
          href: '/dashboard/finance/donations',
        },
        {
          label: 'Penalties',
          icon: <IconBadge size={18} />,
          href: '/dashboard/finance/penalties',
        },
        {
          label: 'Overdue',
          icon: <IconBell size={18} />,
          href: '/dashboard/finance/overdue',
        },
        {
          label: 'Reminders',
          icon: <IconBell size={18} />,
          href: '/dashboard/finance/reminders',
        },
        {
          label: 'Payment Management',
          icon: <IconBuildingBank size={18} />,
          href: '/dashboard/payments',
        },
        {
          // FORCE RENDER - Nigerian Payments Dashboard
          label: 'Nigerian Payments ✓',
          icon: <IconBuildingBank size={18} />,
          href: '/dashboard/payments/nigerian',
        },
      ],
    },
    {
      label: 'Accounting',
      icon: <IconFileAnalytics size={20} />,
      permission: PERMISSIONS.FINANCE_VIEW,
      children: [
        {
          label: 'Dashboard',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/accounting',
        },
        {
          label: 'Chart of Accounts',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/accounting/chart-of-accounts',
        },
        {
          label: 'Journal Entries',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/accounting/journal-entries',
        },
        {
          label: 'Income Statement',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/accounting/income-statement',
        },
        {
          label: 'Balance Sheet',
          icon: <IconWallet size={18} />,
          href: '/dashboard/accounting/balance-sheet',
        },
        {
          label: 'Cash Flow',
          icon: <IconCreditCard size={18} />,
          href: '/dashboard/accounting/cash-flow',
        },
        {
          label: 'Budgets',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/accounting/budgets',
        },
      ],
    },
    {
      label: 'Reports',
      icon: <IconChartBar size={20} />,
      permission: PERMISSIONS.REPORT_VIEW,
      children: [
        {
          label: 'Dashboard',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/reports',
        },
        {
          label: 'Financial Summary',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/reports/financial-summary',
          permission: PERMISSIONS.REPORT_FINANCIAL,
        },
        {
          label: 'Member Balances',
          icon: <IconUsers size={18} />,
          href: '/dashboard/reports/member-balances',
          permission: PERMISSIONS.REPORT_MEMBER,
        },
        {
          label: 'Aging Analysis',
          icon: <IconBell size={18} />,
          href: '/dashboard/reports/aging-analysis',
          permission: PERMISSIONS.REPORT_FINANCIAL,
        },
        {
          label: 'Collection Rate',
          icon: <IconWallet size={18} />,
          href: '/dashboard/reports/collection-rate',
          permission: PERMISSIONS.REPORT_FINANCIAL,
        },
        {
          label: 'By Category',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/reports/by-category',
          permission: PERMISSIONS.REPORT_FINANCIAL,
        },
        {
          label: 'Export Data',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/exports',
          permission: PERMISSIONS.REPORT_VIEW,
        },
      ],
    },
    {
      label: 'Governance',
      icon: <IconBadge size={20} />,
      permission: [PERMISSIONS.MEETING_VIEW, PERMISSIONS.ELECTION_VIEW, PERMISSIONS.POLL_VIEW],
      children: [
        {
          label: 'Meetings',
          icon: <IconCalendarEvent size={18} />,
          href: '/dashboard/governance/meetings',
          permission: PERMISSIONS.MEETING_VIEW,
        },
        {
          label: 'Attendance History',
          icon: <IconClipboardCheck size={18} />,
          href: '/dashboard/governance/attendance',
          permission: PERMISSIONS.MEETING_VIEW,
        },
        {
          label: 'Voting Dashboard',
          icon: <IconChecklist size={18} />,
          href: '/dashboard/governance/voting',
          permission: PERMISSIONS.ELECTION_VIEW,
        },
        {
          label: 'Elections',
          icon: <IconBadge size={18} />,
          href: '/dashboard/governance/elections',
          permission: PERMISSIONS.ELECTION_VIEW,
        },
        {
          label: 'Polls',
          icon: <IconChartPie size={18} />,
          href: '/dashboard/governance/polls',
          permission: PERMISSIONS.POLL_VIEW,
        },
      ],
    },
    {
      label: 'Welfare',
      icon: <IconHeart size={20} />,
      permission: PERMISSIONS.WELFARE_VIEW,
      children: [
        {
          label: 'Dashboard',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/welfare',
          permission: PERMISSIONS.WELFARE_VIEW,
        },
        {
          label: 'Social Funds',
          icon: <IconWallet size={18} />,
          href: '/dashboard/welfare/social-funds',
          permission: PERMISSIONS.WELFARE_VIEW,
        },
        {
          label: 'Contributions',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/welfare/contributions',
          permission: PERMISSIONS.WELFARE_CONTRIBUTION_VIEW,
        },
        {
          label: 'Requests & Payouts',
          icon: <IconHeart size={18} />,
          href: '/dashboard/welfare/requests',
          permission: PERMISSIONS.WELFARE_PAYOUT_VIEW,
        },
      ],
    },
    {
      label: 'Cooperatives',
      icon: <IconBuildingCommunity size={20} />,
      badge: 'Enterprise',
      permission: PERMISSIONS.COOPERATIVE_VIEW,
      children: [
        {
          label: 'Dashboard',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/cooperatives',
          permission: PERMISSIONS.COOPERATIVE_VIEW,
        },
        {
          label: 'My Savings',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/cooperatives/my-savings',
          permission: PERMISSIONS.COOPERATIVE_SAVINGS_VIEW,
        },
        {
          label: 'My Loans',
          icon: <IconWallet size={18} />,
          href: '/dashboard/cooperatives/my-loans',
          permission: PERMISSIONS.COOPERATIVE_LOANS_VIEW,
        },
        {
          label: 'Apply for Loan',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/cooperatives/apply',
          permission: PERMISSIONS.COOPERATIVE_LOANS_APPLY,
        },
        {
          label: 'Guarantor Requests',
          icon: <IconUsers size={18} />,
          href: '/dashboard/cooperatives/guarantors',
          permission: PERMISSIONS.COOPERATIVE_GUARANTOR,
        },
        {
          label: 'All Savings',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/cooperatives/savings',
          permission: PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE,
        },
        {
          label: 'All Loans',
          icon: <IconWallet size={18} />,
          href: '/dashboard/cooperatives/loans',
          permission: PERMISSIONS.COOPERATIVE_LOANS_MANAGE,
        },
        {
          label: 'Loan Products',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/cooperatives/loan-products',
          permission: PERMISSIONS.COOPERATIVE_LOANS_MANAGE,
        },
        {
          label: 'Applications',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/cooperatives/applications',
          permission: PERMISSIONS.COOPERATIVE_LOANS_MANAGE,
        },
      ],
    },
    {
      label: 'Notifications',
      icon: <IconBell size={20} />,
      children: [
        {
          label: 'Notifications Center',
          icon: <IconBell size={18} />,
          href: '/dashboard/notifications',
        },
        {
          label: 'Preferences',
          icon: <IconSettings size={18} />,
          href: '/dashboard/notifications/preferences',
        },
        {
          label: 'Archive',
          icon: <IconHistory size={18} />,
          href: '/dashboard/notifications/archive',
        },
      ],
    },
    {
      label: 'Communication',
      icon: <IconSpeakerphone size={20} />,
      children: [
        {
          label: 'Announcements',
          icon: <IconBell size={18} />,
          href: '/dashboard/communication/announcements',
        },
        {
          label: 'SMS Dashboard',
          icon: <IconMessage size={18} />,
          href: '/dashboard/communications',
        },
        {
          label: 'Quick Send SMS',
          icon: <IconMessage size={18} />,
          href: '/dashboard/communications/quick-send',
        },
        {
          label: 'SMS Campaigns',
          icon: <IconSpeakerphone size={18} />,
          href: '/dashboard/communications/campaigns',
        },
        {
          label: 'SMS Templates',
          icon: <IconTemplate size={18} />,
          href: '/dashboard/communications/templates',
        },
        {
          label: 'SMS History',
          icon: <IconHistory size={18} />,
          href: '/dashboard/communications/history',
        },
        {
          label: 'SMS Reports',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/communications/reports',
        },
        {
          label: 'Email Campaigns',
          icon: <IconMail size={18} />,
          href: '/dashboard/communication/email',
        },
        {
          label: 'WhatsApp',
          icon: <IconBrandWhatsapp size={18} />,
          href: '/dashboard/communication/whatsapp',
          badge: 'Pro',
        },
      ],
    },
    {
      label: 'AI Assistant',
      icon: <IconRobot size={20} />,
      badge: 'Beta',
      permission: PERMISSIONS.AI_VIEW,
      children: [
        {
          label: 'Financial Assistant',
          icon: <IconMessageChatbot size={18} />,
          href: '/dashboard/ai/assistant',
          permission: PERMISSIONS.AI_FINANCIAL_ASSISTANT,
        },
        {
          label: 'Smart Reports',
          icon: <IconSparkles size={18} />,
          href: '/dashboard/ai/reports',
          permission: PERMISSIONS.AI_REPORTS,
        },
        {
          label: 'Smart Reminders',
          icon: <IconBell size={18} />,
          href: '/dashboard/ai/reminders',
          permission: PERMISSIONS.AI_FINANCIAL_ASSISTANT,
        },
        {
          label: 'Data Query',
          icon: <IconBrain size={18} />,
          href: '/dashboard/ai/query',
          permission: PERMISSIONS.AI_QUERY,
        },
        {
          label: 'Usage & Stats',
          icon: <IconChartBar size={18} />,
          href: '/dashboard/ai/usage',
          permission: PERMISSIONS.AI_USAGE_VIEW,
        },
      ],
    },
    {
      label: 'Subscription',
      icon: <IconCreditCard size={20} />,
      href: '/dashboard/subscription',
      permission: PERMISSIONS.SUBSCRIPTION_VIEW,
    },
    {
      label: 'Settings',
      icon: <IconSettings size={20} />,
      permission: PERMISSIONS.SETTINGS_VIEW,
      children: [
        {
          label: 'Overview',
          icon: <IconSettings size={18} />,
          href: '/dashboard/settings',
        },
        {
          label: 'Association Profile',
          icon: <IconBuildingCommunity size={18} />,
          href: '/dashboard/settings/association',
          permission: PERMISSIONS.SETTINGS_VIEW,
        },
        {
          label: 'Roles & Permissions',
          icon: <IconBadge size={18} />,
          href: '/dashboard/settings/roles',
          permission: PERMISSIONS.SETTINGS_VIEW,
        },
        {
          label: 'User Management',
          icon: <IconUserPlus size={18} />,
          href: '/dashboard/settings/users',
          permission: PERMISSIONS.USER_VIEW,
        },
        {
          label: 'Members Access',
          icon: <IconUsers size={18} />,
          href: '/dashboard/settings/members-access',
          permission: PERMISSIONS.SETTINGS_EDIT,
        },
        {
          label: 'Financial Settings',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/settings/financial',
          permission: PERMISSIONS.SETTINGS_EDIT,
        },
        {
          label: 'Payments & Billing',
          icon: <IconCreditCard size={18} />,
          href: '/dashboard/settings/payments',
          permission: PERMISSIONS.SETTINGS_BILLING,
        },
        {
          label: 'Notifications',
          icon: <IconBell size={18} />,
          href: '/dashboard/settings/notifications',
          permission: PERMISSIONS.SETTINGS_EDIT,
        },
        {
          label: 'Integrations',
          icon: <IconBuildingBank size={18} />,
          href: '/dashboard/settings/integrations',
          permission: PERMISSIONS.SETTINGS_INTEGRATIONS,
        },
        {
          label: 'Accounting Integration',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/settings/accounting-integration',
          permission: PERMISSIONS.FINANCE_VIEW,
        },
        {
          label: 'Data & Privacy',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/settings/data-privacy',
          permission: PERMISSIONS.SETTINGS_EDIT,
        },
        {
          label: 'Audit Logs',
          icon: <IconHistory size={18} />,
          href: '/dashboard/settings/audit-logs',
          permission: PERMISSIONS.AUDIT_VIEW,
        },
        {
          label: 'Cron Jobs',
          icon: <IconClock size={18} />,
          href: '/dashboard/system/cron-jobs',
          permission: PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
        },
      ],
    },
    {
      label: 'Help & Support',
      icon: <IconHelp size={20} />,
      children: [
        {
          label: 'Help Center',
          icon: <IconHelp size={18} />,
          href: '/dashboard/help',
        },
        {
          label: 'Articles',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/help/articles',
        },
        {
          label: 'FAQs',
          icon: <IconQuestionMark size={18} />,
          href: '/dashboard/help/faqs',
        },
        {
          label: 'My Tickets',
          icon: <IconTicket size={18} />,
          href: '/dashboard/help/tickets',
        },
        {
          label: 'Create Ticket',
          icon: <IconPlus size={18} />,
          href: '/dashboard/help/tickets/new',
        },
      ],
    },
    {
      label: 'Setup Wizard',
      icon: <IconBadge size={20} />,
      href: '/onboarding?rerun=true',
      permission: PERMISSIONS.SETTINGS_VIEW,
    },
  ];

  // Add super admin specific items
  if (user?.platformRole === 'SUPER_ADMIN') {
    // Find Help & Support menu and add admin items
    const helpMenu = navItems.find(item => item.label === 'Help & Support');
    if (helpMenu && helpMenu.children) {
      helpMenu.children.push(
        {
          label: 'Manage Content',
          icon: <IconSettings size={18} />,
          href: '/dashboard/settings/help-content',
        },
        {
          label: 'Manage Tickets',
          icon: <IconClipboardCheck size={18} />,
          href: '/dashboard/settings/support',
        }
      );
    }

    navItems.unshift({
      label: 'Super Admin',
      icon: <IconBadge size={20} />,
      children: [
        {
          label: 'Dashboard',
          icon: <IconLayoutDashboard size={18} />,
          href: '/admin',
        },
        {
          label: 'Associations',
          icon: <IconBuildingCommunity size={18} />,
          href: '/admin/associations',
        },
        {
          label: 'Tenant Management',
          icon: <IconUsers size={18} />,
          href: '/admin/tenants',
        },
        {
          label: 'Platform Analytics',
          icon: <IconChartBar size={18} />,
          href: '/admin/analytics',
        },
        {
          label: 'Action Logs',
          icon: <IconHistory size={18} />,
          href: '/admin/action-logs',
        },
        {
          label: 'Modules & Features',
          icon: <IconChecklist size={18} />,
          href: '/admin/modules',
        },
        {
          label: 'Settings',
          icon: <IconSettings size={18} />,
          href: '/admin/settings',
        },
        {
          label: 'Webhooks',
          icon: <IconWebhook size={18} />,
          href: '/admin/webhooks',
        },
        {
          label: 'Cron Jobs',
          icon: <IconRobot size={18} />,
          href: '/admin/cron-jobs',
        },
      ],
    });

    // Add CMS section for Super Admin
    navItems.push({
      label: 'CMS',
      icon: <IconArticle size={20} />,
      children: [
        {
          label: 'Blog',
          icon: <IconArticle size={18} />,
          href: '/admin/blog',
        },
        {
          label: 'Documentation',
          icon: <IconBook size={18} />,
          href: '/admin/documentation',
        },
      ],
    });
  }

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleLogout = async () => {
    modals.openConfirmModal({
      title: 'Confirm Logout',
      children: (
        <Text size="sm">
          Are you sure you want to log out? You will need to sign in again to access your account.
        </Text>
      ),
      labels: { confirm: 'Logout', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const loadingId = toast.loading('Logging out...');
        try {
          await logout();
          toast.updateSuccess(loadingId, 'Logged out successfully');
          window.location.href = '/auth/login';
        } catch (error) {
          toast.updateError(loadingId, 'Failed to logout. Please try again.');
        }
      },
    });
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass-strong border border-gray-200/50 dark:border-gray-700/50"
      >
        {isOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-72 glass-strong border-r border-gray-200/50 dark:border-gray-700/50 
          z-40 transition-transform duration-300 flex flex-col pb-16 lg:pb-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            {user?.association?.logo ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <img 
                  src={user.association.logo.startsWith('http') ? user.association.logo : `${process.env.NEXT_PUBLIC_API_URL}${user.association.logo}`}
                  alt={user.association.name || 'Logo'} 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <IconUsers className="text-white" size={24} />
              </div>
            )}
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                {user?.association?.name || 'SocietyLedger'}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.platformRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Association Portal'}
              </p>
            </div>
          </Link>
        </div>

        {/* User Info */}
        {user && user.email && (
          <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center text-white font-semibold">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            if (!checkPermission(item.permission, item.roleRequired, item.hideForSuperAdmin)) return null;

            const hasChildren = item.children && item.children.length > 0;
            // Special handling for Notifications to ensure it's always expandable
            let hasVisibleChildren;
            let visibleChildren;
            
            if (item.label === 'Notifications') {
              // Force Notifications to be expandable with all children visible
              visibleChildren = item.children || [];
              hasVisibleChildren = visibleChildren.length > 0;
            } else {
              visibleChildren = item.children?.filter(child => 
                checkPermission(child.permission, child.roleRequired, child.hideForSuperAdmin)
              ) || [];
              hasVisibleChildren = visibleChildren.length > 0;
            }
            const isExpanded = expandedItems.includes(item.label);
            const active = isActive(item.href);

            return (
              <div key={item.label}>
                {hasVisibleChildren ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className={`
                        w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg
                        transition-all duration-200 group bg-transparent
                        ${active
                          ? 'bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400'
                          : 'text-gray-800 dark:text-white hover:text-teal-600 dark:hover:text-teal-400'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <IconChevronDown
                        size={16}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                        {visibleChildren.map((child) => (
                          <Link
                            key={child.label}
                            href={child.comingSoon ? '#' : (child.href || '#')}
                            onClick={(e) => {
                              if (child.comingSoon) {
                                e.preventDefault();
                              }
                              setIsOpen(false);
                            }}
                            className={`
                              flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                              transition-all duration-200 text-sm bg-transparent
                              ${isActive(child.href)
                                ? 'bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400'
                                : 'text-gray-700 dark:text-white hover:text-teal-600 dark:hover:text-teal-400'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              {child.icon}
                              <span>{child.label}</span>
                            </div>
                            {child.comingSoon && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                Soon
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.comingSoon ? '#' : (item.href || '#')}
                    onClick={(e) => {
                      if (item.comingSoon) {
                        e.preventDefault();
                      }
                      setIsOpen(false);
                    }}
                    className={`
                      flex items-center justify-between gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200 group bg-transparent
                      ${active
                        ? 'bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400'
                        : 'text-gray-800 dark:text-white hover:text-teal-600 dark:hover:text-teal-400'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {(item.comingSoon || item.badge) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {item.badge || 'Soon'}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2 bg-white/50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
            <ThemeToggle />
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 font-medium"
          >
            <IconLogout size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
