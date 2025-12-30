'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  Building,
  Users,
  Shield,
  CreditCard,
  Bell,
  Plug,
  Lock,
  FileText,
  Settings,
  ChevronRight,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
  description?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Association Profile',
    href: '/dashboard/settings/association',
    icon: <Building className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_VIEW,
    description: 'Name, logo, branding'
  },
  {
    label: 'Roles & Permissions',
    href: '/dashboard/settings/roles',
    icon: <Shield className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_VIEW,
    description: 'Manage user roles'
  },
  {
    label: 'User Management',
    href: '/dashboard/settings/users',
    icon: <Users className="w-5 h-5" />,
    permission: PERMISSIONS.MEMBER_VIEW_ALL,
    description: 'Assign roles to users'
  },
  {
    label: 'Members Access',
    href: '/dashboard/settings/members-access',
    icon: <Lock className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_EDIT,
    description: 'Signup & approval rules'
  },
  {
    label: 'Financial Settings',
    href: '/dashboard/settings/financial',
    icon: <CreditCard className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_EDIT,
    description: 'Penalties, grace periods'
  },
  {
    label: 'Payments & Billing',
    href: '/dashboard/settings/payments',
    icon: <CreditCard className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_BILLING,
    description: 'Payment channels, subscription'
  },
  {
    label: 'Notifications',
    href: '/dashboard/settings/notifications',
    icon: <Bell className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_EDIT,
    description: 'Email, SMS preferences'
  },
  {
    label: 'Integrations',
    href: '/dashboard/settings/integrations',
    icon: <Plug className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_INTEGRATIONS,
    description: 'External services'
  },
  {
    label: 'Help Content',
    href: '/dashboard/settings/help-content',
    icon: <HelpCircle className="w-5 h-5" />,
    permission: PERMISSIONS.HELP_MANAGE,
    description: 'Articles & FAQs'
  },
  {
    label: 'Support Tickets',
    href: '/dashboard/settings/support',
    icon: <MessageSquare className="w-5 h-5" />,
    permission: PERMISSIONS.SUPPORT_MANAGE,
    description: 'Manage member tickets'
  },
  {
    label: 'Data & Privacy',
    href: '/dashboard/settings/data-privacy',
    icon: <Lock className="w-5 h-5" />,
    permission: PERMISSIONS.SETTINGS_EDIT,
    description: 'Data retention, export'
  },
  {
    label: 'Audit Logs',
    href: '/dashboard/settings/audit-logs',
    icon: <FileText className="w-5 h-5" />,
    permission: PERMISSIONS.AUDIT_VIEW,
    description: 'Activity history'
  }
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        
        const NavLink = (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive
                ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-l-4 border-teal-500'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span className={isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'}>
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{item.label}</div>
              {item.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {item.description}
                </div>
              )}
            </div>
            {isActive && <ChevronRight className="w-4 h-4 text-teal-500" />}
          </Link>
        );

        if (item.permission) {
          return (
            <Can key={item.href} permission={item.permission as any} fallback={null}>
              {NavLink}
            </Can>
          );
        }

        return NavLink;
      })}
    </nav>
  );
}

export function SettingsNavMobile() {
  const pathname = usePathname();
  const currentItem = navItems.find(item => 
    pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <div className="lg:hidden mb-4">
      <select
        value={currentItem?.href || '/dashboard/settings'}
        onChange={(e) => window.location.href = e.target.value}
        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
      >
        <option value="/dashboard/settings">Settings Overview</option>
        {navItems.map((item) => (
          <option key={item.href} value={item.href}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
