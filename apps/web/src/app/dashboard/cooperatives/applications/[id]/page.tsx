'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Modal, Textarea, Select, Button, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconArrowLeft, IconFileAnalytics, IconUser, IconCurrencyNaira,
  IconCheck, IconX, IconCash, IconUsers
} from '@tabler/icons-react';
import { getLoanApplication, reviewLoanApplication, disburseLoan, getSavingsAccounts } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface LoanApplicationDetail {
  id: number;
  applicationNumber: string;
  amount: string;
  tenureMonths: number;
  purpose: string;
  status: string;
  monthlyRepayment: string;
  totalRepayment: string;
  totalInterest: string;
  processingFee: string;
  interestRate: string;
  interestType: string;
  collateralDescription?: string;
  reviewComments?: string;
  rejectionReason?: string;
  appliedAt: string;
  reviewedAt?: string;
  approvedAt?: string;
  memberId: number;
  memberName: string;
  loanProductId: number;
  loanProductName: string;
  guarantors: Array<{ id: number; status: string; guaranteeAmount: string; guarantorMemberId: number; guarantorName: string; declineReason?: string | null }>;
  reviewedBy?: number;
  approvedBy?: number;
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [application, setApplication] = useState<LoanApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [reviewOpened, { open: openReview, close: closeReview }] = useDisclosure(false);
  const [disburseOpened, { open: openDisburse, close: closeDisburse }] = useDisclosure(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewData, setReviewData] = useState({ comments: '', rejectionReason: '' });
  const [disburseData, setDisburseData] = useState({ disbursementMethod: 'bank_transfer', savingsAccountId: '', reference: '', notes: '' });
  // The borrower's open savings accounts, for paying the loan straight into savings.
  const [borrowerAccounts, setBorrowerAccounts] = useState<{ value: string; label: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (params.id) fetchApplication(); }, [params.id]);

  const fetchApplication = async () => {
    try {
      const result = await getLoanApplication(parseInt(params.id as string));
      setApplication(result.data);
    } catch (err: any) { toast.error(err.message); } finally { setIsLoading(false); }
  };

  const handleReview = async () => {
    if (reviewAction === 'reject' && !reviewData.rejectionReason) {
      toast.error('Please provide a rejection reason'); return;
    }
    setIsSubmitting(true);
    try {
      await reviewLoanApplication(application!.id, {
        action: reviewAction,
        comments: reviewData.comments || undefined,
        rejectionReason: reviewAction === 'reject' ? reviewData.rejectionReason : undefined
      });
      toast.success(`Application ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      closeReview();
      fetchApplication();
    } catch (err: any) { toast.error(err.message); } finally { setIsSubmitting(false); }
  };

  const openDisburseModal = async () => {
    openDisburse();
    try {
      const result = await getSavingsAccounts({ memberId: application!.memberId, status: 'ACTIVE', limit: 50 });
      const accounts: { id: number; accountNumber: string }[] = result.data?.accounts ?? [];
      setBorrowerAccounts(accounts.map((a) => ({ value: String(a.id), label: a.accountNumber })));
    } catch {
      setBorrowerAccounts([]);
    }
  };

  const handleDisburse = async () => {
    if (disburseData.disbursementMethod === 'savings_credit' && !disburseData.savingsAccountId) {
      toast.error("Choose the member's savings account to credit");
      return;
    }
    setIsSubmitting(true);
    try {
      await disburseLoan(application!.id, {
        disbursementMethod: disburseData.disbursementMethod,
        savingsAccountId: disburseData.disbursementMethod === 'savings_credit' ? Number(disburseData.savingsAccountId) : undefined,
        reference: disburseData.reference || undefined,
        notes: disburseData.notes || undefined
      });
      toast.success('Loan disbursed successfully');
      closeDisburse();
      fetchApplication();
    } catch (err: any) { toast.error(err.message); } finally { setIsSubmitting(false); }
  };

  const openReviewModal = (action: 'approve' | 'reject') => { setReviewAction(action); openReview(); };
  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW': return 'yellow'; case 'UNDER_REVIEW': return 'blue'; case 'APPROVED': return 'green';
      case 'REJECTED': return 'red'; case 'DISBURSED': return 'teal'; case 'CANCELLED': return 'gray'; default: return 'gray';
    }
  };

  const getGuarantorStatusColor = (status: string) => {
    switch (status) { case 'PENDING': return 'yellow'; case 'ACCEPTED': return 'green'; case 'DECLINED': return 'red'; default: return 'gray'; }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><div className="text-gray-600 dark:text-gray-400">Loading application...</div></div>;
  if (!application) return <div className="flex items-center justify-center min-h-[400px]"><div className="text-red-600">Application not found</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><IconArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{application.applicationNumber}</h1>
            <Badge color={getStatusColor(application.status)} size="lg">{application.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="text-gray-500">Submitted on {formatDate(application.appliedAt)}</p>
        </div>
        {application.status === 'PENDING_REVIEW' && (
          <div className="flex gap-2">
            <Button color="red" variant="outline" leftSection={<IconX size={16} />} onClick={() => openReviewModal('reject')}>Reject</Button>
            <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => openReviewModal('approve')}>Approve</Button>
          </div>
        )}
        {application.status === 'APPROVED' && (
          <Button color="teal" leftSection={<IconCash size={16} />} onClick={openDisburseModal}>Disburse Loan</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Loan Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><IconFileAnalytics size={20} />Loan Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">Loan Product</p><p className="font-medium">{application.loanProductName || 'N/A'}</p></div>
              <div><p className="text-sm text-gray-500">Interest Rate</p><p className="font-medium">{application.interestRate || '0'}% ({application.interestType || 'N/A'})</p></div>
              <div><p className="text-sm text-gray-500">Principal Amount</p><p className="text-xl font-bold text-blue-600">{formatCurrency(application.amount)}</p></div>
              <div><p className="text-sm text-gray-500">Tenure</p><p className="font-medium">{application.tenureMonths} months</p></div>
              <div><p className="text-sm text-gray-500">Interest Amount</p><p className="font-medium">{formatCurrency(application.totalInterest || 0)}</p></div>
              <div><p className="text-sm text-gray-500">Processing Fee</p><p className="font-medium">{formatCurrency(application.processingFee || 0)}</p></div>
              <div><p className="text-sm text-gray-500">Total Repayment</p><p className="text-xl font-bold text-green-600">{formatCurrency(application.totalRepayment || 0)}</p></div>
              <div><p className="text-sm text-gray-500">Monthly Repayment</p><p className="font-medium">{formatCurrency(application.monthlyRepayment || 0)}</p></div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">Purpose</p>
              <p className="mt-1">{application.purpose}</p>
            </div>
            {application.collateralDescription && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Collateral</p>
                <p className="mt-1">{application.collateralDescription}</p>
              </div>
            )}
          </div>

          {/* Guarantors */}
          {application.guarantors && application.guarantors.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><IconUsers size={20} />Guarantors</h2>
              <div className="space-y-3">
                {application.guarantors.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium">{g.guarantorName || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">Guarantor ID: {g.guarantorMemberId || 'N/A'}</p>
                      {g.status === 'DECLINED' && g.declineReason && <p className="text-sm text-red-600">Reason: {g.declineReason}</p>}
                    </div>
                    <div className="text-right">
                      <Badge color={getGuarantorStatusColor(g.status)}>{g.status}</Badge>
                      <p className="text-sm font-medium mt-1">{formatCurrency(g.guaranteeAmount || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applicant Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><IconUser size={20} />Applicant</h2>
            <div className="space-y-3">
              <div><p className="text-sm text-gray-500">Name</p><p className="font-medium">{application.memberName || 'Unknown'}</p></div>
              <div><p className="text-sm text-gray-500">Member ID</p><p className="font-medium">{application.memberId || 'N/A'}</p></div>
            </div>
          </div>

          {/* Review Info */}
          {(application.reviewedAt || application.rejectionReason) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review Info</h2>
              <div className="space-y-3">
                {application.reviewedAt && <div><p className="text-sm text-gray-500">Reviewed On</p><p className="font-medium">{formatDate(application.reviewedAt)}</p></div>}
                {application.reviewedBy && <div><p className="text-sm text-gray-500">Reviewed By</p><p className="font-medium">User #{application.reviewedBy}</p></div>}
                {application.rejectionReason && <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"><p className="text-sm text-red-600 font-medium">Rejection Reason</p><p className="mt-1 text-red-700 dark:text-red-300">{application.rejectionReason}</p></div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <Modal opened={reviewOpened} onClose={closeReview} title={reviewAction === 'approve' ? 'Approve Application' : 'Reject Application'} size="md">
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium">{application.memberName || 'Unknown'}</p>
            <p className="text-sm text-gray-500">{application.loanProductName || 'Loan'} • {formatCurrency(application.amount)}</p>
          </div>
          <Textarea label="Comments" placeholder="Add review comments (optional)" value={reviewData.comments} onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })} />
          {reviewAction === 'reject' && <Textarea label="Rejection Reason" placeholder="Explain why this application is being rejected" value={reviewData.rejectionReason} onChange={(e) => setReviewData({ ...reviewData, rejectionReason: e.target.value })} required />}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeReview}>Cancel</Button>
            <Button onClick={handleReview} loading={isSubmitting} color={reviewAction === 'approve' ? 'green' : 'red'}>{reviewAction === 'approve' ? 'Approve' : 'Reject'}</Button>
          </div>
        </div>
      </Modal>

      {/* Disburse Modal */}
      <Modal opened={disburseOpened} onClose={closeDisburse} title="Disburse Loan" size="md">
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="font-medium">{application.memberName || 'Unknown'}</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(application.amount)}</p>
          </div>
          <Select label="Disbursement Method" data={[{ value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'savings_credit', label: 'Credit to savings account' }]} value={disburseData.disbursementMethod} onChange={(v) => setDisburseData({ ...disburseData, disbursementMethod: v || 'bank_transfer' })} />
          {disburseData.disbursementMethod === 'savings_credit' && (
            <Select
              label="Savings account to credit"
              placeholder={borrowerAccounts.length === 0 ? 'This member has no open savings account' : 'Choose an account'}
              data={borrowerAccounts}
              value={disburseData.savingsAccountId}
              onChange={(v) => setDisburseData({ ...disburseData, savingsAccountId: v || '' })}
            />
          )}
          <Textarea label="Reference" placeholder="Transaction reference (optional)" value={disburseData.reference} onChange={(e) => setDisburseData({ ...disburseData, reference: e.target.value })} />
          <Textarea label="Notes" placeholder="Additional notes (optional)" value={disburseData.notes} onChange={(e) => setDisburseData({ ...disburseData, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeDisburse}>Cancel</Button>
            <Button onClick={handleDisburse} loading={isSubmitting} color="teal">Disburse Loan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
