'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, NumberInput, Select, Textarea, Button, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconCurrencyNaira, IconWallet, IconArrowUpRight, IconArrowDownRight,
  IconTrendingUp, IconTarget
} from '@tabler/icons-react';
import { getMyCooperativeProfile, processSavingsTransaction } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface SavingsAccount {
  id: number;
  accountNumber: string;
  accountType: string;
  balance: string;
  status: string;
  targetAmount?: string;
  monthlyContribution?: string;
  totalDeposits: string;
  totalWithdrawals: string;
  accruedInterest: string;
  openedAt: string;
}

interface MemberProfile {
  memberId: number;
  memberName: string;
  savingsAccounts: SavingsAccount[];
  totalSavings: string;
}

export default function MySavingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null);
  const [transactionOpened, { open: openTransaction, close: closeTransaction }] = useDisclosure(false);
  const [transactionType, setTransactionType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [transactionData, setTransactionData] = useState({ amount: '', paymentMethod: 'CASH', reference: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const result = await getMyCooperativeProfile();
      setProfile(result.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
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
        type: transactionType,
        amount: parseFloat(transactionData.amount),
        paymentMethod: transactionData.paymentMethod,
        reference: transactionData.reference || undefined,
        notes: transactionData.notes || undefined
      });
      toast.success(`${transactionType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} processed successfully`);
      closeTransaction();
      setTransactionData({ amount: '', paymentMethod: 'CASH', reference: '', notes: '' });
      setSelectedAccount(null);
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTransactionModal = (account: SavingsAccount, type: 'DEPOSIT' | 'WITHDRAWAL') => {
    setSelectedAccount(account);
    setTransactionType(type);
    openTransaction();
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'DORMANT': return 'yellow';
      case 'MATURED': return 'blue';
      case 'CLOSED': return 'gray';
      default: return 'gray';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TARGET': return <IconTarget size={20} />;
      default: return <IconWallet size={20} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your savings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Savings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">View and manage your savings accounts</p>
      </div>

      {/* Total Savings Card */}
      <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100">Total Savings Balance</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(profile?.totalSavings || 0)}</p>
            <p className="text-green-100 mt-1">{profile?.savingsAccounts.length || 0} account(s)</p>
          </div>
          <div className="p-4 bg-white/20 rounded-full">
            <IconCurrencyNaira size={40} />
          </div>
        </div>
      </div>

      {/* Savings Accounts */}
      {!profile?.savingsAccounts.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconWallet size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Savings Accounts</h3>
          <p className="text-gray-500">You don't have any savings accounts yet. Contact your association admin to open one.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profile.savingsAccounts.map((account) => (
            <div key={account.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${account.accountType === 'TARGET' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {getTypeIcon(account.accountType)}
                  </div>
                  <div>
                    <p className="font-mono text-sm text-gray-500">{account.accountNumber}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{account.accountType.replace(/_/g, ' ')} Savings</p>
                  </div>
                </div>
                <Badge color={getStatusColor(account.status)}>{account.status}</Badge>
              </div>

              <div className="text-center py-4 border-y border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(account.balance)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-gray-500">Total Deposits</p>
                  <p className="font-medium text-green-600">{formatCurrency(account.totalDeposits)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Withdrawals</p>
                  <p className="font-medium text-red-600">{formatCurrency(account.totalWithdrawals)}</p>
                </div>
                {account.accountType === 'TARGET' && account.targetAmount && (
                  <>
                    <div>
                      <p className="text-gray-500">Target Amount</p>
                      <p className="font-medium">{formatCurrency(account.targetAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Progress</p>
                      <p className="font-medium">{((Number(account.balance) / Number(account.targetAmount)) * 100).toFixed(1)}%</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-gray-500">Interest Earned</p>
                  <p className="font-medium text-blue-600">{formatCurrency(account.accruedInterest)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Opened</p>
                  <p className="font-medium">{formatDate(account.openedAt)}</p>
                </div>
              </div>

              {account.status === 'ACTIVE' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button fullWidth color="green" leftSection={<IconArrowDownRight size={16} />} onClick={() => openTransactionModal(account, 'DEPOSIT')}>
                    Deposit
                  </Button>
                  <Button fullWidth color="red" variant="outline" leftSection={<IconArrowUpRight size={16} />} onClick={() => openTransactionModal(account, 'WITHDRAWAL')}>
                    Withdraw
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {/* Transaction Modal */}
      <Modal opened={transactionOpened} onClose={closeTransaction} title={transactionType === 'DEPOSIT' ? 'Make a Deposit' : 'Request Withdrawal'} size="md">
        <div className="space-y-4">
          {selectedAccount && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-500">Account</p>
              <p className="font-medium">{selectedAccount.accountNumber}</p>
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
              { value: 'CHEQUE', label: 'Cheque' }
            ]}
            value={transactionData.paymentMethod}
            onChange={(v) => setTransactionData({ ...transactionData, paymentMethod: v || 'CASH' })}
          />
          <Textarea
            label="Reference / Notes"
            placeholder="Optional reference or notes"
            value={transactionData.notes}
            onChange={(e) => setTransactionData({ ...transactionData, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeTransaction}>Cancel</Button>
            <Button onClick={handleTransaction} loading={isSubmitting} color={transactionType === 'DEPOSIT' ? 'green' : 'red'}>
              {transactionType === 'DEPOSIT' ? 'Confirm Deposit' : 'Request Withdrawal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
