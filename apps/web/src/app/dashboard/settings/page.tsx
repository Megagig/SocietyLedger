'use client';

import { useRouter } from 'next/navigation';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { 
  Shield, Users, Settings, Building, CreditCard, 
  Bell, Palette, ChevronRight, Lock
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
    title: 'Association Profile',
    description: 'Update your association details, logo, and branding',
    icon: <Building className="w-6 h-6" />,
    href: '/dashboard/settings/profile',
    comingSoon: true
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
    comingSoon: true
  },
  {
    title: 'Appearance',
    description: 'Customize colors, themes, and display preferences',
    icon: <Palette className="w-6 h-6" />,
    href: '/dashboard/settings/appearance',
    comingSoon: true
  },
  {
    title: 'Security',
    description: 'Password policies, two-factor authentication, and audit logs',
    icon: <Lock className="w-6 h-6" />,
    href: '/dashboard/settings/security',
    comingSoon: true
  },
  {
    title: 'General Settings',
    description: 'Fiscal year, currency, timezone, and other preferences',
    icon: <Settings className="w-6 h-6" />,
    href: '/dashboard/settings/general',
    comingSoon: true
  }
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Association Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your association's preferences and settings
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCards.map((card, index) => {
          const CardContent = (
            <div
              key={index}
              onClick={() => !card.comingSoon && router.push(card.href)}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-all ${
                card.comingSoon 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'hover:shadow-lg hover:border-teal-500 cursor-pointer'
              } border border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-green-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
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
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {card.description}
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
