'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, NumberInput, Select, Textarea, Button, Badge, Progress } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconWallet, IconCurrencyNaira, IconCalendar, IconAlertTriangle,
  IconCheck, IconClock
} from '@tabler/icons-react';
import { getMyCooperativeProfile, processLoanRepayment } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

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

export default function MyLoansPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [repaymentOpened, { open: openRepayment, close: closeRepayment }] = useDisclosure(false);
  const [repaymentData, setRepaymentData] = useState({ amount: '', paymentMethod: 'CASH', reference: '', notes: '' });
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Loans
          </h1>
          <p className="text-gray-600 dark:text-gray-400">View your loans and make repayments</p>
        </div>
        <Button onClick={() => router.push('/dashboard/cooperatives/apply')} leftSection={<IconWallet size={16} />}>
          Apply for Loan
        </Button>
      </div>

      {/* Outstanding Balance Card */}
      {profile?.totalOutstandingLoans && Number(profile.totalOutstandingLoans) > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Outstanding Balance</p>
              <p className="text-4xl font-bold mt-2">{formatCurrency(profile.totalOutstandingLoans)}</p>
              <p className="text-blue-100 mt-1">{profile.activeLoans?.length || 0} active loan(s)</p>
            </div>
            <div className="p-4 bg-white/20 rounded-full">
              <IconWallet size={40} />
            </div>
          </div>
        </div>
      )}

      {/* Loans List */}
      {!profile?.activeLoans?.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Loans</h3>
          <p className="text-gray-500 mb-4">You don't have any active loans. Need funds? Apply for a loan today!</p>
          <Button onClick={() => router.push('/dashboard/cooperatives/apply')}>Apply for Loan</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {profile.activeLoans.map((loan) => (
            <div key={loan.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{loan.loanNumber}</p>
                    <Badge color={getStatusColor(loan.status)}>{loan.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-gray-500">{loan.loanProduct.name}</p>
                </div>
                {loan.status === 'OVERDUE' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <IconAlertTriangle size={20} />
                    <span className="font-medium">Payment Overdue</span>
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm text-gray-500">Principal</p>
                  <p className="font-semibold">{formatCurrency(loan.principalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="font-semibold text-red-600">{formatCurrency(loan.outstandingBalance)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Monthly Payment</p>
                  <p className="font-semibold">{formatCurrency(loan.monthlyRepayment)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Maturity Date</p>
                  <p className="font-semibold">{formatDate(loan.maturityDate)}</p>
                </div>
              </div>

              {loan.nextPaymentDate && loan.status === 'ACTIVE' && (
                <div className="flex items-center justify-between mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <IconCalendar className="text-blue-600" size={20} />
                    <div>
                      <p className="text-sm text-gray-500">Next Payment Due</p>
                      <p className="font-medium">{formatDate(loan.nextPaymentDate)} - {formatCurrency(loan.nextPaymentAmount)}</p>
                    </div>
                  </div>
                  <Button color="green" onClick={() => { setSelectedLoan(loan); setRepaymentData({ ...repaymentData, amount: loan.nextPaymentAmount }); openRepayment(); }}>
                    Pay Now
                  </Button>
                </div>
              )}

              {loan.status === 'OVERDUE' && (
                <div className="flex items-center justify-between mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <IconAlertTriangle className="text-red-600" size={20} />
                    <div>
                      <p className="text-sm text-red-600 font-medium">Payment Overdue!</p>
                      <p className="text-sm text-gray-500">Please make a payment as soon as possible</p>
                    </div>
                  </div>
                  <Button color="red" onClick={() => { setSelectedLoan(loan); openRepayment(); }}>
                    Make Payment
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {/* Repayment Modal */}
      <Modal opened={repaymentOpened} onClose={closeRepayment} title="Make Loan Repayment" size="md">
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
