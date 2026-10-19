'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

function ImpersonateContent() {
  const searchParams = useSearchParams();
  const { startImpersonation } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('Missing impersonation code.');
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/auth/impersonation/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Exchange failed');
        startImpersonation(data.data.token, data.data.association);
        // A full navigation, not router.replace(): this is a brand-new tab with
        // nothing worth preserving from client router state, and critically,
        // Next's App Router can serve a stale prefetched/cached response for
        // '/dashboard' fetched before the token cookie existed — the server
        // middleware (middleware.ts) would then see no cookie and bounce to
        // /auth/login even though startImpersonation() just set it correctly.
        // A hard navigation guarantees the middleware re-checks with the
        // current cookie jar.
        window.location.href = '/dashboard';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete impersonation.');
      }
    })();
  }, [searchParams, startImpersonation]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Impersonation Failed</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto" />
        <p className="text-gray-600 dark:text-gray-400">Starting impersonation session…</p>
      </div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    }>
      <ImpersonateContent />
    </Suspense>
  );
}
