'use client';

import { useState, useEffect } from 'react';
import { Badge, Select } from '@mantine/core';
import { IconCreditCard, IconCheck, IconClock, IconReceipt } from '@tabler/icons-react';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface PaymentItem {
  id: number;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  reference?: string;
  transaction: {
    id: number;
    referenceNumber: string;
    category: { id: number; name: string; type: string };
  };
  createdAt: string;
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/payments`);
      if (!response.ok) throw new Error('Failed to fetch payments');
      const result = await response.json();
      setPayments(result.data.payments || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dues': return 'blue';
      case 'levy': return 'purple';
      case 'donation': return 'pink';
      case 'penalty': return 'red';
      default: return 'gray';
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading payment history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Payment History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">View all your past payments</p>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100">Total Payments Made</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(totalPaid)}</p>
            <p className="text-green-100 mt-1">{payments.length} payment(s)</p>
          </div>
          <div className="p-4 bg-white/20 rounded-full">
            <IconCreditCard size={40} />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <Select
          placeholder="Filter by type"
          data={[
            { value: '', label: 'All Types' },
            { value: 'dues', label: 'Dues' },
            { value: 'levy', label: 'Levies' },
            { value: 'donation', label: 'Donations' },
            { value: 'penalty', label: 'Penalties' }
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          className="w-48"
        />
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconReceipt size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Payments Found</h3>
          <p className="text-gray-500">You haven't made any payments yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Method</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{payment.transaction.category.name}</p>
                      {payment.reference && (
                        <p className="text-xs text-gray-500">Receipt: {payment.reference}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={getTypeColor(payment.transaction.category.type)}>
                        {payment.transaction.category.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {payment.paymentMethod || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
