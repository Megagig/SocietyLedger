'use client';

import { useState, useEffect } from 'react';
import { IconDownload, IconX, IconDeviceMobile } from '@tabler/icons-react';
import { usePWA } from '@/hooks/usePWA';

export function InstallPrompt() {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check if user has dismissed the prompt before
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    const success = await installApp();
    setIsInstalling(false);
    if (success) {
      setIsDismissed(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if not installable, already installed, or dismissed
  if (!isInstallable || isInstalled || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 lg:bottom-4 lg:left-auto lg:right-4 lg:w-96 animate-slide-up">
      <div className="bg-gradient-to-r from-teal-500 to-green-500 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <IconDeviceMobile size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install SocietyLedger</h3>
            <p className="text-xs text-white/80 mt-0.5">
              Add to your home screen for quick access and offline support
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-3 py-2 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex-1 px-3 py-2 text-sm font-medium bg-white text-teal-600 hover:bg-white/90 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isInstalling ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <IconDownload size={16} />
            )}
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
