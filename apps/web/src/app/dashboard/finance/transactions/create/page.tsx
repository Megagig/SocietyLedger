'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FinancialCategory, Member } from '@/types';
import { apiGet, apiPost } from '@/utils/api';
import { toast } from '@/lib/toast';
import { ArrowLeft, Users, DollarSign } from 'lucide-react';

interface FormData {
  memberId: string;
  categoryId: string;
  amount: string;
  dueDate: string;
  notes: string;
}

export default function CreateTransactionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    memberId: '',
    categoryId: '',
    amount: '',
    dueDate: '',
    notes: '',
  });
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchMembers();
  }, []);

  useEffect(() => {
    // Auto-fill amount when category is selected
    if (formData.categoryId) {
      const category = categories.find(c => c.id === parseInt(formData.categoryId));
      if (category?.amount) {
        setFormData(prev => ({ ...prev, amount: category.amount!.toString() }));
      }
    }
  }, [formData.categoryId, categories]);

  const fetchCategories = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?isActive=true`
      );
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?status=active&limit=500`
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data.data.members);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isBulkMode) {
        // Bulk create transactions
        const response = await apiPost(
          `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/bulk`,
          {
            memberIds: selectedMembers,
            categoryId: parseInt(formData.categoryId),
            amount: parseFloat(formData.amount),
            dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
            notes: formData.notes || null,
          }
        );

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        toast.success(`${data.data.count} transactions created successfully`);
        router.push('/dashboard/finance/transactions');
      } else {
        // Single transaction
        const response = await apiPost(
          `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions`,
          {
            memberId: parseInt(formData.memberId),
            categoryId: parseInt(formData.categoryId),
            amount: parseFloat(formData.amount),
            dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
            notes: formData.notes || null,
          }
        );

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        toast.success('Transaction created successfully');
        router.push('/dashboard/finance/transactions');
      }
    } catch (err: any) {
      toast.apiError(err, 'Failed to create transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMemberSelection = (memberId: number) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAllMembers = () => {
    const filteredMembers = members.filter(m =>
      `${m.firstName} ${m.lastName} ${m.memberId}`.toLowerCase().includes(memberSearch.toLowerCase())
    );
    setSelectedMembers(filteredMembers.map(m => m.id));
  };

  const clearSelection = () => {
    setSelectedMembers([]);
  };

  const filteredMembers = members.filter(m =>
    `${m.firstName} ${m.lastName} ${m.memberId}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Record Transaction
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create a new financial transaction for members
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setIsBulkMode(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              !isBulkMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Single Transaction
          </button>
          <button
            onClick={() => setIsBulkMode(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isBulkMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Bulk Assignment
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category *
              </label>
              <select
                required
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type}) {cat.amount ? `- ₦${Number(cat.amount).toLocaleString()}` : ''}
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
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Member Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {isBulkMode ? 'Select Members' : 'Select Member'}
          </h2>

          {!isBulkMode ? (
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
                <option value="">Select member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.memberId})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={selectAllMembers}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                >
                  Clear
                </button>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedMembers.length} member(s) selected
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {filteredMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMemberSelection(member.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-900 dark:text-white">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className="text-sm text-gray-500">({member.memberId})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || (isBulkMode && selectedMembers.length === 0)}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : isBulkMode ? `Create ${selectedMembers.length} Transaction(s)` : 'Create Transaction'}
          </button>
        </div>
      </form>
    </div>
  );
}
