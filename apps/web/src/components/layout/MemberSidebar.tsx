'use client';

import { SidebarAvatar } from '@/components/members/SidebarAvatar';
import { useState, useEffect, useRef } from 'react';
import { useNavDrawer } from './useNavDrawer';
import { BrandMark } from '@/components/brand/BrandLogo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Text } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconHome,
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
  IconPigMoney,
  IconClipboardCheck,
  IconChartPie,
  IconQuestionMark,
  IconTicket,
  IconSettings,
  IconChevronDown,
  IconHistory,
  IconBook2,
  IconExternalLink,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS, hasAnyPermission } from '@/lib/permissions';
import { THRIFT_ONLY_MEMBER_LABELS, useAjoNav } from '@/lib/ajo/useAjoNav';
import { thriftWord } from '@/lib/ajo/thriftScope';
import { useMyMemberships } from '@/lib/ajo/hooks';
import { useWaitingCount } from '@/lib/ajo/staffHooks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { docsUrl } from '@/lib/docs';
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
  const asideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useNavDrawer(isOpen, setIsOpen, asideRef, toggleRef);
  // True while the tablet rail (768-1023px) is showing its icons only.
  const railNow = () => !isOpen && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px) and (max-width: 1023.98px)').matches;
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { user, logout, _hasHydrated } = useAuthStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // The Election Committee are ordinary members who also run elections, so their extra section appears with the role.
  const isElectionCommittee = hasAnyPermission(user?.permissions || [], [
    PERMISSIONS.ELECTION_MANAGE,
    PERMISSIONS.ELECTION_CANDIDATES,
    PERMISSIONS.ELECTION_RULES,
    PERMISSIONS.ELECTION_RUN,
    PERMISSIONS.ELECTION_RESULTS_VIEW,
    PERMISSIONS.ELECTION_RESULTS_PUBLISH,
    PERMISSIONS.POLL_MANAGE,
  ]);

  // Ajo / Thrift: shown by permission, marked "Locked" when the add-on is not on the account.
  const ajoNav = useAjoNav();
  const ajoBadge = ajoNav.locked ? 'Locked' : undefined;
  // A standalone group's own circles, so each has its page and its board in the menu.
  const mine = useMyMemberships(ajoNav.thriftOnly && ajoNav.member);
  // Transfers waiting to be confirmed, for people who can confirm them.
  // Only asked once Ajo is known to be on for this association; otherwise the server refuses it on every page.
  const waiting = useWaitingCount(ajoNav.reconcile && ajoNav.available);
  const payBadge = ajoNav.locked ? 'Locked' : waiting.data && waiting.data.transfersToConfirm > 0 ? String(waiting.data.transfersToConfirm) : undefined;

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
    ...(isElectionCommittee
      ? [
          {
            label: 'Election Committee',
            icon: <IconUsers size={20} />,
            children: [
              {
                label: 'Elections',
                icon: <IconChecklist size={18} />,
                href: '/dashboard/governance/elections',
              },
              {
                label: 'Voting Rules',
                icon: <IconChecklist size={18} />,
                href: '/dashboard/governance/elections/rules',
              },
              {
                label: 'Manage Polls',
                icon: <IconChartPie size={18} />,
                href: '/dashboard/governance/polls',
              },
            ],
          },
        ]
      : []),
    ...(ajoNav.member
      ? [
          {
            label: 'My Thrift',
            icon: <IconPigMoney size={20} />,
            badge: ajoBadge,
            children: [
              { label: 'My Circles', icon: <IconChecklist size={18} />, href: '/dashboard/my-thrift' },
              { label: 'My Payments', icon: <IconCurrencyNaira size={18} />, href: '/dashboard/my-thrift/payments' },
              { label: 'Payout Account', icon: <IconBuildingBank size={18} />, href: '/dashboard/my-thrift/payout-account' },
            ],
          },
        ]
      : []),
    ...(ajoNav.staff ? [{ label: 'Thrift Circles', icon: <IconPigMoney size={20} />, href: '/dashboard/ajo', badge: ajoBadge }] : []),
    ...(ajoNav.staff ? [{ label: 'Payments', icon: <IconCurrencyNaira size={20} />, href: '/dashboard/ajo/payments', badge: payBadge }] : []),
    ...(ajoNav.collect ? [{ label: 'Collect', icon: <IconCurrencyNaira size={20} />, href: '/dashboard/ajo/collect', badge: ajoBadge }] : []),
    ...(ajoNav.reports ? [{ label: 'Thrift Reports', icon: <IconFileAnalytics size={20} />, href: '/dashboard/ajo/reports', badge: ajoBadge }] : []),
    {
      label: 'Cooperatives',
      icon: <IconBuildingCommunity size={20} />,
      // badge: 'Enterprise',
      children: [
        {
          label: 'Overview',
          icon: <IconLayoutDashboard size={18} />,
          href: '/dashboard/cooperatives',
        },
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

  // A standalone thrift group is only Thrift: its own menu, never an association's with entries left out.
  const circles = (mine.data ?? []).filter((m) => m.status !== 'LEFT');
  const pick = (...labels: string[]) => labels.map((l) => navItems.find((i) => i.label === l)).filter((i): i is NavItem => !!i);
  const thriftItems: NavItem[] = [
    { label: 'Thrift Home', icon: <IconHome size={20} />, href: '/dashboard' },
    ...(ajoNav.member
      ? [
          {
            label: 'My Thrift',
            icon: <IconPigMoney size={20} />,
            badge: ajoBadge,
            children: [
              { label: 'My Circles', icon: <IconChecklist size={18} />, href: '/dashboard/my-thrift' },
              { label: 'My Payments', icon: <IconCurrencyNaira size={18} />, href: '/dashboard/my-thrift/payments' },
              ...circles.map((m) => ({ label: m.group.name, icon: <IconPigMoney size={18} />, href: `/dashboard/my-thrift/${m.membershipId}` })),
              ...circles.filter((m) => m.group.model === 'ROTATING_POT').map((m) => ({ label: `Circle board: ${m.group.name}`, icon: <IconUsers size={18} />, href: `/dashboard/my-thrift/${m.membershipId}/board` })),
              { label: 'Payout Account', icon: <IconBuildingBank size={18} />, href: '/dashboard/my-thrift/payout-account' },
              { label: 'Circle notifications', icon: <IconBell size={18} />, href: '/dashboard/my-thrift/notifications' },
            ],
          },
        ]
      : []),
    ...pick('Thrift Circles', 'Payments', 'Collect', 'Thrift Reports'),
    ...(ajoNav.staff ? [{ label: 'People', icon: <IconUsers size={20} />, href: '/dashboard/members' }] : []),
    ...pick('My Profile', 'Notifications', 'Help & Support', 'Settings'),
  ];

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/member';
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
              title={item.label}
              aria-label={item.label}
              onClick={() => { toggleExpanded(item.label); if (railNow()) setIsOpen(true); }}
              className={`
                w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg sl-rail-item
                transition-all duration-200 group bg-transparent
                ${active
                  ? 'bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400'
                  : 'text-gray-800 dark:text-white hover:text-teal-600 dark:hover:text-teal-400'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span className="sl-rail-hide font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="sl-rail-hide text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {item.badge}
                  </span>
                )}
                <IconChevronDown
                  size={16}
                  className={`sl-rail-hide transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {isExpanded && item.children && (
              <div className="sl-rail-hide ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
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
            aria-label={item.label}
            title={item.label}
            href={item.href || '#'}
            onClick={() => setIsOpen(false)}
            className={`
              flex items-center justify-between gap-3 px-4 py-3 rounded-lg sl-rail-item
              transition-all duration-200 group bg-transparent
              ${active
                ? 'bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400'
                : 'text-gray-800 dark:text-white hover:text-teal-600 dark:hover:text-teal-400'
              }
            `}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="sl-rail-hide font-medium">{item.label}</span>
            </div>
            {item.badge && (
              <span className="sl-rail-hide text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
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
        ref={toggleRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="app-sidebar"
        className="lg:hidden fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50 flex h-11 w-11 items-center justify-center rounded-lg glass-strong border border-gray-200/50 dark:border-gray-700/50"
      >
        {isOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={asideRef}
        id="app-sidebar"
        data-open={isOpen}
        aria-label="Main navigation"
        className={`
          fixed top-0 left-0 h-screen h-dvh w-72 glass-strong border-r border-gray-200/50 dark:border-gray-700/50 
          z-[45] transition-[transform,visibility] duration-300 flex flex-col [@media(max-height:480px)]:overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)] lg:pb-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full invisible md:max-lg:visible md:max-lg:translate-x-0 lg:visible lg:translate-x-0'}
        `}
      >
        {/* Logo/Brand */}
        <div className="p-6 pt-[calc(4.5rem+env(safe-area-inset-top))] lg:pt-6 border-b border-gray-200/50 dark:border-gray-700/50">
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
              <BrandMark size={40} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
            )}
            <div className="sl-rail-hide min-w-0">
              <span title={user?.association?.name || undefined} className="line-clamp-2 break-words text-lg font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                {user?.association?.name || 'SocietyLedger'}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {thriftWord('Member Portal', ajoNav.thriftOnly)}
              </p>
            </div>
          </Link>
        </div>

        {/* User Info */}
        {user && user.email && (
          <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <SidebarAvatar email={user.email} />
              <div className="sl-rail-hide flex-1 min-w-0">
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
        <nav className="flex-1 overflow-y-auto [@media(max-height:480px)]:flex-none [@media(max-height:480px)]:overflow-visible p-4 space-y-1">
          {(ajoNav.thriftOnly ? thriftItems : navItems).map(renderNavItem)}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2 bg-white/50 dark:bg-gray-900/50">
          <a
            href={docsUrl('/docs/member-guide', 'web_sidebar')}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg sl-rail-item text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200"
          >
            <span className="flex items-center gap-3 font-medium">
              <IconBook2 size={20} />
              <span className="sl-rail-hide">User manual</span>
            </span>
            <IconExternalLink size={16} className="sl-rail-hide" />
          </a>

          <div className="flex items-center justify-between">
            <span className="sl-rail-hide text-sm text-gray-600 dark:text-gray-400">Theme</span>
            <ThemeToggle />
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 sl-rail-item rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 font-medium"
          >
            <IconLogout size={20} />
            <span className="sl-rail-hide">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
