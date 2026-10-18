'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconLayoutDashboard,
  IconUsers,
  IconCurrencyNaira,
  IconBell,
  IconMenu2,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  permission?: string;
  badge?: number;
}

interface BottomNavProps {
  onMenuClick?: () => void;
  notificationCount?: number;
}

export function BottomNav({ onMenuClick, notificationCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const checkPermission = (permission?: string): boolean => {
    if (!permission) return true;
    const userPermissions = user?.permissions || [];
    return hasPermission(userPermissions, permission as any);
  };

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: <IconLayoutDashboard size={24} />,
      href: user?.role === 'admin' || user?.role === 'treasurer' || user?.role === 'financial_secretary' 
        ? '/dashboard' 
        : '/dashboard/member',
    },
    {
      label: 'Members',
      icon: <IconUsers size={24} />,
      href: '/dashboard/members',
      permission: PERMISSIONS.MEMBER_VIEW,
    },
    {
      label: 'Finance',
      icon: <IconCurrencyNaira size={24} />,
      href: user?.role === 'admin' || user?.role === 'treasurer' || user?.role === 'financial_secretary'
        ? '/dashboard/finance/overview'
        : '/dashboard/my-finances',
    },
    {
      label: 'Alerts',
      icon: <IconBell size={24} />,
      href: '/dashboard/notifications',
      badge: notificationCount,
    },
    {
      label: 'Menu',
      icon: <IconMenu2 size={24} />,
      href: '#menu',
    },
  ];

  const isActive = (href: string) => {
    if (href === '#menu') return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.href === '#menu') {
      e.preventDefault();
      onMenuClick?.();
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Safe area padding for iOS */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            if (!checkPermission(item.permission)) return null;

            const active = isActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={(e) => handleClick(e, item)}
                className={`
                  flex flex-col items-center justify-center flex-1 h-full
                  transition-colors duration-200 relative
                  ${active
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1 font-medium">{item.label}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
