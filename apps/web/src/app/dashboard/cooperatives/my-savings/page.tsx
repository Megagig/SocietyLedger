'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, NumberInput, TextInput, Textarea, FileInput, Button, Badge, Alert, CopyButton, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCurrencyNaira, IconWallet, IconArrowDownRight, IconTarget, IconLock,
  IconUpload, IconInfoCircle, IconCopy, IconCheck, IconReceipt
} from '@tabler/icons-react';
import {
  getMyCooperativeProfile, getSavingsDeposits, getSavingsTransactions,
  submitSavingsDeposit, getSavingsDepositReceiptUrl, type SavingsDeposit
} from '@/lib/api/cooperatives';
import { apiGet } from '@/utils/api';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import { HelpLink } from '@/components/docs/HelpLink';

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
  lockedSavings: string;
  availableSavings: string;
}

interface SavingsTransaction {
  id: number;
  savingsAccountId: number;
  type: string;
  amount: string;
  balanceAfter: string;
  createdAt: string;
  reference?: string | null;
}

interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyDeposit = { amount: '', paymentDate: todayISO(), reference: '', memberNote: '' };

export default function MySavingsPage() {
  const { can } = usePermissions();
  const canDeposit = can(PERMISSIONS.COOPERATIVE_SAVINGS_DEPOSIT_OWN);

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null);
  const [depositOpened, { open: openDeposit, close: closeDeposit }] = useDisclosure(false);
  const [depositData, setDepositData] = useState(emptyDeposit);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profileRes, depositsRes, txRes] = await Promise.all([
        getMyCooperativeProfile(),
        getSavingsDeposits({ limit: 20 }),
        getSavingsTransactions({ limit: 10 }),
      ]);
      setProfile(profileRes.data);
      setDeposits(depositsRes.data.deposits || []);
      setTransactions(txRes.data.transactions || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Bank accounts are optional context for the deposit form — the page works without them.
    apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/bank-accounts`)
      .then(async (res) => {
        if (res.ok) setBankAccounts((await res.json()).data.accounts || []);
      })
      .catch(() => undefined);
  }, [load]);

  const openDepositModal = (account: SavingsAccount) => {
    setSelectedAccount(account);
    setDepositData({ ...emptyDeposit, paymentDate: todayISO() });
    setReceipt(null);
    openDeposit();
  };

  const handleSubmitDeposit = async () => {
    if (!selectedAccount) return;
    const amount = parseFloat(depositData.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter the amount you paid');
      return;
    }
    if (!receipt) {
      toast.error('Attach your bank receipt (a photo or PDF)');
      return;
    }
    if (receipt.size > MAX_RECEIPT_BYTES) {
      toast.error('The receipt must be 5MB or smaller');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitSavingsDeposit({
        savingsAccountId: selectedAccount.id,
        amount,
        paymentDate: depositData.paymentDate,
        reference: depositData.reference || undefined,
        memberNote: depositData.memberNote || undefined,
        file: receipt,
      });
      toast.success('Deposit submitted. It will show in your savings once an officer confirms the payment.');
      closeDeposit();
      setSelectedAccount(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewReceipt = async (deposit: SavingsDeposit) => {
    try {
      const { url } = await getSavingsDepositReceiptUrl(deposit.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const accountStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'DORMANT': return 'yellow';
      case 'MATURED': return 'blue';
      default: return 'gray';
    }
  };

  const depositStatusColor = (status: SavingsDeposit['status']) =>
    status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'yellow';
  const depositStatusLabel = (status: SavingsDeposit['status']) =>
    status === 'APPROVED' ? 'Confirmed' : status === 'REJECTED' ? 'Not approved' : 'Awaiting confirmation';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your savings...</div>
      </div>
    );
  }

  const locked = Number(profile?.lockedSavings || 0);
  const pendingDeposits = deposits.filter((d) => d.status === 'PENDING');
  const pendingTotal = pendingDeposits.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Savings
        </h1>
          <HelpLink />
        </div>
        <p className="text-gray-600 dark:text-gray-400">Your cooperative savings accounts and deposits</p>
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
        {locked > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-white/30">
            <div>
              <p className="text-green-100 text-sm flex items-center gap-1"><IconLock size={14} /> Held against your loan</p>
              <p className="text-xl font-semibold">{formatCurrency(locked)}</p>
            </div>
            <div>
              <p className="text-green-100 text-sm">Available to you</p>
              <p className="text-xl font-semibold">{formatCurrency(profile?.availableSavings || 0)}</p>
            </div>
          </div>
        )}
      </div>

      {locked > 0 && (
        <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
          {formatCurrency(locked)} of your savings is held as security for your loan. It stays in your account and is released
          as you repay the loan.
        </Alert>
      )}

      {pendingDeposits.length > 0 && (
        <Alert icon={<IconInfoCircle size={18} />} color="yellow" variant="light">
          {pendingDeposits.length} deposit{pendingDeposits.length > 1 ? 's' : ''} ({formatCurrency(pendingTotal)}) waiting for an
          officer to confirm the payment. {pendingDeposits.length > 1 ? 'They' : 'It'} will be added to your savings once confirmed.
        </Alert>
      )}

      {/* Savings Accounts */}
      {!profile?.savingsAccounts.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconWallet size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Savings Accounts</h3>
          <p className="text-gray-500">You don&apos;t have any savings accounts yet. Contact your association admin to open one.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profile.savingsAccounts.map((account) => (
            <div key={account.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${account.accountType === 'TARGET' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {account.accountType === 'TARGET' ? <IconTarget size={20} /> : <IconWallet size={20} />}
                  </div>
                  <div>
                    <p className="font-mono text-sm text-gray-500">{account.accountNumber}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{account.accountType.replace(/_/g, ' ')} Savings</p>
                  </div>
                </div>
                <Badge color={accountStatusColor(account.status)}>{account.status}</Badge>
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

              {account.status === 'ACTIVE' && canDeposit && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button fullWidth color="green" leftSection={<IconArrowDownRight size={16} />} onClick={() => openDepositModal(account)}>
                    Make a Deposit
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Deposits I have declared */}
      {deposits.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">My Deposits</h2>
            <p className="text-sm text-gray-500">A deposit is added to your savings only after an officer confirms the payment.</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {deposits.map((deposit) => (
              <div key={deposit.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(deposit.amount)}</p>
                  <p className="text-sm text-gray-500">
                    Paid {formatDate(deposit.paymentDate)} · Account {deposit.accountNumber}
                    {deposit.reference ? ` · Ref ${deposit.reference}` : ''}
                  </p>
                  {deposit.status === 'REJECTED' && deposit.rejectionReason && (
                    <p className="text-sm text-red-600 mt-1">Reason: {deposit.rejectionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={depositStatusColor(deposit.status)}>{depositStatusLabel(deposit.status)}</Badge>
                  {deposit.hasReceipt && (
                    <Button variant="subtle" size="xs" leftSection={<IconReceipt size={14} />} onClick={() => viewReceipt(deposit)}>
                      Receipt
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((tx) => {
              const isCredit = ['DEPOSIT', 'INTEREST', 'TRANSFER_IN'].includes(tx.type);
              return (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{tx.type.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-gray-500">{formatDate(tx.createdAt)}{tx.reference ? ` · ${tx.reference}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                      {isCredit ? '+' : '−'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-gray-500">Balance {formatCurrency(tx.balanceAfter)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      <Modal opened={depositOpened} onClose={closeDeposit} title="Make a Deposit" size="md">
        <div className="space-y-4">
          {selectedAccount && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-500">Saving into</p>
              <p className="font-medium">{selectedAccount.accountNumber}</p>
              <p className="text-lg font-semibold text-green-600 mt-1">Balance: {formatCurrency(selectedAccount.balance)}</p>
            </div>
          )}

          <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
            <ol className="list-decimal pl-4 space-y-1 text-sm">
              <li>Pay the amount into the cooperative&apos;s bank account.</li>
              <li>Fill in the amount and attach your bank receipt below.</li>
              <li>An officer confirms the money arrived, then it is added to your savings.</li>
            </ol>
          </Alert>

          {bankAccounts.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Your association hasn&apos;t added a bank account yet. Ask an officer for the payment details.
            </p>
          )}
          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pay into</p>
              {bankAccounts.map((bank) => (
                <div key={bank.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{bank.bankName}</p>
                    <p className="text-gray-500">{bank.accountName}</p>
                    <p className="font-mono">{bank.accountNumber}</p>
                  </div>
                  <CopyButton value={bank.accountNumber} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy account number'}>
                        <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label="Copy account number">
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </div>
              ))}
            </div>
          )}

          <NumberInput
            label="Amount you paid"
            placeholder="Enter amount"
            leftSection={<IconCurrencyNaira size={16} />}
            value={depositData.amount ? parseFloat(depositData.amount) : ''}
            onChange={(v) => setDepositData({ ...depositData, amount: v?.toString() || '' })}
            thousandSeparator=","
            decimalScale={2}
            min={0}
            required
          />
          <TextInput
            type="date"
            label="Date of payment"
            value={depositData.paymentDate}
            max={todayISO()}
            onChange={(e) => setDepositData({ ...depositData, paymentDate: e.target.value })}
            required
          />
          <FileInput
            label="Bank receipt"
            description="A photo or PDF of your transfer receipt (max 5MB)"
            placeholder="Choose a file"
            leftSection={<IconUpload size={16} />}
            accept="image/jpeg,image/png,image/gif,application/pdf"
            value={receipt}
            onChange={setReceipt}
            clearable
            required
          />
          <TextInput
            label="Transfer reference (optional)"
            placeholder="Reference on your receipt"
            value={depositData.reference}
            onChange={(e) => setDepositData({ ...depositData, reference: e.target.value })}
          />
          <Textarea
            label="Note (optional)"
            placeholder="Anything the officer should know"
            value={depositData.memberNote}
            onChange={(e) => setDepositData({ ...depositData, memberNote: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeDeposit}>Cancel</Button>
            <Button onClick={handleSubmitDeposit} loading={isSubmitting} color="green">Submit Deposit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
