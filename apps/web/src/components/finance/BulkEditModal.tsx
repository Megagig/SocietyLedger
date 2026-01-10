'use client';

import { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';
import { apiPatch, apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface Category {
  id: number;
  name: string;
  type: string;
}

interface BulkEditModalProps {
  transactionIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkEditModal({ transactionIds, onClose, onSuccess }: BulkEditModalProps) {
  const [formData, setFormData] = useState({
    categoryId: '',
    dueDate: '',
    notes: '',
    editReason: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data.categories || data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.editReason.trim()) {
      toast.error('Please provide a reason for bulk editing');
      return;
    }

    // At least one field must be provided
    if (!formData.categoryId && !formData.dueDate && !formData.notes) {
      toast.error('Please select at least one field to update');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: any = {};
      if (formData.categoryId) updates.categoryId = parseInt(formData.categoryId);
      if (formData.dueDate) updates.dueDate = new Date(formData.dueDate).toISOString();
      if (formData.notes) updates.notes = formData.notes;

      const response = await apiPatch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/bulk-edit`,
        {
          transactionIds,
          updates,
          editReason: formData.editReason,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      toast.success(`${transactionIds.length} transaction(s) updated successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to bulk edit transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Edit3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Bulk Edit Transactions ({transactionIds.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Note:</strong> Only unpaid transactions can be bulk edited. 
                  Fields you leave empty will not be changed.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Change Category (Optional)
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- Keep Current --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Change Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add/Update Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Leave empty to keep current notes"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Bulk Edit <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.editReason}
                  onChange={(e) => setFormData({ ...formData, editReason: e.target.value })}
                  placeholder="Please explain why you're bulk editing these transactions..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  required
                  minLength={5}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 5 characters required for audit trail</p>
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : `Update ${transactionIds.length} Transaction(s)`}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
