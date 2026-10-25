'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';
import { ONBOARDING_FINANCE_TEMPLATES } from '@societyledger/shared';

interface FinancialCategory {
  name: string;
  type: string;
  amount: string;
  frequency: string;
  description: string;
}

// The same starter templates the mobile app offers (packages/shared/src/onboarding.ts)
const categoryTemplates: FinancialCategory[] = ONBOARDING_FINANCE_TEMPLATES.map((t) => ({ ...t, amount: String(t.amount) }));

const inputClass =
  'px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500';

export default function FinanceSetupPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Names already saved on an earlier attempt, so a retry never creates them twice
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [bankSaved, setBankSaved] = useState(false);
  const [bank, setBank] = useState({ bankName: '', accountName: '', accountNumber: '' });
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newCategory, setNewCategory] = useState<FinancialCategory>({
    name: '',
    type: 'due',
    amount: '',
    frequency: 'monthly',
    description: '',
  });

  const addTemplate = (template: FinancialCategory) => {
    if (!categories.find(c => c.name === template.name)) {
      setCategories([...categories, { ...template }]);
    }
  };

  const addCustomCategory = () => {
    if (newCategory.name && newCategory.amount) {
      setCategories([...categories, { ...newCategory }]);
      setNewCategory({
        name: '',
        type: 'due',
        amount: '',
        frequency: 'monthly',
        description: '',
      });
      setShowForm(false);
    }
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const wantsBank = !!(bank.bankName.trim() || bank.accountName.trim() || bank.accountNumber.trim());
    if (wantsBank && !bankSaved) {
      if (bank.bankName.trim().length < 2 || bank.accountName.trim().length < 2) {
        setError('Enter the bank name and the account name, or clear the bank details.');
        return;
      }
      if (!/^[0-9]{10}$/.test(bank.accountNumber.trim())) {
        setError('The account number must be 10 digits.');
        return;
      }
    }

    setSaving(true);
    const problems: string[] = [];
    const saved = [...savedNames];
    try {
      for (const category of categories) {
        if (saved.includes(category.name)) continue;
        try {
          await api.post('/finance/categories', {
            name: category.name,
            type: category.type,
            amount: Number(category.amount),
            frequency: category.frequency,
            description: category.description || undefined,
          });
          saved.push(category.name);
        } catch (err) {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          problems.push(`${category.name}: ${message || 'could not be saved'}`);
        }
      }
      setSavedNames(saved);

      let bankDone = bankSaved;
      if (wantsBank && !bankSaved) {
        try {
          await api.post('/payments/nigerian/bank-accounts', {
            bankName: bank.bankName.trim(),
            accountName: bank.accountName.trim(),
            accountNumber: bank.accountNumber.trim(),
            isDefault: true,
          });
          bankDone = true;
          setBankSaved(true);
        } catch (err) {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          problems.push(`Bank account: ${message || 'could not be saved'}`);
        }
      }

      if (problems.length > 0) {
        setError(`Some things could not be saved. ${problems.join(' ')} Fix them and try again, or skip this step.`);
        return;
      }

      // Nothing entered at all counts as skipped, so the final checklist stays honest
      const didSomething = saved.length > 0 || bankDone;
      await api.patch(
        API_ROUTES.ONBOARDING.COMPLETE_STEP,
        didSomething ? { step: 4, stepName: 'finance' } : { step: 4, stepName: 'finance', skipped: true }
      );
      router.push('/onboarding/complete');
    } catch (err) {
      console.error('Failed to save finance settings:', err);
      setError('We could not save your finance settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep = async () => {
    try {
      await api.patch(
        API_ROUTES.ONBOARDING.COMPLETE_STEP,
        { step: 4, stepName: 'finance', skipped: true }
      );
      router.push('/onboarding/complete');
    } catch (error) {
      router.push('/onboarding/complete');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'due': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'levy': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'donation': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'penalty': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/onboarding')}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 flex items-center gap-2"
          >
            <ArrowLeftIcon /> Back to Overview
          </button>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 text-sm font-medium px-3 py-1 rounded-full">
              Step 4 of 5
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Configure Finances
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Set up your dues, levies, and other financial categories
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Quick Templates */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Add Templates</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {categoryTemplates.map((template, index) => {
                const isAdded = categories.find(c => c.name === template.name);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => addTemplate(template)}
                    disabled={!!isAdded}
                    className={`p-4 rounded-xl text-left transition-all ${
                      isAdded
                        ? 'bg-teal-50 dark:bg-teal-900/20 border-2 border-teal-200 dark:border-teal-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-teal-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(template.type)}`}>
                        {template.type}
                      </span>
                      {isAdded && <CheckIcon className="w-5 h-5 text-teal-500" />}
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{template.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ₦{Number(template.amount).toLocaleString()} / {template.frequency}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Category Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Custom Category</h3>
              {!showForm && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-2"
                >
                  <PlusIcon /> Add Custom
                </button>
              )}
            </div>

            {showForm && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Category Name *"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                  />
                  <select
                    value={newCategory.type}
                    onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="due">Due</option>
                    <option value="levy">Levy</option>
                    <option value="donation">Donation</option>
                    <option value="penalty">Penalty</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Amount (₦) *"
                    value={newCategory.amount}
                    onChange={(e) => setNewCategory({ ...newCategory, amount: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                  />
                  <select
                    value={newCategory.frequency}
                    onChange={(e) => setNewCategory({ ...newCategory, frequency: e.target.value })}
                    className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annually</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    disabled={!newCategory.name || !newCategory.amount}
                    className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                  >
                    Add Category
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected Categories */}
          {categories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Your Financial Categories ({categories.length})
              </h3>
              <div className="space-y-3">
                {categories.map((category, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(category.type)}`}>
                        {category.type}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          ₦{Number(category.amount).toLocaleString()} / {category.frequency}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCategory(index)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bank account members pay into */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Bank Account for Transfers</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Members will see this account when they pay by bank transfer. You can add it later in Payments.
            </p>
            {bankSaved ? (
              <p className="text-teal-600 dark:text-teal-400 font-medium">Saved: {bank.bankName} · {bank.accountNumber}</p>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Bank name"
                  aria-label="Bank name"
                  value={bank.bankName}
                  onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder="Account name"
                  aria-label="Account name"
                  value={bank.accountName}
                  onChange={(e) => setBank({ ...bank, accountName: e.target.value })}
                  className={inputClass}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Account number (10 digits)"
                  aria-label="Account number"
                  value={bank.accountNumber}
                  onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, '') })}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={handleSkipStep}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Skip this step
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
