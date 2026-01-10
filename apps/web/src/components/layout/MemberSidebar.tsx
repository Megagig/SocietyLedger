'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Text } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconCurrencyNaira,
  IconUser,
  IconCalendarEvent,
  IconChecklist,
  IconBuildingCommunity,
  IconHeart,
  IconBell,
  IconHelp,
  IconMenu2,
  IconX,
  IconLogout,
  IconUsers,
  IconWallet,
  IconFileAnalytics,
  IconReceipt,
  IconCreditCard,
  IconBadge,
  IconBuildingBank,
  IconClipboardCheck,
  IconChartPie,
  IconQuestionMark,
  IconTicket,
  IconSettings,
  IconChevronDown,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string;
  children?: NavItem[];
}

export function MemberSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { user, logout, _hasHydrated } = useAuthStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const navItems: NavItem[] = [
    {
      label: 'My Dashboard',
      icon: <IconLayoutDashboard size={20} />,
      href: '/dashboard/member',
    },
    {
      label: 'My Finances',
      icon: <IconCurrencyNaira size={20} />,
      children: [
        {
          label: 'Overview',
          icon: <IconLayoutDashboard size={18} />,
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
    {
      label: 'My Profile',
      icon: <IconUser size={20} />,
      href: '/dashboard/member/my-profile',
    },
    {
      label: 'Governance',
      icon: <IconBadge size={20} />,
      children: [
        {
          label: 'Meetings',
          icon: <IconCalendarEvent size={18} />,
          href: '/dashboard/member/my-meetings',
        },
        {
          label: 'My Attendance',
          icon: <IconClipboardCheck size={18} />,
          href: '/dashboard/governance/attendance',
        },
        {
          label: 'Voting',
          icon: <IconChecklist size={18} />,
          href: '/dashboard/member/my-voting',
        },
        {
          label: 'Polls',
          icon: <IconChartPie size={18} />,
          href: '/dashboard/governance/polls',
        },
      ],
    },
    {
      label: 'Cooperatives',
      icon: <IconBuildingCommunity size={20} />,
      badge: 'Enterprise',
      children: [
        {
          label: 'My Savings',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/cooperatives/my-savings',
        },
        {
          label: 'My Loans',
          icon: <IconWallet size={18} />,
          href: '/dashboard/cooperatives/my-loans',
        },
        {
          label: 'Apply for Loan',
          icon: <IconFileAnalytics size={18} />,
          href: '/dashboard/cooperatives/apply',
        },
        {
          label: 'Guarantor Requests',
          icon: <IconUsers size={18} />,
          href: '/dashboard/cooperatives/guarantors',
        },
      ],
    },
    {
      label: 'Welfare',
      icon: <IconHeart size={20} />,
      children: [
        {
          label: 'My Contributions',
          icon: <IconCurrencyNaira size={18} />,
          href: '/dashboard/welfare/contributions',
        },
        {
          label: 'Request Payout',
          icon: <IconReceipt size={18} />,
          href: '/dashboard/welfare/requests',
        },
      ],
    },
    {
      label: 'Notifications',
      icon: <IconBell size={20} />,
      href: '/dashboard/notifications',
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
          label: 'FAQs',
          icon: <IconQuestionMark size={18} />,
          href: '/dashboard/help/faqs',
        },
        {
          label: 'My Tickets',
          icon: <IconTicket size={18} />,
          href: '/dashboard/help/tickets',
        },
      ],
    },
    {
      label: 'Settings',
      icon: <IconSettings size={20} />,
      href: '/dashboard/member/settings',
    },
  ];

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);
    const active = isActive(item.href);

    return (
      <div key={item.label}>
        {hasChildren ? (
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
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {item.badge}
                  </span>
                )}
                <IconChevronDown
                  size={16}
                  className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {isExpanded && item.children && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                {item.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href || '#'}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg
                      transition-all duration-200 text-sm bg-transparent
                      ${isActive(child.href)
                        ? 'bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400'
                        : 'text-gray-700 dark:text-white hover:text-teal-600 dark:hover:text-teal-400'
                      }
                    `}
                  >
                    {child.icon}
                    <span>{child.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <Link
            href={item.href || '#'}
            onClick={() => setIsOpen(false)}
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
            {item.badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {item.badge}
              </span>
            )}
          </Link>
        )}
      </div>
    );
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
          <Link href="/dashboard/member" className="flex items-center gap-3 group">
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
                Member Portal
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
                  Member
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map(renderNavItem)}
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
