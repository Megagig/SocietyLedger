'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { IconChevronRight, IconHome } from '@tabler/icons-react';

export function Breadcrumbs() {
  const pathname = usePathname();

  // Don't show breadcrumbs on home/dashboard root or member dashboard
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/member') {
    return null;
  }

  // Split path and filter empty segments
  const segments = pathname.split('/').filter(Boolean);

  // Generate breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      label,
      href,
      isLast: index === segments.length - 1,
    };
  });

  // Add home breadcrumb
  const allBreadcrumbs = [
    { label: 'Home', href: '/dashboard', isLast: false },
    ...breadcrumbs,
  ];

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
      {allBreadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && (
            <IconChevronRight size={16} className="mx-2 text-gray-400" />
          )}
          {crumb.isLast ? (
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              {index === 0 ? (
                <IconHome size={16} className="inline" />
              ) : (
                crumb.label
              )}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
