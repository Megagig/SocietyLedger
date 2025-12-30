'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  isLoading: boolean;
}

interface UsePWAReturn extends PWAState {
  installApp: () => Promise<boolean>;
  updateApp: () => void;
  checkForUpdates: () => Promise<void>;
}

export function usePWA(): UsePWAReturn {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isUpdateAvailable: false,
    isLoading: true,
  });

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if app is installed
  const checkInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Check display-mode media query
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Check iOS standalone mode
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    // Check if launched from home screen (Android)
    const isAndroidTWA = document.referrer.includes('android-app://');
    
    return isStandalone || isIOSStandalone || isAndroidTWA;
  }, []);

  // Install the app
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Install error:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Update the app (skip waiting)
  const updateApp = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setState(prev => ({ ...prev, isUpdateAvailable: false }));
      window.location.reload();
    }
  }, [registration]);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (registration) {
      try {
        await registration.update();
        console.log('[PWA] Checked for updates');
      } catch (error) {
        console.error('[PWA] Update check failed:', error);
      }
    }
  }, [registration]);

  // Initialize PWA
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check initial installed state
    setState(prev => ({
      ...prev,
      isInstalled: checkInstalled(),
      isLoading: false,
    }));

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] Install prompt captured');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState(prev => ({ ...prev, isInstallable: true }));
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      console.log('[PWA] App installed');
      setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      setDeferredPrompt(null);
    };

    // Listen for online/offline
    const handleOnline = () => {
      console.log('[PWA] Online');
      setState(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      console.log('[PWA] Offline');
      setState(prev => ({ ...prev, isOnline: false }));
    };

    // Register service worker
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          
          console.log('[PWA] Service worker registered:', reg.scope);
          setRegistration(reg);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Update available');
                  setState(prev => ({ ...prev, isUpdateAvailable: true }));
                }
              });
            }
          });

          // Handle controller change (after update)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[PWA] Controller changed, reloading...');
          });

        } catch (error) {
          console.error('[PWA] Service worker registration failed:', error);
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    registerServiceWorker();

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkInstalled]);

  return {
    ...state,
    installApp,
    updateApp,
    checkForUpdates,
  };
}

// Hook for push notifications
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check support
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('[Push] Permission request failed:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (vapidPublicKey: string): Promise<PushSubscription | null> => {
    if (!isSupported || permission !== 'granted') return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      setSubscription(sub);
      console.log('[Push] Subscribed:', sub.endpoint);
      return sub;
    } catch (error) {
      console.error('[Push] Subscription failed:', error);
      return null;
    }
  }, [isSupported, permission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      console.log('[Push] Unsubscribed');
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error);
      return false;
    }
  }, [subscription]);

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Hook for offline data sync
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const addPendingRequest = useCallback(async (request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  }) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    try {
      const db = await openDatabase();
      const transaction = db.transaction('pending-requests', 'readwrite');
      const store = transaction.objectStore('pending-requests');
      
      await new Promise<void>((resolve, reject) => {
        const req = store.add({
          ...request,
          timestamp: Date.now(),
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      setPendingCount(prev => prev + 1);
      
      // Request background sync
      if ('serviceWorker' in navigator && 'sync' in (navigator.serviceWorker as any)) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-pending-data');
      }
    } catch (error) {
      console.error('[Offline] Failed to add pending request:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;

    setIsSyncing(true);
    try {
      // Trigger sync via service worker message
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'SYNC_NOW' });
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Load pending count on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    const loadPendingCount = async () => {
      try {
        const db = await openDatabase();
        const transaction = db.transaction('pending-requests', 'readonly');
        const store = transaction.objectStore('pending-requests');
        
        const count = await new Promise<number>((resolve, reject) => {
          const req = store.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        setPendingCount(count);
      } catch (error) {
        console.error('[Offline] Failed to load pending count:', error);
      }
    };

    loadPendingCount();
  }, []);

  return {
    pendingCount,
    isSyncing,
    addPendingRequest,
    syncNow,
  };
}

// IndexedDB helper
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('societyledger-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pending-requests')) {
        db.createObjectStore('pending-requests', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}
