'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { IconChevronRight, IconHome } from '@tabler/icons-react';
import { useGroupDetail } from '@/lib/ajo/staffHooks';
import { PATHS_WITHOUT_A_PAGE } from '@/lib/breadcrumb-paths';

/** Words for the Thrift pages, so the trail reads "Thrift circles" and never a bare "Ajo" or a database number. */
const LABELS: Record<string, string> = { ajo: 'Thrift circles', 'my-thrift': 'My thrift', collect: 'Collect', 'payout-account': 'Payout account' };

export function Breadcrumbs() {
  const pathname = usePathname();
  // A circle's own page: its number in the address is shown as its name.
  const circleId = Number(/^\/dashboard\/ajo\/(\d+)(\/|$)/.exec(pathname)?.[1] ?? 0);
  const circle = useGroupDetail(circleId).data;

  // Don't show breadcrumbs on home/dashboard root or member dashboard
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/member') {
    return null;
  }

  // Split path and filter empty segments
  const segments = pathname.split('/').filter(Boolean);

  // Generate breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isNumber = /^\d+$/.test(segment);
    const previous = segments[index - 1];
    const label = isNumber
      ? previous === 'ajo' ? (circle?.name ?? 'Circle') : previous === 'my-thrift' ? 'My circle' : segment
      : (LABELS[segment] ?? segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '));

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
    <nav className="flex flex-wrap items-center gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
      {allBreadcrumbs.map((crumb, index) => (
        <div key={`${crumb.href}-${index}`} className="flex items-center">
          {index > 0 && (
            <IconChevronRight size={16} className="mx-2 text-gray-400" />
          )}
          {crumb.isLast ? (
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {crumb.label}
            </span>
          ) : PATHS_WITHOUT_A_PAGE.has(crumb.href) ? (
            <span>{crumb.label}</span>
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
