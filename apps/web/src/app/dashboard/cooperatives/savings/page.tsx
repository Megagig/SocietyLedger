'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, TextInput, Select, NumberInput, Textarea, Button, Badge, Pagination } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconCurrencyNaira, IconPlus, IconSearch, IconWallet,
  IconArrowUpRight, IconArrowDownRight, IconEye
} from '@tabler/icons-react';
import { 
  getSavingsAccounts, createSavingsAccount, processSavingsTransaction, getSavingsTransactions 
} from '@/lib/api/cooperatives';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';

interface SavingsAccount {
  id: number;
  accountNumber: string;
  accountType: string;
  balance: string;
  status: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string };
  targetAmount?: string;
  monthlyContribution?: string;
  createdAt: string;
}

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  membershipId: string;
}

export default function SavingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [transactionOpened, { open: openTransaction, close: closeTransaction }] = useDisclosure(false);
  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    memberId: '',
    accountType: 'REGULAR',
    targetAmount: '',
    monthlyContribution: '',
    notes: ''
  });
  const [transactionData, setTransactionData] = useState({
    type: 'DEPOSIT' as 'DEPOSIT' | 'WITHDRAWAL',
    amount: '',
    paymentMethod: 'CASH',
    reference: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchMembers();
    if (searchParams.get('action') === 'create') openCreate();
  }, [page, statusFilter, typeFilter]);

  const fetchAccounts = async () => {
    try {
      const result = await getSavingsAccounts({
        page,
        limit: 10,
        status: statusFilter || undefined,
        accountType: typeFilter || undefined,
        search: search || undefined
      });
      setAccounts(result.data.accounts);
      setTotalPages(result.data.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members?limit=1000`);
      if (response.ok) {
        const result = await response.json();
        setMembers(result.data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch members');
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchAccounts();
  };

  const handleCreateAccount = async () => {
    if (!formData.memberId) {
      toast.error('Please select a member');
      return;
    }
    setIsSubmitting(true);
    try {
      await createSavingsAccount({
        memberId: parseInt(formData.memberId),
        accountType: formData.accountType,
        targetAmount: formData.targetAmount ? parseFloat(formData.targetAmount) : undefined,
        monthlyContribution: formData.monthlyContribution ? parseFloat(formData.monthlyContribution) : undefined,
        notes: formData.notes || undefined
      });
      toast.success('Savings account created successfully');
      closeCreate();
      setFormData({ memberId: '', accountType: 'REGULAR', targetAmount: '', monthlyContribution: '', notes: '' });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransaction = async () => {
    if (!selectedAccount || !transactionData.amount) {
      toast.error('Please enter an amount');
      return;
    }
    setIsSubmitting(true);
    try {
      await processSavingsTransaction({
        savingsAccountId: selectedAccount.id,
        type: transactionData.type,
        amount: parseFloat(transactionData.amount),
        paymentMethod: transactionData.paymentMethod,
        reference: transactionData.reference || undefined,
        notes: transactionData.notes || undefined
      });
      toast.success(`${transactionData.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} processed successfully`);
      closeTransaction();
      setTransactionData({ type: 'DEPOSIT', amount: '', paymentMethod: 'CASH', reference: '', notes: '' });
      setSelectedAccount(null);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTransactionModal = (account: SavingsAccount, type: 'DEPOSIT' | 'WITHDRAWAL') => {
    setSelectedAccount(account);
    setTransactionData({ ...transactionData, type });
    openTransaction();
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'DORMANT': return 'yellow';
      case 'FROZEN': return 'blue';
      case 'CLOSED': return 'gray';
      default: return 'gray';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'REGULAR': return 'Regular Savings';
      case 'TARGET': return 'Target Savings';
      case 'FIXED': return 'Fixed Deposit';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading savings accounts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Member Savings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage savings accounts, deposits, and withdrawals
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all"
        >
          <IconPlus size={20} />
          Open Account
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <TextInput
              placeholder="Search by name or account number..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Select
            placeholder="Status"
            data={[
              { value: '', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'DORMANT', label: 'Dormant' },
              { value: 'FROZEN', label: 'Frozen' },
              { value: 'CLOSED', label: 'Closed' }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            className="w-40"
          />
          <Select
            placeholder="Type"
            data={[
              { value: '', label: 'All Types' },
              { value: 'REGULAR', label: 'Regular' },
              { value: 'TARGET', label: 'Target' },
              { value: 'FIXED', label: 'Fixed' }
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
            className="w-40"
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No savings accounts found
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <IconWallet className="text-green-600" size={20} />
                        </div>
                        <span className="font-mono text-sm">{account.accountNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {account.member.firstName} {account.member.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{account.member.membershipId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{getTypeLabel(account.accountType)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-green-600">{formatCurrency(account.balance)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={getStatusColor(account.status)}>{account.status}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openTransactionModal(account, 'DEPOSIT')}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                          title="Deposit"
                        >
                          <IconArrowDownRight size={18} />
                        </button>
                        <button
                          onClick={() => openTransactionModal(account, 'WITHDRAWAL')}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Withdraw"
                        >
                          <IconArrowUpRight size={18} />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/cooperatives/savings/${account.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="View Details"
                        >
                          <IconEye size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="Open Savings Account" size="md">
        <div className="space-y-4">
          <Select
            label="Member"
            placeholder="Select member"
            data={members.map(m => ({ value: m.id.toString(), label: `${m.firstName} ${m.lastName} (${m.membershipId})` }))}
            value={formData.memberId}
            onChange={(v) => setFormData({ ...formData, memberId: v || '' })}
            searchable
            required
          />
          <Select
            label="Account Type"
            data={[
              { value: 'REGULAR', label: 'Regular Savings' },
              { value: 'TARGET', label: 'Target Savings' },
              { value: 'FIXED', label: 'Fixed Deposit' }
            ]}
            value={formData.accountType}
            onChange={(v) => setFormData({ ...formData, accountType: v || 'REGULAR' })}
          />
          {formData.accountType === 'TARGET' && (
            <>
              <NumberInput
                label="Target Amount"
                placeholder="Enter target amount"
                leftSection={<IconCurrencyNaira size={16} />}
                value={formData.targetAmount ? parseFloat(formData.targetAmount) : ''}
                onChange={(v) => setFormData({ ...formData, targetAmount: v?.toString() || '' })}
                thousandSeparator=","
              />
              <NumberInput
                label="Monthly Contribution"
                placeholder="Enter monthly contribution"
                leftSection={<IconCurrencyNaira size={16} />}
                value={formData.monthlyContribution ? parseFloat(formData.monthlyContribution) : ''}
                onChange={(v) => setFormData({ ...formData, monthlyContribution: v?.toString() || '' })}
                thousandSeparator=","
              />
            </>
          )}
          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button onClick={handleCreateAccount} loading={isSubmitting}>Create Account</Button>
          </div>
        </div>
      </Modal>

      {/* Transaction Modal */}
      <Modal 
        opened={transactionOpened} 
        onClose={closeTransaction} 
        title={transactionData.type === 'DEPOSIT' ? 'Record Deposit' : 'Process Withdrawal'}
        size="md"
      >
        <div className="space-y-4">
          {selectedAccount && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-500">Account</p>
              <p className="font-medium">{selectedAccount.member.firstName} {selectedAccount.member.lastName}</p>
              <p className="text-sm text-gray-500">{selectedAccount.accountNumber}</p>
              <p className="text-lg font-semibold text-green-600 mt-2">Balance: {formatCurrency(selectedAccount.balance)}</p>
            </div>
          )}
          <NumberInput
            label="Amount"
            placeholder="Enter amount"
            leftSection={<IconCurrencyNaira size={16} />}
            value={transactionData.amount ? parseFloat(transactionData.amount) : ''}
            onChange={(v) => setTransactionData({ ...transactionData, amount: v?.toString() || '' })}
            thousandSeparator=","
            required
          />
          <Select
            label="Payment Method"
            data={[
              { value: 'CASH', label: 'Cash' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'CHEQUE', label: 'Cheque' },
              { value: 'POS', label: 'POS' }
            ]}
            value={transactionData.paymentMethod}
            onChange={(v) => setTransactionData({ ...transactionData, paymentMethod: v || 'CASH' })}
          />
          <TextInput
            label="Reference"
            placeholder="Transaction reference (optional)"
            value={transactionData.reference}
            onChange={(e) => setTransactionData({ ...transactionData, reference: e.target.value })}
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={transactionData.notes}
            onChange={(e) => setTransactionData({ ...transactionData, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeTransaction}>Cancel</Button>
            <Button 
              onClick={handleTransaction} 
              loading={isSubmitting}
              color={transactionData.type === 'DEPOSIT' ? 'green' : 'red'}
            >
              {transactionData.type === 'DEPOSIT' ? 'Record Deposit' : 'Process Withdrawal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
