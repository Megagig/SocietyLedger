'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

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
      
      {/* Main Content - No secondary sidebar */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}