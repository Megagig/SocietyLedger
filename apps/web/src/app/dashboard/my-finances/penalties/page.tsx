'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@mantine/core';
import { IconBadge, IconCurrencyNaira, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface PenaltyItem {
  id: number;
  referenceNumber: string;
  category: { id: number; name: string; type: string };
  amount: number;
  paid: number;
  balance: number;
  reason?: string;
  status: string;
  payments: any[];
  createdAt: string;
}

export default function MyPenaltiesPage() {
  const router = useRouter();
  const [penalties, setPenalties] = useState<PenaltyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchPenalties(); }, []);

  const fetchPenalties = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/penalties`);
      if (!response.ok) throw new Error('Failed to fetch penalties');
      const result = await response.json();
      setPenalties(result.data.penalties || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

  const totalOutstanding = penalties.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.balance, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading penalties...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Penalties
          </h1>
          <p className="text-gray-600 dark:text-gray-400">View and pay any penalties on your account</p>
        </div>
        {totalOutstanding > 0 && (
          <Button onClick={() => router.push('/dashboard/my-finances/pay')} color="red" leftSection={<IconCurrencyNaira size={16} />}>
            Pay {formatCurrency(totalOutstanding)}
          </Button>
        )}
      </div>

      {/* Summary Card */}
      {totalOutstanding > 0 ? (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100">Outstanding Penalties</p>
              <p className="text-4xl font-bold mt-2">{formatCurrency(totalOutstanding)}</p>
              <p className="text-red-100 mt-1">{penalties.filter(p => p.status !== 'paid').length} unpaid penalty(ies)</p>
            </div>
            <div className="p-4 bg-white/20 rounded-full">
              <IconAlertTriangle size={40} />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Account Status</p>
              <p className="text-2xl font-bold mt-2">No Outstanding Penalties</p>
              <p className="text-green-100 mt-1">Your account is in good standing</p>
            </div>
            <div className="p-4 bg-white/20 rounded-full">
              <IconCheck size={40} />
            </div>
          </div>
        </div>
      )}

      {/* Penalties List */}
      {penalties.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Penalties</h3>
          <p className="text-gray-500">You have no penalties on your account. Keep up the good work!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {penalties.map((penalty) => (
            <div key={penalty.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${penalty.status === 'paid' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <IconBadge className={penalty.status === 'paid' ? 'text-green-600' : 'text-red-600'} size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{penalty.category.name}</h3>
                    {penalty.reason && (
                      <p className="text-sm text-gray-500">Reason: {penalty.reason}</p>
                    )}
                    <p className="text-sm text-gray-500">Applied: {formatDate(penalty.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge color={penalty.status === 'paid' ? 'green' : 'red'}>
                    {penalty.status.toUpperCase()}
                  </Badge>
                  <p className="text-xl font-bold mt-2 text-gray-900 dark:text-white">
                    {formatCurrency(penalty.status === 'paid' ? penalty.amount : penalty.balance)}
                  </p>
                </div>
              </div>
              {penalty.status !== 'paid' && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <Button size="sm" color="red" onClick={() => router.push(`/dashboard/my-finances/pay?transactionId=${penalty.id}`)}>
                    Pay Penalty
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
