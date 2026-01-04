'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type Settlement = {
  associationId: number;
  associationName: string;
  subdomain: string;
  totalTransactions: number;
  totalAmount: number;
  amountToTransfer: number;
  platformFee: number;
  payments?: PaymentDetail[];
};

type PaymentDetail = {
  id: number;
  reference: string;
  amount: number;
  provider: string;
  completedAt: string;
  memberName: string;
  memberEmail: string | null;
  transactionRef: string | null;
  category: string | null;
};

type Totals = {
  totalTransactions: number;
  totalAmount: number;
  amountToTransfer: number;
  platformFee: number;
};

export default function PaymentSettlementsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedAssociation, setExpandedAssociation] = useState<number | null>(null);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchSettlements();
  }, [token, user, selectedDate]);

  const fetchSettlements = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(
        `${API_ROUTES.ADMIN.STATS.replace('/stats', '')}/payment-settlements/daily?date=${selectedDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }
      );

      const data = await res.json();
      if (data.success) {
        setSettlements(data.data.settlements || []);
        setTotals(data.data.totals);
      }
    } catch (e) {
      console.error('Failed to fetch settlements:', e);
      toast.error('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpand = (associationId: number) => {
    setExpandedAssociation(expandedAssociation === associationId ? null : associationId);
  };

  const exportToCSV = () => {
    const csvRows = [
      ['Association', 'Subdomain', 'Transactions', 'Total Amount', 'Transfer (98%)', 'Platform Fee (2%)'],
      ...settlements.map(s => [
        s.associationName,
        s.subdomain,
        s.totalTransactions,
        s.totalAmount,
        s.amountToTransfer,
        s.platformFee,
      ]),
      [],
      ['TOTALS', '', totals?.totalTransactions || 0, totals?.totalAmount || 0, totals?.amountToTransfer || 0, totals?.platformFee || 0],
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlements-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Payment Settlements</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Daily Payment Settlements
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track and manage association payment settlements
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={exportToCSV}
            disabled={settlements.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {totals.totalTransactions}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(totals.totalAmount)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">To Transfer (98%)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(totals.amountToTransfer)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Platform Fee (2%)</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {formatCurrency(totals.platformFee)}
            </p>
          </div>
        </div>
      )}

      {/* Settlements List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No payments for {selectedDate}</p>
            <p className="text-sm mt-2">Try selecting a different date</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {settlements.map((settlement) => (
              <div key={settlement.associationId} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {settlement.associationName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {settlement.subdomain} • {settlement.totalTransactions} transaction{settlement.totalTransactions !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <div className="grid grid-cols-3 gap-4 w-full sm:w-auto">
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(settlement.totalAmount)}
                        </p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-gray-500">Transfer</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(settlement.amountToTransfer)}
                        </p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-gray-500">Fee</p>
                        <p className="font-semibold text-purple-600">
                          {formatCurrency(settlement.platformFee)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleExpand(settlement.associationId)}
                      className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30 w-full sm:w-auto"
                    >
                      {expandedAssociation === settlement.associationId ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded Payment Details */}
                {expandedAssociation === settlement.associationId && settlement.payments && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Reference</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Member</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {settlement.payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="py-2 px-3 text-xs font-mono text-gray-600 dark:text-gray-400">
                              {payment.reference}
                            </td>
                            <td className="py-2 px-3">
                              <div className="text-sm text-gray-900 dark:text-white">{payment.memberName}</div>
                              {payment.memberEmail && (
                                <div className="text-xs text-gray-500">{payment.memberEmail}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
                              {payment.category || '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500">
                              {formatDate(payment.completedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          💡 Settlement Instructions
        </h3>
        <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Review the settlements for the selected date</li>
          <li>Transfer the "Transfer (98%)" amount to each association's bank account</li>
          <li>Keep the "Platform Fee (2%)" in your account</li>
          <li>Use reference format: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SETTLE-{selectedDate}-[AssocID]</code></li>
          <li>Export CSV for your records</li>
        </ol>
      </div>
    </div>
  );
}
