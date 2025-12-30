'use client';

import { IconRefresh, IconX } from '@tabler/icons-react';
import { usePWA } from '@/hooks/usePWA';

export function UpdatePrompt() {
  const { isUpdateAvailable, updateApp } = usePWA();

  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconRefresh size={20} className="animate-spin-slow" />
            <p className="text-sm font-medium">
              A new version is available!
            </p>
          </div>
          <button
            onClick={updateApp}
            className="px-4 py-1.5 text-sm font-medium bg-white text-blue-600 hover:bg-white/90 rounded-lg transition-colors"
          >
            Update now
          </button>
        </div>
      </div>
    </div>
  );
}
