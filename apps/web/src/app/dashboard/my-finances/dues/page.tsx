'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Select, Button } from '@mantine/core';
import { IconReceipt, IconCurrencyNaira, IconCheck, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface DueItem {
  id: number;
  referenceNumber: string;
  category: { id: number; name: string; type: string; frequency?: string };
  amount: number;
  paid: number;
  balance: number;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  payments: any[];
  createdAt: string;
}

export default function MyDuesPage() {
  const router = useRouter();
  const [dues, setDues] = useState<DueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => { fetchDues(); }, []);

  const fetchDues = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/dues`);
      if (!response.ok) throw new Error('Failed to fetch dues');
      const result = await response.json();
      setDues(result.data.dues || []);
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
      case 'overdue': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <IconCheck size={16} />;
      case 'overdue': return <IconAlertTriangle size={16} />;
      default: return <IconClock size={16} />;
    }
  };

  const totalOutstanding = dues.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.balance, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your dues...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Dues
          </h1>
          <p className="text-gray-600 dark:text-gray-400">View and pay your membership dues</p>
        </div>
        {totalOutstanding > 0 && (
          <Button onClick={() => router.push('/dashboard/my-finances/pay')} color="green" leftSection={<IconCurrencyNaira size={16} />}>
            Pay {formatCurrency(totalOutstanding)}
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100">Outstanding Dues</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(totalOutstanding)}</p>
            <p className="text-blue-100 mt-1">{dues.filter(d => d.status !== 'paid').length} pending item(s)</p>
          </div>
          <div className="p-4 bg-white/20 rounded-full">
            <IconReceipt size={40} />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <Select
          placeholder="Filter by status"
          data={[
            { value: '', label: 'All Status' },
            { value: 'pending', label: 'Pending' },
            { value: 'partial', label: 'Partial' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' }
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          className="w-48"
        />
      </div>

      {/* Dues List */}
      {dues.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All Caught Up!</h3>
          <p className="text-gray-500">You have no outstanding dues.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dues.map((due) => (
            <div key={due.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${due.status === 'paid' ? 'bg-green-100 dark:bg-green-900/30' : due.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                    <IconReceipt className={due.status === 'paid' ? 'text-green-600' : due.status === 'overdue' ? 'text-red-600' : 'text-blue-600'} size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{due.category.name}</h3>
                    <p className="text-sm text-gray-500">Due: {formatDate(due.dueDate)}</p>
                    {due.status === 'partial' && (
                      <p className="text-sm text-amber-600">Paid: {formatCurrency(due.paid)} of {formatCurrency(due.amount)}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge color={getStatusColor(due.status)} leftSection={getStatusIcon(due.status)}>
                    {due.status.toUpperCase()}
                  </Badge>
                  <p className="text-xl font-bold mt-2 text-gray-900 dark:text-white">
                    {formatCurrency(due.status === 'paid' ? due.amount : due.balance)}
                  </p>
                </div>
              </div>
              {due.status !== 'paid' && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <Button size="sm" onClick={() => router.push(`/dashboard/my-finances/pay?transactionId=${due.id}`)}>
                    Pay Now
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
