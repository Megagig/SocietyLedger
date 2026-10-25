'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MemberSidebar } from '@/components/layout/MemberSidebar';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { RoleIndicator } from '@/components/layout/RoleIndicator';
import { ContextIndicator } from '@/components/layout/ContextIndicator';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BottomNav, InstallPrompt, UpdatePrompt, OfflineIndicator } from '@/components/mobile';
import { ModuleLockedModal } from '@/components/layout/ModuleLockedModal';
import { SubscriptionBlockedScreen, TrialEndingBanner } from '@/components/subscription/SubscriptionBanners';
import { Loader } from '@mantine/core';

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, user, _hasHydrated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Zustand's persist middleware rehydrates auth-storage from localStorage
    // asynchronously — on a fresh page load (e.g. a hard navigation right
    // after impersonation sets the store), this effect can otherwise fire
    // while `token` is still at its pre-hydration default of null, call
    // checkAuth() with that null, and have its early-exit
    // set({isAuthenticated: false}) stomp the real state once hydration
    // finishes a moment later. Waiting for _hasHydrated avoids the race.
    if (!_hasHydrated) return;

    const verifyAuth = async () => {
      await checkAuth();
      setIsChecking(false);
    };

    verifyAuth();
  }, [checkAuth, _hasHydrated]);

  useEffect(() => {
    if (_hasHydrated && !isChecking && !isAuthenticated && !isLoading) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, isChecking, _hasHydrated, router, pathname]);

  // Onboarding redirect for association admins who haven't completed onboarding
  useEffect(() => {
    if (!isChecking && isAuthenticated && user) {
      // Skip if already on onboarding pages
      if (pathname.startsWith('/onboarding')) return;

      // A blocked association has to renew before anything else
      if (user.subscriptionAccess && !user.subscriptionAccess.allowed) return;
      
      // Redirect admins who haven't completed onboarding (exclude super admins)
      if (user.role === 'admin' && user.requiresOnboarding && !user.platformRole) {
        router.push('/onboarding');
      }
    }
  }, [isChecking, isAuthenticated, user, pathname, router]);

  if (!_hasHydrated || isChecking || isLoading) {
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

  // Trial or subscription ended: everything is paused except the billing pages, where officers renew.
  if (user && !user.platformRole && user.subscriptionAccess && !user.subscriptionAccess.allowed && !pathname.startsWith('/dashboard/subscription')) {
    return <SubscriptionBlockedScreen />;
  }

  // Determine which sidebar to show based on route
  const renderSidebar = () => {
    // Member routes → MemberSidebar
    if (pathname.startsWith('/dashboard/member')) {
      return <MemberSidebar />;
    }
    
    // Admin routes → AdminSidebar (dual-section)
    if (pathname.startsWith('/dashboard/admin')) {
      return <AdminSidebar />;
    }

    // Default dashboard routes → Use AdminSidebar for admins, MemberSidebar for members
    if (pathname.startsWith('/dashboard')) {
      // Check user role
      if (user?.role === 'admin' || user?.role === 'treasurer' || user?.role === 'financial_secretary') {
        return <AdminSidebar />;
      }
      return <MemberSidebar />;
    }
    
    // Fallback to existing Sidebar
    return <Sidebar />;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* PWA Status Indicators */}
      <OfflineIndicator />
      <UpdatePrompt />
      
      {renderSidebar()}
      <main className="flex-1 lg:ml-72 min-h-screen">
        {/* Phase 22: Context Indicator for impersonation */}
        <ContextIndicator />
        
        {/* Phase 23: Role Indicator Badge */}
        <RoleIndicator />
        
        {/* Top Bar with Notification Bell */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-end">
            <NotificationBell />
          </div>
        </div>
        <div className="p-4 sm:p-5 lg:p-6 mb-bottom-nav">
          <TrialEndingBanner />
          <Breadcrumbs />
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <BottomNav 
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        notificationCount={0}
      />
      
      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* G13: module/feature upgrade prompt, triggered from lib/axios.ts / utils/api.ts */}
      <ModuleLockedModal />
    </div>
  );
}
