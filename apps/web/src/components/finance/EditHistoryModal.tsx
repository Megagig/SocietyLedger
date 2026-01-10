'use client';

import { useState, useEffect } from 'react';
import { X, History, User, Calendar } from 'lucide-react';

interface EditEntry {
  editedAt: string;
  editedBy: string | number;
  reason: string;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
}

interface EditHistoryModalProps {
  transactionId: number;
  editHistory: string | null;
  lastEditedAt?: string | null;
  lastEditedBy?: string | null;
  onClose: () => void;
}

export function EditHistoryModal({
  transactionId,
  editHistory,
  lastEditedAt,
  lastEditedBy,
  onClose,
}: EditHistoryModalProps) {
  const [history, setHistory] = useState<EditEntry[]>([]);

  useEffect(() => {
    if (editHistory) {
      try {
        const parsed = typeof editHistory === 'string' ? JSON.parse(editHistory) : editHistory;
        // Handle both formats: { edits: [...] } or direct array
        if (parsed?.edits && Array.isArray(parsed.edits)) {
          setHistory(parsed.edits);
        } else if (Array.isArray(parsed)) {
          setHistory(parsed);
        } else {
          console.log('EditHistory format:', parsed);
          setHistory([]);
        }
      } catch (error) {
        console.error('Failed to parse edit history:', error);
        setHistory([]);
      }
    }
  }, [editHistory]);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('T')) {
      return formatDate(value);
    }
    if (typeof value === 'number') return `₦${value.toLocaleString()}`;
    return String(value);
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      memberId: 'Member',
      categoryId: 'Category',
      amount: 'Amount',
      dueDate: 'Due Date',
      notes: 'Notes',
      description: 'Description',
      type: 'Type',
      status: 'Status',
    };
    return labels[field] || field;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Edit History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No edit history available</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                This transaction has not been edited yet
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Last Edit Summary */}
              {lastEditedAt && lastEditedBy && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Last edited by {lastEditedBy} on {formatDate(lastEditedAt)}
                    </span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

                {/* Edit entries */}
                <div className="space-y-6">
                  {history.map((entry, index) => (
                    <div key={index} className="relative pl-12">
                      {/* Timeline dot */}
                      <div className="absolute left-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{history.length - index}</span>
                      </div>

                      {/* Entry card */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4" />
                            <span className="font-medium">User #{entry.editedBy}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(entry.editedAt)}</span>
                          </div>
                        </div>

                        {/* Reason */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                            Reason
                          </p>
                          <p className="text-sm text-gray-900 dark:text-white italic">
                            &quot;{entry.reason}&quot;
                          </p>
                        </div>

                        {/* Changes - Compare oldValues vs newValues */}
                        {entry.oldValues && entry.newValues && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                              Changes Made
                            </p>
                            <div className="space-y-2">
                              {Object.keys(entry.newValues).filter(key => key !== 'editReason').map((field, changeIndex) => {
                                const oldVal = entry.oldValues[field];
                                const newVal = entry.newValues[field];
                                // Skip if values are the same
                                if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                                return (
                                  <div
                                    key={changeIndex}
                                    className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm"
                                  >
                                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      {getFieldLabel(field)}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                          Old Value
                                        </p>
                                        <p className="text-gray-900 dark:text-white bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                                          {formatValue(oldVal)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                          New Value
                                        </p>
                                        <p className="text-gray-900 dark:text-white bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                          {formatValue(newVal)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
