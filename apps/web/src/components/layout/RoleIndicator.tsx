'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { IconUser, IconShield } from '@tabler/icons-react';

export function RoleIndicator() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Don't show on super admin routes
  if (pathname.startsWith('/admin')) {
    return null;
  }

  // Determine current context
  const isMemberContext = pathname.startsWith('/dashboard/member');
  const isAdminContext = pathname.startsWith('/dashboard/admin') || 
    (pathname.startsWith('/dashboard') && !isMemberContext);

  // Only show for admins who can switch contexts
  const isAdmin = user?.role === 'admin' || user?.role === 'treasurer' || user?.role === 'financial_secretary';
  
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-30 hidden lg:block">
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium
        ${isMemberContext 
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
        }
      `}>
        {isMemberContext ? (
          <>
            <IconUser size={16} />
            <span>Member View</span>
          </>
        ) : (
          <>
            <IconShield size={16} />
            <span>Admin View</span>
          </>
        )}
      </div>
    </div>
  );
}
