'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { 
  Gavel, Plus, Edit, Trash2, AlertTriangle,
  Clock, CheckCircle, Search
} from 'lucide-react';

interface PenaltyCategory {
  id: number;
  name: string;
  type: string;
  amount: number | null;
  description: string | null;
  isActive: boolean;
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
  const [penalties, setPenalties] = useState<PenaltyCategory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<PenaltyCategory | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<PenaltyCategory | null>(null);
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    amount: '',
    description: '',
    isActive: true,
  });
  
  // Assignment form
  const [assignForm, setAssignForm] = useState({
    memberId: '',
    amount: '',
    notes: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    fetchPenalties();
    fetchMembers();
  }, []);

  const fetchPenalties = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?type=penalty`
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

  const fetchMembers = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?status=active&limit=100`
      );
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data.data.members);
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

      alert(editingPenalty ? 'Penalty updated successfully' : 'Penalty created successfully');
      setShowCategoryModal(false);
      setEditingPenalty(null);
      setCategoryForm({ name: '', amount: '', description: '', isActive: true });
      fetchPenalties();
    } catch (err: any) {
      alert(err.message);
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

      alert('Penalty assigned successfully');
      setShowAssignModal(false);
      setSelectedPenalty(null);
      setAssignForm({ memberId: '', amount: '', notes: '' });
      router.push('/dashboard/finance/transactions');
    } catch (err: any) {
      alert(err.message);
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
    if (!confirm('Are you sure you want to delete this penalty type?')) return;

    try {
      const response = await apiDelete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories/${id}`
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      alert('Penalty deleted successfully');
      fetchPenalties();
    } catch (err: any) {
      alert(err.message);
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Penalties & Fines
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure and assign penalties to members
          </p>
        </div>
        
        <Can permission={PERMISSIONS.FINANCE_CREATE}>
          <button
            onClick={() => {
              setEditingPenalty(null);
              setCategoryForm({ name: '', amount: '', description: '', isActive: true });
              setShowCategoryModal(true);
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Penalty Type
          </button>
        </Can>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Penalty Types</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {penalties.length}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
              <Gavel className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {penalties.filter(p => p.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Inactive</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">
                {penalties.filter(p => !p.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <Clock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Penalties List */}
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
    </div>
  );
}
