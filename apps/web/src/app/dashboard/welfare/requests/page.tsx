'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  getPayoutRequests, getWelfareFunds, createPayoutRequest, 
  reviewPayoutRequest, disbursePayoutRequest, cancelPayoutRequest,
  checkEligibility, WelfarePayoutRequest, WelfareFund
} from '@/lib/api/welfare';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import {
  IconHeart, IconPlus, IconCheck, IconX, IconCash,
  IconEye, IconFilter, IconAlertTriangle
} from '@tabler/icons-react';

const PAYOUT_TYPES = [
  { value: 'BEREAVEMENT', label: 'Bereavement' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'MATERNITY', label: 'Maternity' },
  { value: 'WEDDING', label: 'Wedding' },
  { value: 'OTHER', label: 'Other' },
];

const PAYOUT_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'yellow' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'blue' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
  { value: 'DISBURSED', label: 'Disbursed', color: 'purple' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'gray' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function PayoutRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  
  const [requests, setRequests] = useState<WelfarePayoutRequest[]>([]);
  const [funds, setFunds] = useState<WelfareFund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterFund, setFilterFund] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterType, setFilterType] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WelfarePayoutRequest | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });

  const canRequest = user?.permissions && hasPermission(user.permissions, PERMISSIONS.WELFARE_PAYOUT_REQUEST);
  const canApprove = user?.permissions && hasPermission(user.permissions, PERMISSIONS.WELFARE_PAYOUT_APPROVE);
  const canDisburse = user?.permissions && hasPermission(user.permissions, PERMISSIONS.WELFARE_PAYOUT_DISBURSE);

  useEffect(() => {
    if (searchParams.get('action') === 'create' && canRequest) {
      setShowCreateModal(true);
    }
  }, [searchParams, canRequest]);

  useEffect(() => {
    fetchData();
  }, [filterFund, filterStatus, filterType, pagination.page]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [requestsRes, fundsRes] = await Promise.all([
        getPayoutRequests({
          page: pagination.page,
          limit: 20,
          fundId: filterFund ? Number(filterFund) : undefined,
          status: filterStatus || undefined,
          payoutType: filterType || undefined,
        }),
        getWelfareFunds({ status: 'ACTIVE', limit: 100 }),
      ]);
      setRequests(requestsRes.data.requests);
      setFunds(fundsRes.data.funds);
      setPagination(prev => ({
        ...prev,
        totalPages: requestsRes.data.pagination.totalPages,
        totalCount: requestsRes.data.pagination.totalCount,
      }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (id: number, status: 'APPROVED' | 'REJECTED', approvedAmount?: number, reason?: string) => {
    try {
      await reviewPayoutRequest(id, { 
        status, 
        approvedAmount,
        rejectionReason: reason,
      });
      toast.success(`Request ${status.toLowerCase()} successfully`);
      fetchData();
      setSelectedRequest(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDisburse = async (id: number, method: string, reference?: string) => {
    try {
      await disbursePayoutRequest(id, { 
        disbursementMethod: method,
        disbursementReference: reference,
      });
      toast.success('Payout disbursed successfully');
      fetchData();
      setSelectedRequest(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancel = (request: WelfarePayoutRequest) => {
    modals.openConfirmModal({
      title: 'Cancel Payout Request',
      children: (
        <p className="text-sm text-gray-600">
          Are you sure you want to cancel this payout request? This action cannot be undone.
        </p>
      ),
      labels: { confirm: 'Cancel Request', cancel: 'Keep Request' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await cancelPayoutRequest(request.id);
          toast.success('Request cancelled successfully');
          fetchData();
        } catch (err: any) {
          toast.error(err.message);
        }
      },
    });
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
      UNDER_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      DISBURSED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };
    return colors[status] || colors.PENDING;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Payout Requests
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Request and manage welfare support payouts
          </p>
        </div>
        {canRequest && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all w-full sm:w-auto"
          >
            <IconPlus size={18} />
            Request Support
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
            {PAYOUT_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            {PAYOUT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-gray-600 dark:text-gray-400">Loading requests...</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <IconHeart className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Payout Requests
            </h3>
            <p className="text-gray-500">
              {canRequest ? 'Submit a request when you need welfare support.' : 'No payout requests found.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {requests.map((request) => (
                <div key={request.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {request.requestNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.payoutType} • {formatDate(request.requestedAt)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-900 dark:text-white">
                        {request.member.firstName} {request.member.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{request.fund.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(request.amount)}
                      </p>
                      {request.approvedAmount && request.approvedAmount !== request.amount && (
                        <p className="text-xs text-green-600">
                          Approved: {formatCurrency(request.approvedAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="View Details"
                    >
                      <IconEye size={18} />
                    </button>
                    {canApprove && ['PENDING', 'UNDER_REVIEW'].includes(request.status) && (
                      <>
                        <button
                          onClick={() => handleReview(request.id, 'APPROVED', Number(request.amount))}
                          className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Approve"
                        >
                          <IconCheck size={18} />
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Enter rejection reason:');
                            if (reason) handleReview(request.id, 'REJECTED', undefined, reason);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Reject"
                        >
                          <IconX size={18} />
                        </button>
                      </>
                    )}
                    {canDisburse && request.status === 'APPROVED' && (
                      <button
                        onClick={() => {
                          const method = prompt('Enter disbursement method (cash, bank_transfer, etc.):');
                          if (method) handleDisburse(request.id, method);
                        }}
                        className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                        title="Disburse"
                      >
                        <IconCash size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Request
                    </th>
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {request.requestNumber}
                          </p>
                          <p className="text-sm text-gray-500">
                            {request.payoutType} • {formatDate(request.requestedAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-gray-900 dark:text-white">
                            {request.member.firstName} {request.member.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{request.member.memberId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900 dark:text-white">{request.fund.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(request.amount)}
                          </p>
                          {request.approvedAmount && request.approvedAmount !== request.amount && (
                            <p className="text-sm text-green-600">
                              Approved: {formatCurrency(request.approvedAmount)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedRequest(request)}
                            className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="View Details"
                          >
                            <IconEye size={18} />
                          </button>
                          {canApprove && ['PENDING', 'UNDER_REVIEW'].includes(request.status) && (
                            <>
                              <button
                                onClick={() => handleReview(request.id, 'APPROVED', Number(request.amount))}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                title="Approve"
                              >
                                <IconCheck size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) handleReview(request.id, 'REJECTED', undefined, reason);
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Reject"
                              >
                                <IconX size={18} />
                              </button>
                            </>
                          )}
                          {canDisburse && request.status === 'APPROVED' && (
                            <button
                              onClick={() => {
                                const method = prompt('Enter disbursement method (cash, bank_transfer, etc.):');
                                if (method) handleDisburse(request.id, method);
                              }}
                              className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                              title="Disburse"
                            >
                              <IconCash size={18} />
                            </button>
                          )}
                          {canRequest && ['PENDING', 'UNDER_REVIEW'].includes(request.status) && (
                            <button
                              onClick={() => handleCancel(request)}
                              className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Cancel"
                            >
                              <IconX size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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

      {/* Create Request Modal */}
      {showCreateModal && (
        <CreateRequestModal
          funds={funds}
          onClose={() => {
            setShowCreateModal(false);
            router.replace('/dashboard/welfare/requests');
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            router.replace('/dashboard/welfare/requests');
            fetchData();
          }}
        />
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          canApprove={!!canApprove}
          canDisburse={!!canDisburse}
          onClose={() => setSelectedRequest(null)}
          onReview={handleReview}
          onDisburse={handleDisburse}
        />
      )}
    </div>
  );
}


function CreateRequestModal({
  funds,
  onClose,
  onSuccess,
}: {
  funds: WelfareFund[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<{ isEligible: boolean; reason: string | null } | null>(null);
  const [formData, setFormData] = useState({
    fundId: '',
    payoutType: 'OTHER',
    amount: '',
    reason: '',
    supportingDocuments: '',
  });

  const checkFundEligibility = async (fundId: string) => {
    if (!fundId) {
      setEligibility(null);
      return;
    }
    try {
      const result = await checkEligibility(Number(fundId));
      setEligibility(result.data);
    } catch (err) {
      setEligibility({ isEligible: false, reason: 'Failed to check eligibility' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligibility?.isEligible) {
      toast.error('You are not eligible for this fund');
      return;
    }
    setIsSubmitting(true);

    try {
      await createPayoutRequest({
        fundId: Number(formData.fundId),
        payoutType: formData.payoutType,
        amount: Number(formData.amount),
        reason: formData.reason,
        supportingDocuments: formData.supportingDocuments || undefined,
      });
      toast.success('Payout request submitted successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Request Welfare Support
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
              onChange={(e) => {
                setFormData({ ...formData, fundId: e.target.value });
                checkFundEligibility(e.target.value);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a fund</option>
              {funds.map(fund => (
                <option key={fund.id} value={fund.id}>{fund.name} ({fund.fundType})</option>
              ))}
            </select>
            {eligibility && (
              <div className={`mt-2 p-2 rounded text-sm ${
                eligibility.isEligible 
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
              }`}>
                {eligibility.isEligible ? '✓ You are eligible for this fund' : `✗ ${eligibility.reason}`}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Request Type *
            </label>
            <select
              required
              value={formData.payoutType}
              onChange={(e) => setFormData({ ...formData, payoutType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {PAYOUT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount Requested (₦) *
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
              Reason / Description *
            </label>
            <textarea
              required
              minLength={10}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Please provide details about your request (minimum 10 characters)..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supporting Documents
            </label>
            <input
              type="text"
              value={formData.supportingDocuments}
              onChange={(e) => setFormData({ ...formData, supportingDocuments: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Link to documents or description (optional)"
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
              disabled={isSubmitting || !eligibility?.isEligible}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestDetailsModal({
  request,
  canApprove,
  canDisburse,
  onClose,
  onReview,
  onDisburse,
}: {
  request: WelfarePayoutRequest;
  canApprove?: boolean;
  canDisburse?: boolean;
  onClose: () => void;
  onReview: (id: number, status: 'APPROVED' | 'REJECTED', amount?: number, reason?: string) => void;
  onDisburse: (id: number, method: string, reference?: string) => void;
}) {
  const [approvedAmount, setApprovedAmount] = useState(request.amount);
  const [rejectionReason, setRejectionReason] = useState('');
  const [disbursementMethod, setDisbursementMethod] = useState('bank_transfer');
  const [disbursementReference, setDisbursementReference] = useState('');

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Request Details - {request.requestNumber}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Request Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Member</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {request.member.firstName} {request.member.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fund</p>
              <p className="font-medium text-gray-900 dark:text-white">{request.fund.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium text-gray-900 dark:text-white">{request.payoutType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium text-gray-900 dark:text-white">{request.status.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount Requested</p>
              <p className="font-medium text-green-600">{formatCurrency(request.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Requested At</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(request.requestedAt)}</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm text-gray-500 mb-1">Reason</p>
            <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              {request.reason}
            </p>
          </div>

          {/* Review/Approval Info */}
          {request.approvedAmount && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                Approved Amount: {formatCurrency(request.approvedAmount)}
              </p>
              {request.reviewComments && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Comments: {request.reviewComments}
                </p>
              )}
            </div>
          )}

          {request.rejectionReason && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                Rejection Reason: {request.rejectionReason}
              </p>
            </div>
          )}

          {/* Actions */}
          {canApprove && ['PENDING', 'UNDER_REVIEW'].includes(request.status) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Review Request</h3>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Approved Amount (₦)</label>
                <input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Rejection Reason (if rejecting)</label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Required if rejecting"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onReview(request.id, 'APPROVED', Number(approvedAmount))}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (!rejectionReason) {
                      toast.error('Please provide a rejection reason');
                      return;
                    }
                    onReview(request.id, 'REJECTED', undefined, rejectionReason);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {canDisburse && request.status === 'APPROVED' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Disburse Payment</h3>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Disbursement Method</label>
                <select
                  value={disbursementMethod}
                  onChange={(e) => setDisbursementMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Reference (optional)</label>
                <input
                  type="text"
                  value={disbursementReference}
                  onChange={(e) => setDisbursementReference(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Transaction reference"
                />
              </div>
              <button
                onClick={() => onDisburse(request.id, disbursementMethod, disbursementReference)}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Disburse {formatCurrency(request.approvedAmount || request.amount)}
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
