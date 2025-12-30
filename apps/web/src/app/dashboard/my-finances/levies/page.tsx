'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Progress, Button } from '@mantine/core';
import { IconWallet, IconCurrencyNaira, IconCheck, IconClock, IconTarget } from '@tabler/icons-react';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface LevyItem {
  id: number;
  campaign: { id: number; name: string; description?: string; targetAmount: number; deadline: string; status: string };
  amount: number;
  paid: number;
  balance: number;
  status: string;
  isOverdue: boolean;
  transactionId?: number;
  assignedAt: string;
}

export default function MyLeviesPage() {
  const router = useRouter();
  const [levies, setLevies] = useState<LevyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchLevies(); }, []);

  const fetchLevies = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/levies`);
      if (!response.ok) throw new Error('Failed to fetch levies');
      const result = await response.json();
      setLevies(result.data.levies || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'green';
      case 'partial': return 'yellow';
      case 'pending': return 'blue';
      default: return 'gray';
    }
  };

  const totalOutstanding = levies.filter(l => l.status !== 'paid').reduce((sum, l) => sum + l.balance, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your levies...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Levies
          </h1>
          <p className="text-gray-600 dark:text-gray-400">View and contribute to levy campaigns</p>
        </div>
        {totalOutstanding > 0 && (
          <Button onClick={() => router.push('/dashboard/my-finances/pay')} color="green" leftSection={<IconCurrencyNaira size={16} />}>
            Pay {formatCurrency(totalOutstanding)}
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100">Outstanding Levies</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(totalOutstanding)}</p>
            <p className="text-purple-100 mt-1">{levies.filter(l => l.status !== 'paid').length} active campaign(s)</p>
          </div>
          <div className="p-4 bg-white/20 rounded-full">
            <IconWallet size={40} />
          </div>
        </div>
      </div>

      {/* Levies List */}
      {levies.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Levies</h3>
          <p className="text-gray-500">You have no levy assignments at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {levies.map((levy) => (
            <div key={levy.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${levy.status === 'paid' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                    <IconTarget className={levy.status === 'paid' ? 'text-green-600' : 'text-purple-600'} size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{levy.campaign.name}</h3>
                    {levy.campaign.description && <p className="text-sm text-gray-500 mt-1">{levy.campaign.description}</p>}
                    <p className="text-sm text-gray-500 mt-1">Deadline: {formatDate(levy.campaign.deadline)}</p>
                  </div>
                </div>
                <Badge color={getStatusColor(levy.status)}>{levy.status.toUpperCase()}</Badge>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Your Contribution</span>
                  <span className="font-medium">{((levy.paid / levy.amount) * 100).toFixed(0)}%</span>
                </div>
                <Progress value={(levy.paid / levy.amount) * 100} color={levy.status === 'paid' ? 'green' : 'purple'} />
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-green-600">Paid: {formatCurrency(levy.paid)}</span>
                  <span className="text-gray-500">Target: {formatCurrency(levy.amount)}</span>
                </div>
              </div>

              {levy.status !== 'paid' && (
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm text-gray-500">Balance Due</p>
                    <p className="text-xl font-bold text-purple-600">{formatCurrency(levy.balance)}</p>
                  </div>
                  <Button onClick={() => router.push(`/dashboard/my-finances/pay?levyId=${levy.id}`)}>
                    Contribute Now
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
