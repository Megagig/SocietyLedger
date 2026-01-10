'use client';

import { useAuthStore } from '@/store/authStore';
import { IconUser, IconMail, IconPhone, IconMapPin, IconCalendar } from '@tabler/icons-react';

export default function MyProfilePage() {
  const { user } = useAuthStore();

  return (
    <>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Profile
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View and manage your personal information
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center text-white text-3xl font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'M'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {user?.email?.split('@')[0] || 'Member'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 capitalize">
                {user?.role?.replace('_', ' ') || 'Member'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField
              icon={<IconMail size={20} />}
              label="Email Address"
              value={user?.email || 'Not provided'}
            />
            <InfoField
              icon={<IconPhone size={20} />}
              label="Phone Number"
              value="Not provided"
            />
            <InfoField
              icon={<IconMapPin size={20} />}
              label="Address"
              value="Not provided"
            />
            <InfoField
              icon={<IconCalendar size={20} />}
              label="Member Since"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField
              icon={<IconUser size={20} />}
              label="Contact Name"
              value="Not provided"
            />
            <InfoField
              icon={<IconPhone size={20} />}
              label="Contact Phone"
              value="Not provided"
            />
          </div>
        </div>

        {/* Account Settings */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Account Settings
          </h3>
          <div className="space-y-4">
            <button className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              Edit Profile
            </button>
            <button className="w-full sm:w-auto px-6 py-3 ml-0 sm:ml-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Change Password
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600 dark:text-teal-400">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-base font-medium text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}
