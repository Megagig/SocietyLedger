'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  ArrowLeft, DollarSign, User, 
  CheckCircle, Clock, AlertTriangle, Plus, Edit, FileText, History
} from 'lucide-react';
import { PaymentButton } from '@/components/finance/PaymentButton';
import { EditTransactionModal } from '@/components/finance/EditTransactionModal';
import { VoidAndReplaceModal } from '@/components/finance/VoidAndReplaceModal';
import { EditHistoryModal } from '@/components/finance/EditHistoryModal';

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
  editHistory?: string | null;
  lastEditedAt?: string | null;
  lastEditedBy?: string | null;
  isVoided?: boolean;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  replacedBy?: number | null;
  replaces?: number | null;
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVoidReplaceModal, setShowVoidReplaceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amountPaid: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTransaction();
    fetchDefaultPaymentMethod();
  }, [params.id]);

  const fetchDefaultPaymentMethod = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/payments`);
      if (response.ok) {
        const data = await response.json();
        const defaultMethod = data.data?.defaultPaymentMethod;
        if (defaultMethod) {
          setPaymentData((prev) => ({ ...prev, paymentMethod: defaultMethod }));
        }
      }
    } catch (err) {
      console.error('Error fetching default payment method:', err);
    }
  };

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

      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      fetchTransaction();
    } catch (err: any) {
      toast.apiError(err, 'Failed to record payment');
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
      {/* Voided Transaction Banner */}
      {transaction.isVoided && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200 text-sm">
                This Transaction Has Been Voided
              </h3>
              {transaction.voidReason && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Reason: {transaction.voidReason}
                </p>
              )}
              {transaction.voidedAt && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Voided on {formatDate(transaction.voidedAt)}
                  {transaction.voidedBy && ` by ${transaction.voidedBy}`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Settlement Warning Banner */}
      {transaction.status !== 'paid' && transaction.status !== 'waived' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
                Payment Processing Notice
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Online payments are currently processed through the platform account. Your association will receive automatic settlements within 24 hours with a 2% processing fee deducted. Full split payment integration coming soon.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
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
          <div className="mt-2 flex flex-wrap gap-2">
            {getStatusBadge(transaction.status)}
            {transaction.isVoided && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full text-sm font-medium" title={transaction.voidReason || 'Transaction voided'}>
                🚫 VOIDED
              </span>
            )}
            {!transaction.isVoided && transaction.lastEditedAt && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium" title={`Last edited: ${formatDate(transaction.lastEditedAt)}`}>
                ✏️ EDITED
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-3">
          {/* View History button - show if transaction has been edited */}
          {(transaction.editHistory || transaction.lastEditedAt) && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <History className="w-4 h-4" />
              View History
            </button>
          )}

          {/* Edit button - only for unpaid transactions with no payments */}
          <Can permission={PERMISSIONS.TRANSACTION_EDIT}>
            {transaction.status !== 'paid' && transaction.status !== 'waived' && Number(transaction.totalPaid) === 0 && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Transaction
              </button>
            )}
          </Can>

          {/* Void & Replace button - for paid or partially paid transactions */}
          <Can permission={PERMISSIONS.TRANSACTION_EDIT}>
            {(transaction.status === 'paid' || Number(transaction.totalPaid) > 0) && (
              <button
                onClick={() => setShowVoidReplaceModal(true)}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                Void & Replace
              </button>
            )}
          </Can>

          {/* Payment buttons - Always show for unpaid/partial transactions */}
          {transaction.status !== 'paid' && transaction.status !== 'waived' && (
            <Can permission={PERMISSIONS.PAYMENT_CREATE}>
              <PaymentButton
                transactionId={transaction.id}
                amount={transaction.balance}
                variant="filled"
                size="md"
              />
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Record Payment
              </button>
            </Can>
          )}
        </div>
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

      {/* Edit Transaction Modal */}
      {showEditModal && transaction && (
        <EditTransactionModal
          transaction={{
            id: transaction.id,
            memberId: transaction.member.id,
            categoryId: transaction.category.id,
            amount: transaction.amount,
            dueDate: transaction.dueDate,
            notes: transaction.notes,
            status: transaction.status,
            totalPaid: transaction.totalPaid,
          }}
          onClose={() => setShowEditModal(false)}
          onSuccess={fetchTransaction}
        />
      )}

      {/* Void & Replace Transaction Modal */}
      {showVoidReplaceModal && transaction && (
        <VoidAndReplaceModal
          transaction={{
            id: transaction.id,
            referenceNumber: transaction.referenceNumber,
            memberId: transaction.member.id,
            categoryId: transaction.category.id,
            amount: transaction.amount,
            dueDate: transaction.dueDate,
            notes: transaction.notes,
          }}
          onClose={() => setShowVoidReplaceModal(false)}
          onSuccess={fetchTransaction}
        />
      )}

      {/* Edit History Modal */}
      {showHistoryModal && transaction && (
        <EditHistoryModal
          transactionId={transaction.id}
          editHistory={transaction.editHistory || null}
          lastEditedAt={transaction.lastEditedAt}
          lastEditedBy={transaction.lastEditedBy}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
