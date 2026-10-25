'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Tabs } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { HelpLink } from '@/components/docs/HelpLink';
import { 
  Gavel, Plus, Edit, Trash2, AlertTriangle,
  Clock, CheckCircle, Search, Settings, History, XCircle, TrendingUp
} from 'lucide-react';

interface PenaltyCategory {
  id: number;
  name: string;
  type: string;
  amount: number | null;
  description: string | null;
  isActive: boolean;
}

interface PenaltyRule {
  id: number;
  name: string;
  description: string | null;
  triggerType: string;
  gracePeriodDays: number;
  feeType: string;
  feeAmount: number;
  maxFeeAmount: number | null;
  isCompounding: boolean;
  compoundingDays: number | null;
  isActive: boolean;
  category?: { id: number; name: string };
  _count?: { appliedPenalties: number };
}

interface AppliedPenalty {
  id: number;
  amount: number;
  status: string;
  referenceNumber: string | null;
  createdAt: string;
  member: { firstName: string; lastName: string; memberId: string };
  category: { name: string };
  payments: { amountPaid: number }[];
}

interface PenaltyWaiver {
  id: number;
  waivedAmount: number;
  reason: string;
  waivedAt: string;
  transaction: {
    id: number;
    amount: number;
    member: { firstName: string; lastName: string; memberId: string };
    category: { name: string };
  };
}

interface PenaltyStats {
  rules: { total: number; active: number };
  penalties: { totalApplied: number; totalAmount: number; totalCollected: number; totalOutstanding: number };
  waivers: { count: number; totalWaived: number };
}

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function PenaltiesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>('categories');
  const [penalties, setPenalties] = useState<PenaltyCategory[]>([]);
  const [rules, setRules] = useState<PenaltyRule[]>([]);
  const [waivers, setWaivers] = useState<PenaltyWaiver[]>([]);
  const [appliedPenalties, setAppliedPenalties] = useState<AppliedPenalty[]>([]);
  const [stats, setStats] = useState<PenaltyStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<PenaltyCategory | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<PenaltyCategory | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    amount: '',
    description: '',
    isActive: true,
  });
  
  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    triggerType: 'late_payment',
    gracePeriodDays: '7',
    feeType: 'fixed',
    feeAmount: '',
    maxFeeAmount: '',
    isCompounding: false,
    compoundingDays: '30',
  });
  
  // Assignment form
  const [assignForm, setAssignForm] = useState({
    memberId: '',
    amount: '',
    notes: '',
  });
  
  // Waiver form
  const [waiverForm, setWaiverForm] = useState({
    waivedAmount: '',
    reason: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    fetchPenalties();
    fetchRules();
    fetchWaivers();
    fetchAppliedPenalties();
    fetchStats();
    fetchMembers();
  }, []);

  const fetchPenalties = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?type=penalty&limit=100`
      );
      if (!response.ok) throw new Error('Failed to fetch penalties');
      const data = await response.json();
      setPenalties(data.data.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/rules?limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setRules(data.data.rules || []);
      }
    } catch (err: any) {
      console.error('Error fetching rules:', err);
    }
  };

  const fetchWaivers = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/waivers?limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setWaivers(data.data.waivers || []);
      }
    } catch (err: any) {
      console.error('Error fetching waivers:', err);
    }
  };

  const fetchAppliedPenalties = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions?type=penalty&limit=100&sortBy=createdAt&sortOrder=desc`
      );
      if (response.ok) {
        const data = await response.json();
        setAppliedPenalties(data.data.transactions || []);
      }
    } catch (err: any) {
      console.error('Error fetching applied penalties:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/stats`
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const all: Member[] = [];
      for (let page = 1; page <= 50; page++) {
        const response = await apiGet(
          `${process.env.NEXT_PUBLIC_API_URL}/api/members?status=active&limit=100&page=${page}`
        );
        if (!response.ok) throw new Error('Failed to fetch members');
        const data = await response.json();
        all.push(...data.data.members);
        if (!data.data.pagination?.hasMore) break;
      }
      setMembers(all);
    } catch (err: any) {
      console.error('Error fetching members:', err);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories${editingPenalty ? `/${editingPenalty.id}` : ''}`;
      const payload = {
        name: categoryForm.name,
        type: 'penalty',
        amount: categoryForm.amount ? parseFloat(categoryForm.amount) : null,
        frequency: 'one-time',
        description: categoryForm.description || null,
        isActive: categoryForm.isActive,
      };

      const response = editingPenalty 
        ? await apiPatch(url, payload)
        : await apiPost(url, payload);

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save penalty');

      toast.success(editingPenalty ? 'Penalty updated successfully' : 'Penalty created successfully');
      setShowCategoryModal(false);
      setEditingPenalty(null);
      setCategoryForm({ name: '', amount: '', description: '', isActive: true });
      fetchPenalties();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save penalty');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPenalty || !assignForm.memberId) return;

    setIsSubmitting(true);
    try {
      const amount = assignForm.amount ? parseFloat(assignForm.amount) : selectedPenalty.amount;
      if (!amount || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions`,
        {
          memberId: parseInt(assignForm.memberId),
          categoryId: selectedPenalty.id,
          amount,
          notes: assignForm.notes || `Penalty: ${selectedPenalty.name}`,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to assign penalty');

      toast.success('Penalty assigned successfully');
      setShowAssignModal(false);
      setSelectedPenalty(null);
      setAssignForm({ memberId: '', amount: '', notes: '' });
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign penalty');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/rules`,
        {
          name: ruleForm.name,
          description: ruleForm.description || undefined,
          categoryId: ruleForm.categoryId ? parseInt(ruleForm.categoryId) : undefined,
          triggerType: ruleForm.triggerType,
          gracePeriodDays: parseInt(ruleForm.gracePeriodDays),
          feeType: ruleForm.feeType,
          feeAmount: parseFloat(ruleForm.feeAmount),
          maxFeeAmount: ruleForm.maxFeeAmount ? parseFloat(ruleForm.maxFeeAmount) : undefined,
          isCompounding: ruleForm.isCompounding,
          compoundingDays: ruleForm.isCompounding ? parseInt(ruleForm.compoundingDays) : undefined,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create rule');

      toast.success('Penalty rule created successfully');
      setShowRuleModal(false);
      fetchRules();
      setRuleForm({
        name: '', description: '', categoryId: '', triggerType: 'late_payment',
        gracePeriodDays: '7', feeType: 'fixed', feeAmount: '', maxFeeAmount: '',
        isCompounding: false, compoundingDays: '30',
      });
      fetchRules();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWaiverModal = (txn: AppliedPenalty) => {
    const paid = txn.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    const outstanding = Number(txn.amount) - paid;
    setSelectedTransaction(txn);
    setWaiverForm({ waivedAmount: outstanding.toString(), reason: '' });
    setShowWaiverModal(true);
  };

  const handleWaivePenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;

    setIsSubmitting(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/${selectedTransaction.id}/waive`,
        {
          waivedAmount: parseFloat(waiverForm.waivedAmount),
          reason: waiverForm.reason,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to waive penalty');

      toast.success('Penalty waived successfully');
      setShowWaiverModal(false);
      setSelectedTransaction(null);
      setWaiverForm({ waivedAmount: '', reason: '' });
      fetchWaivers();
      fetchAppliedPenalties();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to waive penalty');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyLateFeesNow = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/apply-late-fees`,
        {}
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to apply late fees');

      toast.success(`Applied ${data.data.applied} late fee(s), total: ₦${data.data.totalAmount.toLocaleString()}`);
      fetchStats();
      fetchAppliedPenalties();
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply late fees');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shows who would be charged and how much, and only applies once the officer confirms.
  const handleApplyLateFees = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/late-fees/preview`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to check late fees');
      const preview = data.data as {
        count: number;
        memberCount: number;
        totalAmount: number;
        items: { transactionId: number; memberName: string; chargeName: string; daysOverdue: number; penaltyAmount: number }[];
        truncated: boolean;
      };

      if (preview.count === 0) {
        toast.info('No late fees are due right now.');
        return;
      }

      modals.openConfirmModal({
        title: 'Apply late fees now?',
        children: (
          <div>
            <Text size="sm" mb="sm">
              This charges {preview.count} late fee(s) to {preview.memberCount} member(s), ₦{preview.totalAmount.toLocaleString()} in total.
              Voided charges, donation pledges and charges inside their grace period are left out.
            </Text>
            <div className="max-h-48 overflow-y-auto text-sm">
              {preview.items.map((item) => (
                <div key={item.transactionId} className="flex justify-between gap-2 py-1 border-b border-gray-100 dark:border-gray-700">
                  <span>{item.memberName} · {item.chargeName} · {item.daysOverdue} days overdue</span>
                  <span className="font-medium">₦{item.penaltyAmount.toLocaleString()}</span>
                </div>
              ))}
              {preview.truncated && <p className="text-gray-500 pt-1">…and more.</p>}
            </div>
          </div>
        ),
        labels: { confirm: 'Apply late fees', cancel: 'Not now' },
        onConfirm: applyLateFeesNow,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to check late fees');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (penalty: PenaltyCategory) => {
    setEditingPenalty(penalty);
    setCategoryForm({
      name: penalty.name,
      amount: penalty.amount?.toString() || '',
      description: penalty.description || '',
      isActive: penalty.isActive,
    });
    setShowCategoryModal(true);
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Penalty Type',
      children: (
        <Text size="sm">
          Are you sure you want to delete this penalty type? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories/${id}`
          );

          const data = await response.json();
          if (!response.ok) throw new Error(data.message);

          toast.success('Penalty deleted successfully');
          fetchPenalties();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete penalty');
        }
      },
    });
  };

  const handleToggleRule = async (rule: PenaltyRule) => {
    try {
      const response = await apiPatch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/penalties/rules/${rule.id}`,
        { isActive: !rule.isActive }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update rule');

      toast.success(`Rule ${rule.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchRules();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rule status');
    }
  };

  const openAssignModal = (penalty: PenaltyCategory) => {
    setSelectedPenalty(penalty);
    setAssignForm({
      memberId: '',
      amount: penalty.amount?.toString() || '',
      notes: '',
    });
    setShowAssignModal(true);
  };

  const filteredMembers = members.filter(m => 
    memberSearch === '' ||
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.memberId.toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Penalties & Fines
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Configure penalty rules, manage waivers, and track late fees
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <HelpLink />
          <Can permission={PERMISSIONS.FINANCE_APPROVE}>
            <button
              onClick={handleApplyLateFees}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Apply Late Fees</span>
              <span className="sm:hidden">Late Fees</span>
            </button>
          </Can>
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => setShowRuleModal(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">New Rule</span>
              <span className="sm:hidden">Rule</span>
            </button>
          </Can>
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => {
                setEditingPenalty(null);
                setCategoryForm({ name: '', amount: '', description: '', isActive: true });
                setShowCategoryModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Penalty Type</span>
              <span className="sm:hidden">Penalty</span>
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Penalties</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">
                ₦{Number(stats?.penalties.totalAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900 rounded-full">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Collected</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1">
                ₦{Number(stats?.penalties.totalCollected || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Active Rules</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1">
                {stats?.rules.active || rules.filter(r => r.isActive).length}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Waived</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600 mt-1">
                ₦{Number(stats?.waivers.totalWaived || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="categories">Penalty Types ({penalties.length})</Tabs.Tab>
          <Tabs.Tab value="rules">Late Fee Rules ({rules.length})</Tabs.Tab>
          <Tabs.Tab value="applied">Applied Penalties ({appliedPenalties.length})</Tabs.Tab>
          <Tabs.Tab value="waivers">Waivers ({waivers.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
      {penalties.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Gavel className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Penalty Types Created
          </h3>
          <p className="text-gray-500 mb-4">
            Create penalty types to enforce rules and collect fines
          </p>
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Create Penalty Type
            </button>
          </Can>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {penalties.map(penalty => (
            <div
              key={penalty.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                !penalty.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                    <Gavel className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {penalty.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      penalty.isActive 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {penalty.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Can permission={PERMISSIONS.FINANCE_EDIT}>
                    <button
                      onClick={() => handleEdit(penalty)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </Can>
                  <Can permission={PERMISSIONS.FINANCE_DELETE}>
                    <button
                      onClick={() => handleDelete(penalty.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Can>
                </div>
              </div>

              {penalty.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {penalty.description}
                </p>
              )}

              <div className="space-y-2 text-sm mb-4">
                {penalty.amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Default Amount:</span>
                    <span className="font-semibold text-red-600">
                      ₦{Number(penalty.amount).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
                <button
                  onClick={() => openAssignModal(penalty)}
                  disabled={!penalty.isActive}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Assign to Member
                </button>
              </Can>
            </div>
          ))}
        </div>
      )}
        </Tabs.Panel>

        <Tabs.Panel value="rules" pt="md">
          {/* Late Fee Rules */}
          {rules.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Late Fee Rules
              </h3>
              <p className="text-gray-500 mb-4">
                Create rules to automatically apply late fees to overdue transactions
              </p>
              <Can permission={PERMISSIONS.FINANCE_CREATE}>
                <button
                  onClick={() => setShowRuleModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  <Settings className="w-4 h-4" />
                  Create Rule
                </button>
              </Can>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map(rule => (
                <div key={rule.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${!rule.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{rule.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{rule.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Trigger:</span>
                      <span className="capitalize">{rule.triggerType.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Grace Period:</span>
                      <span>{rule.gracePeriodDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fee:</span>
                      <span className="font-semibold text-red-600">
                        {rule.feeType === 'percentage' ? `${rule.feeAmount}%` : `₦${Number(rule.feeAmount).toLocaleString()}`}
                      </span>
                    </div>
                    {rule.isCompounding && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Compounds:</span>
                        <span>Every {rule.compoundingDays} days</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Applied:</span>
                      <span>{rule._count?.appliedPenalties || 0} times</span>
                    </div>
                  </div>
                  <Can permission={PERMISSIONS.FINANCE_EDIT}>
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        rule.isActive
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                          : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                      }`}
                    >
                      {rule.isActive ? (
                        <>
                          <XCircle className="w-4 h-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Activate
                        </>
                      )}
                    </button>
                  </Can>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="applied" pt="md">
          {/* Applied Penalties */}
          {appliedPenalties.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Penalties Applied Yet
              </h3>
              <p className="text-gray-500">
                Penalty transactions will appear here once applied to members
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {appliedPenalties.map(txn => {
                    const paid = txn.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
                    const outstanding = Number(txn.amount) - paid;
                    const waivable = txn.status !== 'waived' && outstanding > 0;
                    return (
                      <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{txn.member.firstName} {txn.member.lastName}</p>
                            <p className="text-sm text-gray-500">{txn.member.memberId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{txn.category.name}</td>
                        <td className="px-4 py-3 text-red-600">₦{Number(txn.amount).toLocaleString()}</td>
                        <td className="px-4 py-3">₦{outstanding.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 capitalize">
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(txn.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Can permission={PERMISSIONS.FINANCE_EDIT}>
                            {waivable && (
                              <button
                                onClick={() => openWaiverModal(txn)}
                                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                              >
                                Waive
                              </button>
                            )}
                          </Can>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="waivers" pt="md">
          {/* Waivers History */}
          {waivers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <History className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Waivers Yet
              </h3>
              <p className="text-gray-500">
                Penalty waivers will appear here once granted
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waived</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {waivers.map(waiver => (
                    <tr key={waiver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{waiver.transaction.member.firstName} {waiver.transaction.member.lastName}</p>
                          <p className="text-sm text-gray-500">{waiver.transaction.member.memberId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-red-600">
                        ₦{Number(waiver.transaction.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-purple-600">
                        ₦{Number(waiver.waivedAmount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">{waiver.reason}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(waiver.waivedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingPenalty ? 'Edit Penalty Type' : 'Create Penalty Type'}
            </h2>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Penalty Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Late Payment Fine"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Amount (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={categoryForm.amount}
                  onChange={(e) => setCategoryForm({ ...categoryForm, amount: e.target.value })}
                  placeholder="Enter default penalty amount"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  placeholder="Describe when this penalty applies"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="categoryActive" className="text-sm text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Penalty Modal */}
      {showAssignModal && selectedPenalty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Assign Penalty: {selectedPenalty.name}
            </h2>

            <form onSubmit={handleAssignPenalty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search Member
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Member *
                </label>
                <select
                  required
                  value={assignForm.memberId}
                  onChange={(e) => setAssignForm({ ...assignForm, memberId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a member</option>
                  {filteredMembers.map(member => (
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
                  step="0.01"
                  required
                  value={assignForm.amount}
                  onChange={(e) => setAssignForm({ ...assignForm, amount: e.target.value })}
                  placeholder={selectedPenalty.amount ? `Default: ${selectedPenalty.amount}` : 'Enter amount'}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Reason for this penalty"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Assigning...' : 'Assign Penalty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create Late Fee Rule
            </h2>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g., Standard Late Fee"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Apply to Category (Optional)
                </label>
                <select
                  value={ruleForm.categoryId}
                  onChange={(e) => setRuleForm({ ...ruleForm, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  {penalties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grace Period (Days) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={ruleForm.gracePeriodDays}
                    onChange={(e) => setRuleForm({ ...ruleForm, gracePeriodDays: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fee Type *
                  </label>
                  <select
                    required
                    value={ruleForm.feeType}
                    onChange={(e) => setRuleForm({ ...ruleForm, feeType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fee Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ruleForm.feeAmount}
                    onChange={(e) => setRuleForm({ ...ruleForm, feeAmount: e.target.value })}
                    placeholder={ruleForm.feeType === 'percentage' ? 'e.g., 5' : 'e.g., 500'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Fee (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleForm.maxFeeAmount}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxFeeAmount: e.target.value })}
                    placeholder="Cap for percentage"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCompounding"
                  checked={ruleForm.isCompounding}
                  onChange={(e) => setRuleForm({ ...ruleForm, isCompounding: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isCompounding" className="text-sm text-gray-700 dark:text-gray-300">
                  Compounding (apply repeatedly)
                </label>
              </div>

              {ruleForm.isCompounding && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Compound Every (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={ruleForm.compoundingDays}
                    onChange={(e) => setRuleForm({ ...ruleForm, compoundingDays: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  rows={2}
                  placeholder="Describe when this rule applies"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waiver Modal */}
      {showWaiverModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Waive Penalty
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedTransaction.member.firstName} {selectedTransaction.member.lastName} — {selectedTransaction.category.name}
            </p>

            <form onSubmit={handleWaivePenalty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount to Waive (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={waiverForm.waivedAmount}
                  onChange={(e) => setWaiverForm({ ...waiverForm, waivedAmount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  value={waiverForm.reason}
                  onChange={(e) => setWaiverForm({ ...waiverForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Why is this penalty being waived?"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowWaiverModal(false); setSelectedTransaction(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Waiving...' : 'Waive Penalty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
