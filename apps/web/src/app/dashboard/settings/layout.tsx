'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Settings } from 'lucide-react';
import { SettingsNav, SettingsNavMobile } from '@/components/settings/SettingsNav';

const breadcrumbMap: Record<string, string> = {
  '/dashboard/settings': 'Settings',
  '/dashboard/settings/association': 'Association Profile',
  '/dashboard/settings/roles': 'Roles & Permissions',
  '/dashboard/settings/users': 'User Management',
  '/dashboard/settings/members-access': 'Members Access',
  '/dashboard/settings/financial': 'Financial Settings',
  '/dashboard/settings/payments': 'Payments & Billing',
  '/dashboard/settings/notifications': 'Notifications',
  '/dashboard/settings/integrations': 'Integrations',
  '/dashboard/settings/data-privacy': 'Data & Privacy',
  '/dashboard/settings/audit-logs': 'Audit Logs',
  '/dashboard/settings/profile': 'Association Profile',
  '/dashboard/settings/appearance': 'Appearance',
  '/dashboard/settings/security': 'Security',
  '/dashboard/settings/general': 'General Settings',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === '/dashboard/settings';
  
  // Build breadcrumb trail
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; href: string }> = [];
  
  let currentPath = '';
  for (const segment of pathSegments) {
    currentPath += `/${segment}`;
    if (breadcrumbMap[currentPath]) {
      breadcrumbs.push({
        label: breadcrumbMap[currentPath],
        href: currentPath,
      });
    }
  }

  return (
    <div>
      {/* Breadcrumb Navigation */}
      {breadcrumbs.length > 1 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex items-center gap-2 text-sm">
            <Link 
              href="/dashboard" 
              className="text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
            >
              Dashboard
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 dark:text-white font-medium">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}
      
      {/* Settings Layout with Sidebar */}
      {isSettingsRoot ? (
        // Settings overview page - full width
        children
      ) : (
        // Settings sub-pages - with sidebar
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-200px)]">
          {/* Sidebar Navigation - Desktop */}
          <aside className="hidden lg:block w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-4">
            <div className="sticky top-4">
              <Link 
                href="/dashboard/settings"
                className="flex items-center gap-2 px-3 py-2 mb-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <Settings className="w-4 h-4" />
                All Settings
              </Link>
              <SettingsNav />
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 p-6">
            {/* Mobile Navigation */}
            <SettingsNavMobile />
            {children}
          </main>
        </div>
      )}
    </div>
  );
}