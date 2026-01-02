'use client';

import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

/**
 * Context Indicator Component
 * 
 * Phase 22: Shows visual indicator for Super Admin context:
 * - Amber banner when impersonating another association
 * - Blue subtle indicator for Platform Admin mode
 * 
 * Only visible to Super Admins.
 */
export function ContextIndicator() {
  const router = useRouter();
  const { 
    user, 
    isImpersonating, 
    impersonatedAssociation, 
    endImpersonation 
  } = useAuthStore();

  // Only show for Super Admins
  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  const handleEndImpersonation = async () => {
    const success = await endImpersonation();
    if (success) {
      // Redirect to admin dashboard after ending impersonation
      router.push('/admin');
    }
  };

  // Impersonation mode - prominent amber banner
  if (isImpersonating && impersonatedAssociation) {
    return (
      <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="animate-pulse text-lg">⚠️</span>
          <span>
            Impersonating: <strong className="font-semibold">{impersonatedAssociation.name}</strong>
            <span className="ml-2 text-amber-100 text-xs">
              ({impersonatedAssociation.subdomain})
            </span>
          </span>
        </div>
        <button
          onClick={handleEndImpersonation}
          className="bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded text-xs font-medium transition-colors"
        >
          End Impersonation
        </button>
      </div>
    );
  }

  // Platform Admin mode - subtle blue indicator (optional, can be hidden)
  // Uncomment below if you want to show a subtle indicator when not impersonating
  /*
  return (
    <div className="bg-blue-600 text-white px-4 py-1 text-xs flex items-center gap-2">
      <span>🔧</span>
      <span>Platform Admin Mode</span>
    </div>
  );
  */

  return null;
}
