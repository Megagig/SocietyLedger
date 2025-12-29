'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSMSTemplates,
  createSMSTemplate,
  updateSMSTemplate,
  deleteSMSTemplate,
  SMSTemplate,
} from '@/lib/api/communication';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import {
  IconPlus, IconEdit, IconTrash, IconArrowLeft, IconTemplate,
  IconCheck, IconX
} from '@tabler/icons-react';

const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'PAYMENT_REMINDER', label: 'Payment Reminder' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'DUES', label: 'Dues' },
  { value: 'LEVY', label: 'Levy' },
  { value: 'WELFARE', label: 'Welfare' },
  { value: 'ELECTION', label: 'Election' },
  { value: 'CUSTOM', label: 'Custom' },
];

export default function SMSTemplatesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: 'GENERAL',
    placeholders: '',
  });

  const canManage = user?.role && hasPermission(user.role, PERMISSIONS.SMS_TEMPLATE_MANAGE);

  useEffect(() => {
    fetchTemplates();
  }, [categoryFilter]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await getSMSTemplates({ 
        limit: 50, 
        category: categoryFilter || undefined 
      });
      setTemplates(res.data?.templates || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({ name: '', content: '', category: 'GENERAL', placeholders: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (template: SMSTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      placeholders: template.placeholders.join(', '),
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      setFormError('Name and content are required');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const placeholders = formData.placeholders
        .split(',')
        .map(p => p.trim())
        .filter(p => p);

      if (editingTemplate) {
        await updateSMSTemplate(editingTemplate.id, {
          name: formData.name,
          content: formData.content,
          category: formData.category,
          placeholders,
        });
      } else {
        await createSMSTemplate({
          name: formData.name,
          content: formData.content,
          category: formData.category,
          placeholders,
        });
      }

      setShowModal(false);
      fetchTemplates();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteSMSTemplate(id);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (template: SMSTemplate) => {
    try {
      await updateSMSTemplate(template.id, { isActive: !template.isActive });
      fetchTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      GENERAL: 'bg-gray-100 text-gray-700',
      PAYMENT_REMINDER: 'bg-red-100 text-red-700',
      MEETING: 'bg-blue-100 text-blue-700',
      DUES: 'bg-green-100 text-green-700',
      LEVY: 'bg-purple-100 text-purple-700',
      WELFARE: 'bg-pink-100 text-pink-700',
      ELECTION: 'bg-orange-100 text-orange-700',
      CUSTOM: 'bg-teal-100 text-teal-700',
    };
    return colors[category] || colors.GENERAL;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/communication/sms')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <IconArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              SMS Templates
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create reusable message templates
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600"
          >
            <IconPlus size={18} />
            New Template
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading templates...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <IconTemplate className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates yet</h3>
          <p className="text-gray-500 mb-4">Create templates to speed up your messaging</p>
          {canManage && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            >
              Create Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${
                !template.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getCategoryColor(template.category)}`}>
                    {template.category}
                  </span>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`p-1.5 rounded ${
                        template.isActive 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={template.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {template.isActive ? <IconCheck size={16} /> : <IconX size={16} />}
                    </button>
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <IconEdit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                {template.content}
              </p>

              {template.placeholders.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {template.placeholders.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                    >
                      {`{{${p}}}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500 mt-2">
                Used {template.usageCount} times
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{formError}</div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Monthly Dues Reminder"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={4}
                    maxLength={918}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Dear {{name}}, your dues of ₦{{amount}} is due..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {`{{placeholder}}`} for dynamic content. {formData.content.length}/918 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Placeholders (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.placeholders}
                    onChange={(e) => setFormData({ ...formData, placeholders: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="name, amount, dueDate"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
