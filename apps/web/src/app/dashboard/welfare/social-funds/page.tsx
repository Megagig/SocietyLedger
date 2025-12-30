'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  getWelfareFunds, createWelfareFund, updateWelfareFund, deleteWelfareFund,
  WelfareFund 
} from '@/lib/api/welfare';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import {
  IconWallet, IconPlus, IconEdit, IconTrash, IconSearch,
  IconHeart, IconFirstAidKit, IconSchool, IconAlertTriangle,
  IconBabyCarriage, IconHeart as IconWedding, IconFilter
} from '@tabler/icons-react';

const FUND_TYPES = [
  { value: 'GENERAL', label: 'General', icon: IconWallet, color: 'green' },
  { value: 'BEREAVEMENT', label: 'Bereavement', icon: IconHeart, color: 'gray' },
  { value: 'MEDICAL', label: 'Medical', icon: IconFirstAidKit, color: 'red' },
  { value: 'EDUCATION', label: 'Education', icon: IconSchool, color: 'blue' },
  { value: 'EMERGENCY', label: 'Emergency', icon: IconAlertTriangle, color: 'orange' },
  { value: 'MATERNITY', label: 'Maternity', icon: IconBabyCarriage, color: 'pink' },
  { value: 'WEDDING', label: 'Wedding', icon: IconWedding, color: 'purple' },
];

const FUND_STATUSES = [
  { value: 'ACTIVE', label: 'Active', color: 'green' },
  { value: 'SUSPENDED', label: 'Suspended', color: 'yellow' },
  { value: 'CLOSED', label: 'Closed', color: 'gray' },
];

export default function SocialFundsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  
  const [funds, setFunds] = useState<WelfareFund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFund, setEditingFund] = useState<WelfareFund | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });

  const isAdmin = user?.permissions && hasPermission(user.permissions, PERMISSIONS.WELFARE_MANAGE);

  useEffect(() => {
    if (searchParams.get('action') === 'create' && isAdmin) {
      setShowCreateModal(true);
    }
  }, [searchParams, isAdmin]);

  useEffect(() => {
    fetchFunds();
  }, [search, filterType, filterStatus, pagination.page]);

  const fetchFunds = async () => {
    try {
      setIsLoading(true);
      const result = await getWelfareFunds({
        page: pagination.page,
        limit: 10,
        search: search || undefined,
        fundType: filterType || undefined,
        status: filterStatus || undefined,
      });
      setFunds(result.data.funds);
      setPagination(prev => ({
        ...prev,
        totalPages: result.data.pagination.totalPages,
        totalCount: result.data.pagination.totalCount,
      }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (fund: WelfareFund) => {
    modals.openConfirmModal({
      title: 'Delete Welfare Fund',
      children: (
        <p className="text-sm text-gray-600">
          Are you sure you want to delete "{fund.name}"? This action cannot be undone.
        </p>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteWelfareFund(fund.id);
          toast.success('Fund deleted successfully');
          fetchFunds();
        } catch (err: any) {
          toast.error(err.message);
        }
      },
    });
  };

  const formatCurrency = (amount: string | number) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  const getFundTypeInfo = (type: string) => {
    return FUND_TYPES.find(t => t.value === type) || FUND_TYPES[0];
  };

  const getStatusColor = (status: string) => {
    const statusInfo = FUND_STATUSES.find(s => s.value === status);
    const colors: Record<string, string> = {
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };
    return colors[statusInfo?.color || 'gray'];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Social & Welfare Funds
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage welfare funds for member support
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all"
          >
            <IconPlus size={18} />
            Create Fund
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search funds..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            {FUND_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            {FUND_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Funds Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-gray-600 dark:text-gray-400">Loading funds...</div>
        </div>
      ) : funds.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconWallet className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Welfare Funds
          </h3>
          <p className="text-gray-500 mb-4">
            {isAdmin ? 'Create your first welfare fund to get started.' : 'No welfare funds available yet.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Create Fund
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funds.map((fund) => {
            const typeInfo = getFundTypeInfo(fund.fundType);
            const TypeIcon = typeInfo.icon;
            
            return (
              <div
                key={fund.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-${typeInfo.color}-100 dark:bg-${typeInfo.color}-900/30`}>
                      <TypeIcon className={`text-${typeInfo.color}-600 dark:text-${typeInfo.color}-400`} size={24} />
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(fund.status)}`}>
                      {fund.status}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {fund.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {fund.description || 'No description'}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Balance</span>
                      <span className="font-semibold text-green-600">{formatCurrency(fund.currentBalance)}</span>
                    </div>
                    {fund.targetBalance && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Target</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(fund.targetBalance)}</span>
                      </div>
                    )}
                    {fund.monthlyContribution && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Monthly</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(fund.monthlyContribution)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Contributors</span>
                      <span className="text-gray-700 dark:text-gray-300">{fund._count?.contributions || 0}</span>
                    </div>
                  </div>

                  {fund.isContributionMandatory && (
                    <div className="mb-4">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                        Mandatory
                      </span>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setEditingFund(fund)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <IconEdit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(fund)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <IconTrash size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {/* Create/Edit Modal */}
      {(showCreateModal || editingFund) && (
        <FundModal
          fund={editingFund}
          onClose={() => {
            setShowCreateModal(false);
            setEditingFund(null);
            router.replace('/dashboard/welfare/social-funds');
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingFund(null);
            router.replace('/dashboard/welfare/social-funds');
            fetchFunds();
          }}
        />
      )}
    </div>
  );
}

// Fund Create/Edit Modal Component
function FundModal({ 
  fund, 
  onClose, 
  onSuccess 
}: { 
  fund: WelfareFund | null; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    fundType: 'GENERAL' | 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'EMERGENCY' | 'MATERNITY' | 'WEDDING';
    targetBalance: number | '';
    monthlyContribution: number | '';
    isContributionMandatory: boolean;
    minContribution: number | '';
    maxPayout: number | '';
    waitingPeriodDays: number;
    minContributionMonths: number;
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  }>({
    name: fund?.name || '',
    description: fund?.description || '',
    fundType: fund?.fundType || 'GENERAL',
    targetBalance: fund?.targetBalance ? Number(fund.targetBalance) : '',
    monthlyContribution: fund?.monthlyContribution ? Number(fund.monthlyContribution) : '',
    isContributionMandatory: fund?.isContributionMandatory || false,
    minContribution: fund?.minContribution ? Number(fund.minContribution) : '',
    maxPayout: fund?.maxPayout ? Number(fund.maxPayout) : '',
    waitingPeriodDays: fund?.waitingPeriodDays || 0,
    minContributionMonths: fund?.minContributionMonths || 0,
    status: fund?.status || 'ACTIVE',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        fundType: formData.fundType,
        targetBalance: formData.targetBalance ? Number(formData.targetBalance) : undefined,
        monthlyContribution: formData.monthlyContribution ? Number(formData.monthlyContribution) : undefined,
        isContributionMandatory: formData.isContributionMandatory,
        minContribution: formData.minContribution ? Number(formData.minContribution) : undefined,
        maxPayout: formData.maxPayout ? Number(formData.maxPayout) : undefined,
        waitingPeriodDays: formData.waitingPeriodDays,
        minContributionMonths: formData.minContributionMonths,
        status: formData.status,
      };

      if (fund) {
        await updateWelfareFund(fund.id, data);
        toast.success('Fund updated successfully');
      } else {
        await createWelfareFund(data);
        toast.success('Fund created successfully');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {fund ? 'Edit Welfare Fund' : 'Create Welfare Fund'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fund Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Bereavement Support Fund"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Describe the purpose of this fund..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fund Type *
              </label>
              <select
                required
                value={formData.fundType}
                onChange={(e) => setFormData({ ...formData, fundType: e.target.value as typeof formData.fundType })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {FUND_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {fund && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {FUND_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Balance (₦)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.targetBalance}
                onChange={(e) => setFormData({ ...formData, targetBalance: e.target.value ? Number(e.target.value) : '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Monthly Contribution (₦)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.monthlyContribution}
                onChange={(e) => setFormData({ ...formData, monthlyContribution: e.target.value ? Number(e.target.value) : '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Contribution (₦)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minContribution}
                onChange={(e) => setFormData({ ...formData, minContribution: e.target.value ? Number(e.target.value) : '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Maximum Payout (₦)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.maxPayout}
                onChange={(e) => setFormData({ ...formData, maxPayout: e.target.value ? Number(e.target.value) : '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Waiting Period (Days)
              </label>
              <input
                type="number"
                min="0"
                value={formData.waitingPeriodDays}
                onChange={(e) => setFormData({ ...formData, waitingPeriodDays: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Days after joining before eligible</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min. Contribution Months
              </label>
              <input
                type="number"
                min="0"
                value={formData.minContributionMonths}
                onChange={(e) => setFormData({ ...formData, minContributionMonths: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Months of contributions required</p>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isContributionMandatory}
                  onChange={(e) => setFormData({ ...formData, isContributionMandatory: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Contribution is mandatory for all members
                </span>
              </label>
            </div>
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
              {isSubmitting ? 'Saving...' : fund ? 'Update Fund' : 'Create Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
