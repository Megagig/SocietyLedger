'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/finance/overview');
  }, [router]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <div className="text-gray-600 dark:text-gray-400">Redirecting to Finance Overview...</div>
    </div>
  );
}
