'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, Textarea, Button, Checkbox, Badge, FileInput, Alert } from '@mantine/core';
import { IconCreditCard, IconBuildingBank, IconCheck, IconArrowLeft, IconUpload, IconInfoCircle } from '@tabler/icons-react';
import { apiGet, apiPost, apiPostFormData } from '@/utils/api';
import { toast } from '@/lib/toast';
import { HelpLink } from '@/components/docs/HelpLink';

interface OutstandingItem {
  id: number;
  type: 'dues' | 'levy' | 'penalty';
  category: { name: string };
  amount: number;
  balance: number;
  dueDate?: string;
  campaign?: { name: string };
}

interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
}

// R7.2 (G17): lowercase values matching the canonical 6-value set the backend
// actually validates against (member-finance.controller.ts's memberPaymentMethodSchema).
const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card Payment' },
  { value: 'mobile_money', label: 'Mobile Money / POS' },
];

export default function MakePaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('transactionId');

  const [outstandingItems, setOutstandingItems] = useState<OutstandingItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [declarationNote, setDeclarationNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => { fetchOutstanding(); fetchBankAccounts(); }, []);

  useEffect(() => {
    if (preselectedId && outstandingItems.length > 0) {
      const id = parseInt(preselectedId);
      if (outstandingItems.find(item => item.id === id)) {
        setSelectedItems([id]);
      }
    }
  }, [preselectedId, outstandingItems]);

  const fetchOutstanding = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/outstanding`);
      if (!response.ok) throw new Error('Failed to fetch outstanding items');
      const result = await response.json();
      setOutstandingItems(result.data.items || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load outstanding items');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/bank-accounts`);
      if (response.ok) {
        const result = await response.json();
        setBankAccounts(result.data.accounts || []);
      }
    } catch {
      // bank accounts are optional — page still functions without them
    }
  };

  const toggleItem = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === outstandingItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(outstandingItems.map(item => item.id));
    }
  };

  const getTotalSelected = () => {
    return outstandingItems
      .filter(item => selectedItems.includes(item.id))
      .reduce((sum, item) => sum + item.balance, 0);
  };

  const isBankTransfer = paymentMethod === 'bank_transfer';

  const handlePayment = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to pay');
      return;
    }

    if (isBankTransfer && !proofFile) {
      toast.error('Please upload a receipt or screenshot of the transfer');
      return;
    }

    if (!isBankTransfer && declarationNote.trim().length < 20) {
      toast.error('Please describe the payment in more detail (at least 20 characters) — who it was paid to, when, and the circumstances');
      return;
    }

    setIsSubmitting(true);
    try {
      let response: Response;

      if (isBankTransfer) {
        const formData = new FormData();
        formData.append('transactionIds', JSON.stringify(selectedItems));
        formData.append('paymentMethod', paymentMethod);
        if (reference) formData.append('notes', reference);
        formData.append('file', proofFile as File);

        response = await apiPostFormData(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/nigerian/proofs`, formData);
      } else {
        response = await apiPost(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/pay`, {
          transactionIds: selectedItems,
          paymentMethod,
          declarationNote,
          reference: reference || undefined,
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Submission failed');
      }

      toast.success('Submitted for verification — it will show as paid once an officer reviews it.');
      router.push('/dashboard/my-finances/payments');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dues': return 'blue';
      case 'levy': return 'purple';
      case 'penalty': return 'red';
      default: return 'gray';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
            Make Payment
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Select items to pay, then submit evidence for an officer to verify</p>
        </div>
        <HelpLink />
      </div>

      {outstandingItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All Paid Up!</h3>
          <p className="text-gray-500">You have no outstanding payments. Great job!</p>
          <Button onClick={() => router.push('/dashboard/my-finances')} className="mt-4">
            Back to My Finances
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items Selection */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Outstanding Items</h2>
                <Button variant="subtle" size="sm" onClick={selectAll}>
                  {selectedItems.length === outstandingItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="space-y-3">
                {outstandingItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedItems.includes(item.id)
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onChange={() => {}}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.campaign?.name || item.category.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge color={getTypeColor(item.type)} size="sm">{item.type}</Badge>
                            {item.dueDate && (
                              <span className="text-xs text-gray-500">Due: {formatDate(item.dueDate)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sticky top-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items Selected</span>
                  <span className="font-medium">{selectedItems.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700 pt-3">
                  <span>Total</span>
                  <span className="text-green-600">{formatCurrency(getTotalSelected())}</span>
                </div>
              </div>

              <div className="space-y-4">
                <Select
                  label="Payment Method"
                  data={PAYMENT_METHODS}
                  value={paymentMethod}
                  onChange={(v) => setPaymentMethod(v || 'bank_transfer')}
                  leftSection={<IconBuildingBank size={16} />}
                />

                {isBankTransfer ? (
                  <>
                    {bankAccounts.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Transfer to:</p>
                        {bankAccounts.map((acc) => (
                          <div key={acc.id} className="mb-2 last:mb-0">
                            <p className="text-blue-800 dark:text-blue-300">{acc.bankName}</p>
                            <p className="text-blue-800 dark:text-blue-300 font-mono">{acc.accountNumber}</p>
                            <p className="text-blue-700 dark:text-blue-400 text-xs">{acc.accountName}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <FileInput
                      label="Upload Receipt / Screenshot"
                      placeholder="Select a file"
                      accept="image/jpeg,image/png,image/gif,application/pdf"
                      leftSection={<IconUpload size={16} />}
                      value={proofFile}
                      onChange={setProofFile}
                      required
                    />

                    <Textarea
                      label="Reference (Optional)"
                      placeholder="Transaction reference or receipt number"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </>
                ) : (
                  <Textarea
                    label="Payment Declaration"
                    description="Who was paid, when, and the circumstances (e.g. a witness if paid in person)"
                    placeholder="e.g. Paid ₦5,000 cash to Treasurer Mrs. Adaeze at the October meeting on 12 Oct 2026, witnessed by..."
                    value={declarationNote}
                    onChange={(e) => setDeclarationNote(e.target.value)}
                    minRows={4}
                    required
                  />
                )}

                <Button
                  fullWidth
                  size="lg"
                  color="green"
                  onClick={handlePayment}
                  loading={isSubmitting}
                  disabled={selectedItems.length === 0}
                  leftSection={<IconCreditCard size={20} />}
                >
                  Submit {formatCurrency(getTotalSelected())} for Verification
                </Button>

                <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
                  This won't show as paid until an officer reviews and approves what you submit.
                </Alert>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
