'use client';

import { useState, useEffect } from 'react';
import { IconWifi, IconWifiOff, IconRefresh } from '@tabler/icons-react';
import { usePWA } from '@/hooks/usePWA';
import { useOfflineSync } from '@/hooks/usePWA';

export function OfflineIndicator() {
  const { isOnline } = usePWA();
  const { pendingCount, isSyncing, syncNow } = useOfflineSync();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show reconnected message
  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
        <div className="bg-green-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <IconWifi size={18} />
            <span className="text-sm font-medium">Back online!</span>
            {pendingCount > 0 && (
              <button
                onClick={syncNow}
                disabled={isSyncing}
                className="ml-2 px-2 py-0.5 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors flex items-center gap-1"
              >
                <IconRefresh size={14} className={isSyncing ? 'animate-spin' : ''} />
                Sync {pendingCount} pending
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show offline indicator
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-amber-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <IconWifiOff size={18} />
            <span className="text-sm font-medium">
              You're offline. Some features may be limited.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
