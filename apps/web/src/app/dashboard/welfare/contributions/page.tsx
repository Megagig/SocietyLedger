'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  getWelfareContributions, getWelfareFunds, recordContribution, confirmContribution,
  WelfareContribution, WelfareFund
} from '@/lib/api/welfare';
import { apiGet } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import {
  IconCurrencyNaira, IconPlus, IconCheck, IconX, IconSearch,
  IconFilter, IconCalendar
} from '@tabler/icons-react';

const CONTRIBUTION_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'yellow' },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function ContributionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  
  const [contributions, setContributions] = useState<WelfareContribution[]>([]);
  const [funds, setFunds] = useState<WelfareFund[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterFund, setFilterFund] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });

  const canManage = user?.role && hasPermission(user.role, PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE);
  const canConfirm = user?.role && hasPermission(user.role, PERMISSIONS.WELFARE_CONTRIBUTION_CONFIRM);

  useEffect(() => {
    if (searchParams.get('action') === 'record' && canManage) {
      setShowRecordModal(true);
    }
  }, [searchParams, canManage]);

  useEffect(() => {
    fetchData();
  }, [filterFund, filterStatus, pagination.page]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [contribRes, fundsRes, membersRes] = await Promise.all([
        getWelfareContributions({
          page: pagination.page,
          limit: 20,
          fundId: filterFund ? Number(filterFund) : undefined,
          status: filterStatus || undefined,
        }),
        getWelfareFunds({ status: 'ACTIVE', limit: 100 }),
        canManage ? apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members?limit=500`) : Promise.resolve({ ok: true, json: () => ({ data: { members: [] } }) }),
      ]);
      setContributions(contribRes.data.contributions);
      setFunds(fundsRes.data.funds);
      if (canManage && membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data?.members || []);
      }
      setPagination(prev => ({
        ...prev,
        totalPages: contribRes.data.pagination.totalPages,
        totalCount: contribRes.data.pagination.totalCount,
      }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (id: number, status: 'CONFIRMED' | 'REJECTED') => {
    try {
      await confirmContribution(id, { status });
      toast.success(`Contribution ${status.toLowerCase()} successfully`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || colors.PENDING;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Welfare Contributions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track and manage member contributions to welfare funds
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all"
          >
            <IconPlus size={18} />
            Record Contribution
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filterFund}
            onChange={(e) => setFilterFund(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Funds</option>
            {funds.map(fund => (
              <option key={fund.id} value={fund.id}>{fund.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            {CONTRIBUTION_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-gray-600 dark:text-gray-400">Loading contributions...</div>
          </div>
        ) : contributions.length === 0 ? (
          <div className="p-12 text-center">
            <IconCurrencyNaira className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Contributions Found
            </h3>
            <p className="text-gray-500">
              {canManage ? 'Record the first contribution to get started.' : 'No contributions recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fund
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  {canConfirm && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {contributions.map((contribution) => (
                  <tr key={contribution.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {contribution.member.firstName} {contribution.member.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{contribution.member.memberId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 dark:text-white">{contribution.fund.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-green-600">{formatCurrency(contribution.amount)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {formatDate(contribution.contributionDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(contribution.status)}`}>
                        {contribution.status}
                      </span>
                    </td>
                    {canConfirm && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {contribution.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleConfirm(contribution.id, 'CONFIRMED')}
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                              title="Confirm"
                            >
                              <IconCheck size={18} />
                            </button>
                            <button
                              onClick={() => handleConfirm(contribution.id, 'REJECTED')}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Reject"
                            >
                              <IconX size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Record Contribution Modal */}
      {showRecordModal && (
        <RecordContributionModal
          funds={funds}
          members={members}
          onClose={() => {
            setShowRecordModal(false);
            router.replace('/dashboard/welfare/contributions');
          }}
          onSuccess={() => {
            setShowRecordModal(false);
            router.replace('/dashboard/welfare/contributions');
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function RecordContributionModal({
  funds,
  members,
  onClose,
  onSuccess,
}: {
  funds: WelfareFund[];
  members: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fundId: '',
    memberId: '',
    amount: '',
    contributionDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    reference: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await recordContribution({
        fundId: Number(formData.fundId),
        memberId: Number(formData.memberId),
        amount: Number(formData.amount),
        contributionDate: formData.contributionDate,
        paymentMethod: formData.paymentMethod,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Contribution recorded successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Record Contribution
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Welfare Fund *
            </label>
            <select
              required
              value={formData.fundId}
              onChange={(e) => setFormData({ ...formData, fundId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a fund</option>
              {funds.map(fund => (
                <option key={fund.id} value={fund.id}>{fund.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Member *
            </label>
            <select
              required
              value={formData.memberId}
              onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a member</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} ({member.memberId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount (₦) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contribution Date *
            </label>
            <input
              type="date"
              required
              value={formData.contributionDate}
              onChange={(e) => setFormData({ ...formData, contributionDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Method
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reference
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Transaction reference (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Additional notes (optional)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Recording...' : 'Record Contribution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
