'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { apiPost, apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
}

interface Category {
  id: number;
  name: string;
  type: string;
}

interface VoidAndReplaceModalProps {
  transaction: {
    id: number;
    referenceNumber?: string;
    memberId: number;
    categoryId: number;
    amount: number;
    dueDate?: string;
    notes?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function VoidAndReplaceModal({ transaction, onClose, onSuccess }: VoidAndReplaceModalProps) {
  const [formData, setFormData] = useState({
    voidReason: '',
    newTransaction: {
      memberId: transaction.memberId,
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      dueDate: transaction.dueDate?.split('T')[0] || '',
      notes: transaction.notes || '',
    },
  });
  const [password, setPassword] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [membersRes, categoriesRes] = await Promise.all([
        apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members?limit=1000`),
        apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?limit=100`),
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data.members || membersData.data || []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.data.categories || categoriesData.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.voidReason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }

    if (!password) {
      toast.error('Enter your password to confirm');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/${transaction.id}/void-and-replace`,
        { ...formData, password }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      toast.success('Transaction voided and replaced successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to void and replace transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Void & Replace Transaction</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10">
          <p className="text-sm text-orange-800 dark:text-orange-300">
            <strong>Warning:</strong> This will mark the original transaction as voided and create a new corrected transaction. 
            This action is used for paid transactions and creates a permanent audit trail.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Original Transaction</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Reference: {transaction.referenceNumber || transaction.id}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Amount: ₦{transaction.amount.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Void Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.voidReason}
                  onChange={(e) => setFormData({ ...formData, voidReason: e.target.value })}
                  placeholder="Please provide a detailed reason for voiding this transaction..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  required
                  minLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 10 characters required for audit trail</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Voiding changes what a member owes, so we ask you to confirm it is you.</p>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Corrected Transaction</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Member
                    </label>
                    <select
                      value={formData.newTransaction.memberId}
                      onChange={(e) => setFormData({
                        ...formData,
                        newTransaction: { ...formData.newTransaction, memberId: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.firstName} {member.lastName} ({member.memberId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.newTransaction.categoryId}
                      onChange={(e) => setFormData({
                        ...formData,
                        newTransaction: { ...formData.newTransaction, categoryId: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Amount (₦)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.newTransaction.amount}
                      onChange={(e) => setFormData({
                        ...formData,
                        newTransaction: { ...formData.newTransaction, amount: parseFloat(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.newTransaction.dueDate}
                      onChange={(e) => setFormData({
                        ...formData,
                        newTransaction: { ...formData.newTransaction, dueDate: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.newTransaction.notes}
                      onChange={(e) => setFormData({
                        ...formData,
                        newTransaction: { ...formData.newTransaction, notes: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Void & Replace'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
