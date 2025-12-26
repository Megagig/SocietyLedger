'use client';

import { EmptyState } from '@/components/EmptyState';
import { IconBuildingCommunity } from '@tabler/icons-react';

export default function AttendancePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Attendance Tracking
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track member attendance at meetings and events
        </p>
      </div>

      <EmptyState
        icon={<IconBuildingCommunity size={40} className="text-orange-500 dark:text-orange-400" />}
        title="Attendance Tracking Coming Soon"
        description="Record meeting attendance, track participation rates, generate attendance reports, and apply attendance-based penalties. Supports QR code check-ins, manual entry, and attendance analytics. Part of Phase 12.5: Meetings & Attendance."
        comingSoon
      />
    </div>
  );
}
