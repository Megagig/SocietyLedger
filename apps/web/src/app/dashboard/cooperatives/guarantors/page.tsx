'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Badge, Textarea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUsers, IconCheck, IconX, IconCurrencyNaira } from '@tabler/icons-react';
import { getPendingGuarantorRequests, respondToGuarantorRequest } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface GuarantorRequest {
  id: number;
  status: string;
  guaranteedAmount: string;
  createdAt: string;
  loanApplication: {
    id: number;
    amount: string;
    purpose: string;
    member: { firstName: string; lastName: string; membershipId: string };
    loanProduct: { name: string };
  };
}

export default function GuarantorsPage() {
  const [requests, setRequests] = useState<GuarantorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [responseOpened, { open: openResponse, close: closeResponse }] = useDisclosure(false);
  const [selectedRequest, setSelectedRequest] = useState<GuarantorRequest | null>(null);
  const [responseAction, setResponseAction] = useState<'accept' | 'decline'>('accept');
  const [declineReason, setDeclineReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    try {
      const result = await getPendingGuarantorRequests();
      setRequests(result.data.requests || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponse = async () => {
    if (!selectedRequest) return;
    if (responseAction === 'decline' && !declineReason) {
      toast.error('Please provide a reason for declining');
      return;
    }
    setIsSubmitting(true);
    try {
      await respondToGuarantorRequest(selectedRequest.id, {
        action: responseAction,
        declineReason: responseAction === 'decline' ? declineReason : undefined
      });
      toast.success(`Request ${responseAction === 'accept' ? 'accepted' : 'declined'} successfully`);
      closeResponse();
      setSelectedRequest(null);
      setDeclineReason('');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResponseModal = (request: GuarantorRequest, action: 'accept' | 'decline') => {
    setSelectedRequest(request);
    setResponseAction(action);
    openResponse();
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading guarantor requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Guarantor Requests
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Review and respond to loan guarantor requests</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 sm:p-12 text-center">
          <IconUsers size={40} className="mx-auto text-gray-400 mb-4 sm:hidden" />
          <IconUsers size={48} className="mx-auto text-gray-400 mb-4 hidden sm:block" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">No Pending Requests</h3>
          <p className="text-sm sm:text-base text-gray-500">You don't have any pending guarantor requests at this time.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                    <IconUsers className="text-purple-600" size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                      {request.loanApplication.member.firstName} {request.loanApplication.member.lastName}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500">{request.loanApplication.member.membershipId}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs sm:text-sm"><span className="text-gray-500">Loan Product:</span> {request.loanApplication.loanProduct.name}</p>
                      <p className="text-xs sm:text-sm"><span className="text-gray-500">Loan Amount:</span> <span className="font-semibold">{formatCurrency(request.loanApplication.amount)}</span></p>
                      <p className="text-xs sm:text-sm"><span className="text-gray-500">Your Guarantee:</span> <span className="font-semibold text-purple-600">{formatCurrency(request.guaranteedAmount)}</span></p>
                      <p className="text-xs sm:text-sm line-clamp-2"><span className="text-gray-500">Purpose:</span> {request.loanApplication.purpose}</p>
                      <p className="text-xs sm:text-sm text-gray-500">Requested on {formatDate(request.createdAt)}</p>
                    </div>
                  </div>
                </div>
                <Badge color="yellow" className="self-start sm:self-auto">Pending</Badge>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" color="red" leftSection={<IconX size={16} />} onClick={() => openResponseModal(request, 'decline')} className="w-full sm:w-auto">
                  Decline
                </Button>
                <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => openResponseModal(request, 'accept')} className="w-full sm:w-auto">
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Response Modal */}
      <Modal opened={responseOpened} onClose={closeResponse} title={responseAction === 'accept' ? 'Accept Guarantor Request' : 'Decline Guarantor Request'} size="md">
        <div className="space-y-4">
          {selectedRequest && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-medium">{selectedRequest.loanApplication.member.firstName} {selectedRequest.loanApplication.member.lastName}</p>
              <p className="text-sm text-gray-500">{selectedRequest.loanApplication.loanProduct.name}</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-xs text-gray-500">Loan Amount</p>
                  <p className="font-semibold">{formatCurrency(selectedRequest.loanApplication.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Your Guarantee</p>
                  <p className="font-semibold text-purple-600">{formatCurrency(selectedRequest.guaranteedAmount)}</p>
                </div>
              </div>
            </div>
          )}
          {responseAction === 'accept' ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                By accepting, you agree to guarantee this loan. If the borrower defaults, you may be liable for the guaranteed amount.
              </p>
            </div>
          ) : (
            <Textarea
              label="Reason for Declining"
              placeholder="Please provide a reason..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              required
            />
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeResponse}>Cancel</Button>
            <Button onClick={handleResponse} loading={isSubmitting} color={responseAction === 'accept' ? 'green' : 'red'}>
              {responseAction === 'accept' ? 'Accept Request' : 'Decline Request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
