'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconBuilding, IconArrowLeft } from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { useSuperAdminContext } from '@/hooks/useSuperAdminContext';
import { TenantSelector } from './TenantSelector';

interface SuperAdminDashboardGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component for dashboard pages that require association context.
 * For Super Admins without a selected association, shows a tenant selector.
 * For regular users, renders children directly.
 */
export function SuperAdminDashboardGuard({ children }: SuperAdminDashboardGuardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedAssociation, setSelectedAssociation, clearSelectedAssociation } = useSuperAdminContext();
  const [showSelector, setShowSelector] = useState(false);

  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const hasAssociationContext = !!user?.associationId || !!selectedAssociation;

  // For Super Admins without association context, show selector prompt
  if (isSuperAdmin && !hasAssociationContext) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto">
              <IconBuilding size={32} className="text-teal-600 dark:text-teal-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select an Association
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              As a Super Admin, you need to select an association to view their dashboard and financial data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={() => setShowSelector(true)}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Select Association
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <IconArrowLeft size={16} />
                Back to Admin
              </button>
            </div>
          </div>
        </div>

        <TenantSelector
          opened={showSelector}
          onClose={() => setShowSelector(false)}
          onSelect={(association) => {
            // Set the association in Zustand store
            setSelectedAssociation({
              id: association.id,
              name: association.name,
              subdomain: association.subdomain,
            });
            setShowSelector(false);
            
            // Also write directly to localStorage to ensure it's available immediately
            // Zustand persist is async and might not complete before reload
            const storageData = {
              state: {
                selectedAssociation: {
                  id: association.id,
                  name: association.name,
                  subdomain: association.subdomain,
                }
              },
              version: 0
            };
            localStorage.setItem('super-admin-context', JSON.stringify(storageData));
            
            // Small delay to ensure localStorage is written
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }}
        />
      </>
    );
  }

  // Render children for regular users or Super Admins with context
  return <>{children}</>;
}

/**
 * Banner component showing the currently selected association for Super Admins
 */
export function SuperAdminContextBanner() {
  const { user } = useAuthStore();
  const { selectedAssociation, clearSelectedAssociation } = useSuperAdminContext();
  const [showSelector, setShowSelector] = useState(false);

  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';

  if (!isSuperAdmin || !selectedAssociation) {
    return null;
  }

  return (
    <>
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            <IconBuilding size={16} className="text-amber-600" />
            <span className="text-amber-800 dark:text-amber-200">
              Viewing as: <strong>{selectedAssociation.name}</strong>
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              ({selectedAssociation.subdomain})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSelector(true)}
              className="text-xs px-2 py-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors"
            >
              Switch
            </button>
            <button
              onClick={() => {
                clearSelectedAssociation();
                window.location.href = '/admin';
              }}
              className="text-xs px-2 py-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      <TenantSelector
        opened={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={(association) => {
          // Write directly to localStorage for immediate availability
          const storageData = {
            state: {
              selectedAssociation: {
                id: association.id,
                name: association.name,
                subdomain: association.subdomain,
              }
            },
            version: 0
          };
          localStorage.setItem('super-admin-context', JSON.stringify(storageData));
          setShowSelector(false);
          
          // Small delay to ensure localStorage is written
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }}
      />
    </>
  );
}

export default SuperAdminDashboardGuard;
