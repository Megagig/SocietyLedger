'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, TextInput, Select, NumberInput, Textarea, Button, Badge, Pagination } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconWallet, IconSearch, IconCurrencyNaira, IconEye, IconReceipt
} from '@tabler/icons-react';
import { getLoans, processLoanRepayment } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface Loan {
  id: number;
  loanNumber: string;
  principalAmount: string;
  outstandingBalance: string;
  status: string;
  disbursementDate: string;
  nextRepaymentDate?: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string };
  loanProduct: { name: string };
}

export default function LoansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [repaymentOpened, { open: openRepayment, close: closeRepayment }] = useDisclosure(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [repaymentData, setRepaymentData] = useState({
    amount: '', paymentMethod: 'CASH', reference: '', notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLoans();
    if (searchParams.get('action') === 'repayment') openRepayment();
  }, [page, statusFilter]);

  const fetchLoans = async () => {
    try {
      const result = await getLoans({
        page, limit: 10, status: statusFilter || undefined, search: search || undefined
      });
      setLoans(result.data.loans);
      setTotalPages(result.data.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); fetchLoans(); };

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
      fetchLoans();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRepaymentModal = (loan: Loan) => {
    setSelectedLoan(loan);
    openRepayment();
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'blue';
      case 'FULLY_PAID': return 'green';
      case 'OVERDUE': return 'red';
      case 'DEFAULTED': return 'red';
      case 'WRITTEN_OFF': return 'gray';
      default: return 'gray';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading loans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Active Loans
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage member loans and repayments</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <TextInput
              placeholder="Search by name or loan number..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex gap-3 sm:gap-4">
            <Select
              placeholder="Status"
              data={[
                { value: '', label: 'All Status' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'OVERDUE', label: 'Overdue' },
                { value: 'FULLY_PAID', label: 'Fully Paid' },
                { value: 'DEFAULTED', label: 'Defaulted' }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              className="flex-1 sm:flex-none sm:w-40"
            />
            <Button onClick={handleSearch} className="w-auto">Search</Button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {loans.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No loans found</div>
          ) : (
            loans.map((loan) => (
              <div key={loan.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <IconWallet className="text-blue-600" size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {loan.member.firstName} {loan.member.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{loan.member.membershipId}</p>
                    </div>
                  </div>
                  <Badge color={getStatusColor(loan.status)} size="sm">{loan.status.replace(/_/g, ' ')}</Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{loan.loanProduct.name}</span>
                  <span className="font-mono text-xs text-gray-400">{loan.loanNumber}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Principal</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatCurrency(loan.principalAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Outstanding</p>
                    <p className="font-semibold text-red-600 text-sm">{formatCurrency(loan.outstandingBalance)}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500">
                    Disbursed: {formatDate(loan.disbursementDate)}
                  </span>
                  <div className="flex gap-2">
                    {loan.status === 'ACTIVE' && (
                      <button
                        onClick={() => openRepaymentModal(loan)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg"
                      >
                        <IconCurrencyNaira size={14} /> Pay
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/cooperatives/loans/${loan.id}`)}
                      className="flex items-center gap-1 text-blue-600 text-sm"
                    >
                      <IconEye size={16} /> View
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Loan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Principal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loans.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No loans found</td></tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <IconWallet className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <span className="font-mono text-sm">{loan.loanNumber}</span>
                          <p className="text-xs text-gray-500">{formatDate(loan.disbursementDate)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{loan.member.firstName} {loan.member.lastName}</p>
                      <p className="text-sm text-gray-500">{loan.member.membershipId}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">{loan.loanProduct.name}</td>
                    <td className="px-6 py-4 font-medium">{formatCurrency(loan.principalAmount)}</td>
                    <td className="px-6 py-4 font-semibold text-red-600">{formatCurrency(loan.outstandingBalance)}</td>
                    <td className="px-6 py-4"><Badge color={getStatusColor(loan.status)}>{loan.status.replace(/_/g, ' ')}</Badge></td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {loan.status === 'ACTIVE' && (
                          <button onClick={() => openRepaymentModal(loan)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Record Repayment">
                            <IconCurrencyNaira size={18} />
                          </button>
                        )}
                        <button onClick={() => router.push(`/dashboard/cooperatives/loans/${loan.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="View Details">
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
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Repayment Modal */}
      <Modal opened={repaymentOpened} onClose={closeRepayment} title="Record Loan Repayment" size="md">
        <div className="space-y-4">
          {selectedLoan && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-500">Loan</p>
              <p className="font-medium">{selectedLoan.member.firstName} {selectedLoan.member.lastName}</p>
              <p className="text-sm text-gray-500">{selectedLoan.loanNumber} • {selectedLoan.loanProduct.name}</p>
              <p className="text-lg font-semibold text-red-600 mt-2">Outstanding: {formatCurrency(selectedLoan.outstandingBalance)}</p>
            </div>
          )}
          <NumberInput
            label="Amount"
            placeholder="Enter repayment amount"
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
              { value: 'SAVINGS_DEDUCTION', label: 'Savings Deduction' }
            ]}
            value={repaymentData.paymentMethod}
            onChange={(v) => setRepaymentData({ ...repaymentData, paymentMethod: v || 'CASH' })}
          />
          <TextInput
            label="Reference"
            placeholder="Transaction reference (optional)"
            value={repaymentData.reference}
            onChange={(e) => setRepaymentData({ ...repaymentData, reference: e.target.value })}
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={repaymentData.notes}
            onChange={(e) => setRepaymentData({ ...repaymentData, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeRepayment}>Cancel</Button>
            <Button onClick={handleRepayment} loading={isSubmitting} color="green">Record Repayment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
