'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Loader } from '@mantine/core';

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth();
      setIsChecking(false);
    };

    verifyAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isChecking && !isAuthenticated && !isLoading) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, isChecking, router, pathname]);

  // Onboarding redirect for association admins who haven't completed onboarding
  useEffect(() => {
    if (!isChecking && isAuthenticated && user) {
      // Skip if already on onboarding pages
      if (pathname.startsWith('/onboarding')) return;
      
      // Super admin should use /admin routes, not /dashboard
      if (user.platformRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard')) {
        router.push('/admin');
        return;
      }
      
      // Redirect admins who haven't completed onboarding (exclude super admins)
      if (user.role === 'admin' && user.requiresOnboarding && !user.platformRole) {
        router.push('/onboarding');
      }
    }
  }, [isChecking, isAuthenticated, user, pathname, router]);

  if (isChecking || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <Loader size="lg" color="teal" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Sidebar />
      <main className="flex-1 lg:ml-72 min-h-screen">
        {/* Top Bar with Notification Bell */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-end">
            <NotificationBell />
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
