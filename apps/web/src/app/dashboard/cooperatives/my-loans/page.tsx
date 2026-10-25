'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, NumberInput, Select, Textarea, TextInput, FileInput, Button, Badge, Progress, Alert, CopyButton, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconWallet, IconCurrencyNaira, IconCalendar, IconAlertTriangle,
  IconCheck, IconClock, IconUpload, IconInfoCircle, IconCopy, IconReceipt
} from '@tabler/icons-react';
import {
  getMyCooperativeProfile, processLoanRepayment, submitLoanRepaymentRequest, getLoanRepaymentRequests,
  getLoanRepaymentReceiptUrl, type LoanRepaymentRequest
} from '@/lib/api/cooperatives';
import { apiGet } from '@/utils/api';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { HelpLink } from '@/components/docs/HelpLink';

interface Loan {
  id: number;
  loanNumber: string;
  principalAmount: string;
  totalRepayment: string;
  totalPaid: string;
  outstandingBalance: string;
  monthlyRepayment: string;
  nextPaymentDate: string;
  nextPaymentAmount: string;
  status: string;
  disbursedAt: string;
  maturityDate: string;
  loanProduct: { name: string };
  repaymentSchedule?: any[];
}

interface MemberProfile {
  memberId: number;
  memberName: string;
  activeLoans: Loan[];
  totalOutstandingLoans: string;
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
const emptyDeclaration = { amount: '', paymentDate: todayISO(), reference: '', memberNote: '' };

export default function MyLoansPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  // Recording a repayment moves money, so only an officer can do it directly. A member instead pays the
  // cooperative's bank account and declares the payment with a receipt; an officer confirms it.
  const { can } = usePermissions();
  const canRecordRepayment = can(PERMISSIONS.COOPERATIVE_LOANS_MANAGE);
  const canDeclareRepayment = can(PERMISSIONS.COOPERATIVE_REPAY_OWN);
  const [declareOpened, { open: openDeclare, close: closeDeclare }] = useDisclosure(false);
  const [declaration, setDeclaration] = useState(emptyDeclaration);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [requests, setRequests] = useState<LoanRepaymentRequest[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [repaymentOpened, { open: openRepayment, close: closeRepayment }] = useDisclosure(false);
  const [repaymentData, setRepaymentData] = useState({ amount: '', paymentMethod: 'CASH', reference: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProfile();
    // Bank accounts are optional context for the declaration form — the page works without them.
    apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/me/bank-accounts`)
      .then(async (res) => {
        if (res.ok) setBankAccounts((await res.json()).data.accounts || []);
      })
      .catch(() => undefined);
  }, []);

  const fetchProfile = async () => {
    try {
      const [result, requestsRes] = await Promise.all([
        getMyCooperativeProfile(),
        getLoanRepaymentRequests({ limit: 20 }),
      ]);
      setProfile(result.data);
      setRequests(requestsRes.data.repaymentRequests || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepayment = async () => {
    if (!selectedLoan || !repaymentData.amount) {
      toast.error('Please enter an amount');
      return;
    }
    setIsSubmitting(true);
    try {
      await processLoanRepayment({
        loanId: selectedLoan.id,
        amount: parseFloat(repaymentData.amount),
        paymentMethod: repaymentData.paymentMethod,
        reference: repaymentData.reference || undefined,
        notes: repaymentData.notes || undefined
      });
      toast.success('Repayment processed successfully');
      closeRepayment();
      setRepaymentData({ amount: '', paymentMethod: 'CASH', reference: '', notes: '' });
      setSelectedLoan(null);
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startDeclare = (loan: Loan, suggestedAmount?: string) => {
    setSelectedLoan(loan);
    setDeclaration({ ...emptyDeclaration, paymentDate: todayISO(), amount: suggestedAmount ? String(parseFloat(suggestedAmount)) : '' });
    setReceipt(null);
    openDeclare();
  };

  const handleDeclare = async () => {
    if (!selectedLoan) return;
    const amount = parseFloat(declaration.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter the amount you paid');
      return;
    }
    if (amount > Number(selectedLoan.outstandingBalance)) {
      toast.error('That is more than you still owe on this loan');
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
      await submitLoanRepaymentRequest({
        loanId: selectedLoan.id,
        amount,
        paymentDate: declaration.paymentDate,
        reference: declaration.reference || undefined,
        memberNote: declaration.memberNote || undefined,
        file: receipt,
      });
      toast.success('Payment submitted. It will be recorded once an officer confirms it.');
      closeDeclare();
      setSelectedLoan(null);
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewReceipt = async (request: LoanRepaymentRequest) => {
    try {
      const { url } = await getLoanRepaymentReceiptUrl(request.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const requestStatusColor = (status: LoanRepaymentRequest['status']) =>
    status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'yellow';
  const requestStatusLabel = (status: LoanRepaymentRequest['status']) =>
    status === 'APPROVED' ? 'Confirmed' : status === 'REJECTED' ? 'Not approved' : 'Awaiting confirmation';

  /** A member declares a payment with a receipt; an officer can also record one directly. Others are told how to repay. */
  const renderPayActions = (loan: Loan, color: 'green' | 'red', suggestedAmount?: string) => {
    if (!canDeclareRepayment && !canRecordRepayment) {
      return (
        <p className="text-xs sm:text-sm text-gray-500 sm:max-w-xs">
          Pay into the cooperative&apos;s bank account and give your receipt to an officer, who will record it.
        </p>
      );
    }
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        {canDeclareRepayment && (
          <Button color={color} onClick={() => startDeclare(loan, suggestedAmount)} className="w-full sm:w-auto">
            Pay Now
          </Button>
        )}
        {canRecordRepayment && (
          <Button
            color={color}
            variant={canDeclareRepayment ? 'outline' : 'filled'}
            onClick={() => { setSelectedLoan(loan); setRepaymentData({ ...repaymentData, amount: suggestedAmount ?? '' }); openRepayment(); }}
            className="w-full sm:w-auto"
          >
            Record Payment
          </Button>
        )}
      </div>
    );
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'blue';
      case 'OVERDUE': return 'red';
      case 'PAID_OFF': return 'green';
      case 'DEFAULTED': return 'red';
      default: return 'gray';
    }
  };

  const getProgressPercent = (loan: Loan) => {
    const total = Number(loan.totalRepayment);
    const paid = Number(loan.totalPaid);
    return total > 0 ? (paid / total) * 100 : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your loans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Loans
          </h1>
            <HelpLink />
          </div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">View your loans and make repayments</p>
        </div>
        <Button onClick={() => router.push('/dashboard/cooperatives/apply')} leftSection={<IconWallet size={16} />} className="w-full sm:w-auto">
          Apply for Loan
        </Button>
      </div>

      {/* Outstanding Balance Card */}
      {profile?.totalOutstandingLoans && Number(profile.totalOutstandingLoans) > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm sm:text-base text-blue-100">Total Outstanding Balance</p>
              <p className="text-2xl sm:text-4xl font-bold mt-2">{formatCurrency(profile.totalOutstandingLoans)}</p>
              <p className="text-sm sm:text-base text-blue-100 mt-1">{profile.activeLoans?.length || 0} active loan(s)</p>
            </div>
            <div className="p-3 sm:p-4 bg-white/20 rounded-full">
              <IconWallet size={32} className="sm:hidden" />
              <IconWallet size={40} className="hidden sm:block" />
            </div>
          </div>
        </div>
      )}

      {/* Loans List */}
      {!profile?.activeLoans?.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Loans</h3>
          <p className="text-gray-500 mb-4">You don&apos;t have any active loans. Need funds? Apply for a loan today!</p>
          <Button onClick={() => router.push('/dashboard/cooperatives/apply')}>Apply for Loan</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {profile.activeLoans.map((loan) => (
            <div key={loan.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <p className="font-mono text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{loan.loanNumber}</p>
                    <Badge color={getStatusColor(loan.status)}>{loan.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-sm sm:text-base text-gray-500">{loan.loanProduct.name}</p>
                </div>
                {loan.status === 'OVERDUE' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <IconAlertTriangle size={18} />
                    <span className="text-sm sm:text-base font-medium">Payment Overdue</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Repayment Progress</span>
                  <span className="font-medium">{getProgressPercent(loan).toFixed(1)}%</span>
                </div>
                <Progress value={getProgressPercent(loan)} color={loan.status === 'OVERDUE' ? 'red' : 'blue'} size="lg" />
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-green-600">Paid: {formatCurrency(loan.totalPaid)}</span>
                  <span className="text-gray-500">of {formatCurrency(loan.totalRepayment)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 py-4 border-y border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Principal</p>
                  <p className="text-sm sm:text-base font-semibold">{formatCurrency(loan.principalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Outstanding</p>
                  <p className="text-sm sm:text-base font-semibold text-red-600">{formatCurrency(loan.outstandingBalance)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Monthly Payment</p>
                  <p className="text-sm sm:text-base font-semibold">{formatCurrency(loan.monthlyRepayment)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Maturity Date</p>
                  <p className="text-sm sm:text-base font-semibold">{formatDate(loan.maturityDate)}</p>
                </div>
              </div>

              {loan.nextPaymentDate && loan.status === 'ACTIVE' && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <IconCalendar className="text-blue-600 flex-shrink-0" size={20} />
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Next Payment Due</p>
                      <p className="text-sm sm:text-base font-medium">{formatDate(loan.nextPaymentDate)} - {formatCurrency(loan.nextPaymentAmount)}</p>
                    </div>
                  </div>
                  {renderPayActions(loan, 'green', loan.nextPaymentAmount)}
                </div>
              )}

              {loan.status === 'OVERDUE' && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <IconAlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                    <div>
                      <p className="text-xs sm:text-sm text-red-600 font-medium">Payment Overdue!</p>
                      <p className="text-xs sm:text-sm text-gray-500">Please make a payment as soon as possible</p>
                    </div>
                  </div>
                  {renderPayActions(loan, 'red')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {/* Payments I have declared */}
      {requests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">My Payments</h2>
            <p className="text-sm text-gray-500">A payment counts towards your loan only after an officer confirms it.</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {requests.map((request) => (
              <div key={request.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(request.amount)}</p>
                  <p className="text-sm text-gray-500">
                    Paid {formatDate(request.paymentDate)} · Loan {request.loanNumber}
                    {request.reference ? ` · Ref ${request.reference}` : ''}
                  </p>
                  {request.status === 'REJECTED' && request.rejectionReason && (
                    <p className="text-sm text-red-600 mt-1">Reason: {request.rejectionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={requestStatusColor(request.status)}>{requestStatusLabel(request.status)}</Badge>
                  {request.hasReceipt && (
                    <Button variant="subtle" size="xs" leftSection={<IconReceipt size={14} />} onClick={() => viewReceipt(request)}>
                      Receipt
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Declare a payment (member) */}
      <Modal opened={declareOpened} onClose={closeDeclare} title="Pay Towards Your Loan" size="md">
        <div className="space-y-4">
          {selectedLoan && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-medium">{selectedLoan.loanNumber}</p>
              <p className="text-sm text-gray-500">{selectedLoan.loanProduct.name}</p>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-500">You still owe:</span>
                <span className="font-semibold text-red-600">{formatCurrency(selectedLoan.outstandingBalance)}</span>
              </div>
            </div>
          )}

          <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
            <ol className="list-decimal pl-4 space-y-1 text-sm">
              <li>Pay the amount into the cooperative&apos;s bank account.</li>
              <li>Fill in the amount and attach your bank receipt below.</li>
              <li>An officer confirms the money arrived, then it is recorded on your loan.</li>
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
            value={declaration.amount ? parseFloat(declaration.amount) : ''}
            onChange={(v) => setDeclaration({ ...declaration, amount: v?.toString() || '' })}
            thousandSeparator=","
            decimalScale={2}
            min={0}
            required
          />
          <TextInput
            type="date"
            label="Date of payment"
            value={declaration.paymentDate}
            max={todayISO()}
            onChange={(e) => setDeclaration({ ...declaration, paymentDate: e.target.value })}
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
            value={declaration.reference}
            onChange={(e) => setDeclaration({ ...declaration, reference: e.target.value })}
          />
          <Textarea
            label="Note (optional)"
            placeholder="Anything the officer should know"
            value={declaration.memberNote}
            onChange={(e) => setDeclaration({ ...declaration, memberNote: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeDeclare}>Cancel</Button>
            <Button onClick={handleDeclare} loading={isSubmitting} color="green">Submit Payment</Button>
          </div>
        </div>
      </Modal>

      {/* Repayment Modal (officers recording a payment directly) */}
      <Modal opened={repaymentOpened} onClose={closeRepayment} title="Record Loan Repayment" size="md">
        <div className="space-y-4">
          {selectedLoan && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-medium">{selectedLoan.loanNumber}</p>
              <p className="text-sm text-gray-500">{selectedLoan.loanProduct.name}</p>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-500">Outstanding:</span>
                <span className="font-semibold text-red-600">{formatCurrency(selectedLoan.outstandingBalance)}</span>
              </div>
            </div>
          )}
          <NumberInput
            label="Payment Amount"
            placeholder="Enter amount"
            leftSection={<IconCurrencyNaira size={16} />}
            value={repaymentData.amount ? parseFloat(repaymentData.amount) : ''}
            onChange={(v) => setRepaymentData({ ...repaymentData, amount: v?.toString() || '' })}
            thousandSeparator=","
            required
          />
          <Select
            label="Payment Method"
            data={[
              { value: 'CASH', label: 'Cash' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'SALARY_DEDUCTION', label: 'Salary Deduction' },
              { value: 'SAVINGS_DEDUCTION', label: 'Deduct from Savings' }
            ]}
            value={repaymentData.paymentMethod}
            onChange={(v) => setRepaymentData({ ...repaymentData, paymentMethod: v || 'CASH' })}
          />
          <Textarea
            label="Reference / Notes"
            placeholder="Optional reference or notes"
            value={repaymentData.notes}
            onChange={(e) => setRepaymentData({ ...repaymentData, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeRepayment}>Cancel</Button>
            <Button onClick={handleRepayment} loading={isSubmitting} color="green">
              Confirm Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
