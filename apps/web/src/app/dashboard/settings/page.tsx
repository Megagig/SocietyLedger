'use client';

import { useRouter } from 'next/navigation';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { useAjoNav } from '@/lib/ajo/useAjoNav';
import { THRIFT_SETTINGS_HREFS, thriftWord } from '@/lib/ajo/thriftScope';
import { 
  Shield, Users, Settings, Building, CreditCard, 
  Bell, ChevronRight, Lock, Plug, FileText
} from 'lucide-react';

interface SettingsCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  permission?: string;
  comingSoon?: boolean;
}

const settingsCards: SettingsCard[] = [
  {
    title: 'Association Profile',
    description: 'Update your association details, logo, and branding',
    icon: <Building className="w-6 h-6" />,
    href: '/dashboard/settings/association',
    permission: PERMISSIONS.SETTINGS_VIEW
  },
  {
    title: 'Roles & Permissions',
    description: 'Manage user roles and configure permissions for your association',
    icon: <Shield className="w-6 h-6" />,
    href: '/dashboard/settings/roles',
    permission: PERMISSIONS.SETTINGS_VIEW
  },
  {
    title: 'User Management',
    description: 'Assign roles to users and manage access levels',
    icon: <Users className="w-6 h-6" />,
    href: '/dashboard/settings/users',
    permission: PERMISSIONS.USER_VIEW
  },
  {
    title: 'Members Access',
    description: 'Configure member signup, approval, and access rules',
    icon: <Lock className="w-6 h-6" />,
    href: '/dashboard/settings/members-access',
    permission: PERMISSIONS.SETTINGS_EDIT
  },
  {
    title: 'Financial Settings',
    description: 'Configure currency, late fees, and payment rules',
    icon: <CreditCard className="w-6 h-6" />,
    href: '/dashboard/settings/financial',
    permission: PERMISSIONS.SETTINGS_EDIT
  },
  {
    title: 'Billing & Subscription',
    description: 'Manage your subscription plan and payment methods',
    icon: <CreditCard className="w-6 h-6" />,
    href: '/dashboard/subscription',
    permission: PERMISSIONS.SUBSCRIPTION_VIEW
  },
  {
    title: 'Notifications',
    description: 'Configure email and SMS notification preferences',
    icon: <Bell className="w-6 h-6" />,
    href: '/dashboard/settings/notifications',
    permission: PERMISSIONS.SETTINGS_EDIT
  },
  {
    title: 'Audit Logs',
    description: 'View activity history and changes in your association',
    icon: <FileText className="w-6 h-6" />,
    href: '/dashboard/settings/audit-logs',
    permission: PERMISSIONS.AUDIT_VIEW
  },
  {
    title: 'Integrations',
    description: 'Configure payment gateways and external services',
    icon: <Plug className="w-6 h-6" />,
    href: '/dashboard/settings/integrations',
    permission: PERMISSIONS.SETTINGS_INTEGRATIONS
  },
  {
    title: 'Data & Privacy',
    description: 'Data retention, export, and privacy settings',
    icon: <Lock className="w-6 h-6" />,
    href: '/dashboard/settings/data-privacy',
    permission: PERMISSIONS.SETTINGS_EDIT
  },
  {
    title: 'Payments & Billing',
    description: 'Configure payment channels and billing options',
    icon: <CreditCard className="w-6 h-6" />,
    href: '/dashboard/settings/payments',
    permission: PERMISSIONS.SETTINGS_BILLING
  }
];

export default function SettingsPage() {
  const router = useRouter();
  const { thriftOnly } = useAjoNav();
  // A standalone thrift group keeps only the settings it has, and says "group" where an association says "association".
  const cards = thriftOnly ? settingsCards.filter((c) => THRIFT_SETTINGS_HREFS.includes(c.href)) : settingsCards;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          {thriftOnly ? 'Group settings' : 'Association Settings'}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {thriftOnly ? 'Configure your group, its people and its plan.' : 'Configure your association&apos;s preferences and settings'}
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cards.map((card, index) => {
          const CardContent = (
            <div
              key={index}
              onClick={() => !card.comingSoon && router.push(card.href)}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-all ${
                card.comingSoon 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'hover:shadow-lg hover:border-teal-500 cursor-pointer'
              } border border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-green-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  {card.icon}
                </div>
                {card.comingSoon ? (
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                    Coming Soon
                  </span>
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {thriftWord(card.title, thriftOnly)}
              </h3>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {thriftOnly ? card.description.replace(/association/gi, 'group') : card.description}
              </p>
            </div>
          );

          // Wrap with permission check if needed
          if (card.permission && !card.comingSoon) {
            return (
              <Can key={index} permission={card.permission as any} fallback={null}>
                {CardContent}
              </Can>
            );
          }

          return CardContent;
        })}
      </div>
    </div>
  );
}
