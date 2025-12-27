'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost } from '@/utils/api';
import { 
  ArrowLeft, DollarSign, User, 
  CheckCircle, Clock, AlertTriangle, Plus 
} from 'lucide-react';
import { PaymentButton } from '@/components/finance/PaymentButton';

interface TransactionDetail {
  id: number;
  referenceNumber: string;
  amount: number;
  status: string;
  dueDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  member: { id: number; memberId: string; firstName: string; lastName: string; email?: string; phone?: string };
  category: { id: number; name: string; type: string };
  payments: { id: number; amountPaid: number; paymentDate: string; paymentMethod?: string; receiptNumber?: string }[];
  creator: { id: number; email: string };
  totalPaid: number;
  balance: number;
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amountPaid: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTransaction();
  }, [params.id]);

  const fetchTransaction = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/${params.id}`
      );

      if (!response.ok) throw new Error('Failed to fetch transaction');

      const data = await response.json();
      setTransaction(data.data);
      setPaymentData(prev => ({
        ...prev,
        amountPaid: data.data.balance.toString(),
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/payments`,
        {
          transactionId: transaction!.id,
          amountPaid: parseFloat(paymentData.amountPaid),
          paymentDate: new Date(paymentData.paymentDate).toISOString(),
          paymentMethod: paymentData.paymentMethod,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      alert('Payment recorded successfully');
      setShowPaymentModal(false);
      fetchTransaction();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; icon: JSX.Element }> = {
      paid: { class: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" /> },
      overdue: { class: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-4 h-4" /> },
      partial: { class: 'bg-blue-100 text-blue-800', icon: <Clock className="w-4 h-4" /> },
      waived: { class: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="w-4 h-4" /> },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${badge.class}`}>
        {badge.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading transaction...</div>;
  }

  if (error || !transaction) {
    return <div className="p-6 text-center text-red-600">{error || 'Transaction not found'}</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Transactions
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Transaction {transaction.referenceNumber}
          </h1>
          <div className="mt-2">{getStatusBadge(transaction.status)}</div>
        </div>

        {transaction.status !== 'paid' && transaction.status !== 'waived' && (
          <Can permission={PERMISSIONS.PAYMENT_CREATE}>
            <div className="flex gap-3">
              <PaymentButton
                transactionId={transaction.id}
                amount={transaction.balance}
                variant="filled"
                size="md"
              />
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Record Payment
              </button>
            </div>
          </Can>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total Amount</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(transaction.amount)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Total Paid</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(transaction.totalPaid)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-500">Balance</span>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(transaction.balance)}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction Details
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Reference</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{transaction.referenceNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{transaction.category.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium text-gray-900 dark:text-white capitalize">{transaction.category.type}</dd>
            </div>
            {transaction.dueDate && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Due Date</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatDate(transaction.dueDate)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{formatDate(transaction.createdAt)}</dd>
            </div>
            {transaction.notes && (
              <div className="pt-2 border-t">
                <dt className="text-gray-500 mb-1">Notes</dt>
                <dd className="text-gray-900 dark:text-white">{transaction.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Member Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Member Information
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {transaction.member.firstName} {transaction.member.lastName}
              </p>
              <p className="text-sm text-gray-500">{transaction.member.memberId}</p>
            </div>
          </div>
          <dl className="space-y-2">
            {transaction.member.email && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900 dark:text-white">{transaction.member.email}</dd>
              </div>
            )}
            {transaction.member.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900 dark:text-white">{transaction.member.phone}</dd>
              </div>
            )}
          </dl>
          <button
            onClick={() => router.push(`/dashboard/members/${transaction.member.id}`)}
            className="mt-4 text-blue-600 hover:text-blue-800 text-sm"
          >
            View Member Profile →
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Payment History
        </h2>

        {transaction.payments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No payments recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transaction.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {payment.receiptNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {payment.paymentMethod || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                      {formatCurrency(payment.amountPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Record Payment
            </h2>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  max={Number(transaction.balance)}
                  value={paymentData.amountPaid}
                  onChange={(e) => setPaymentData({ ...paymentData, amountPaid: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: {formatCurrency(transaction.balance)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
