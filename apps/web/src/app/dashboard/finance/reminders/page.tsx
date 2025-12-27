'use client';

import { useState, useEffect } from 'react';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost } from '@/utils/api';
import { 
  Mail, Users, DollarSign, AlertTriangle, Send, 
  CheckCircle, Clock, RefreshCw, Search
} from 'lucide-react';

interface MemberWithTransactions {
  member: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  transactions: Array<{
    id: number;
    referenceNumber: string;
    category: string;
    amount: number;
    balance: number;
    dueDate: string | null;
    status: string;
  }>;
  totalOutstanding: number;
  overdueCount: number;
}

interface ReminderSummary {
  totalMembers: number;
  totalOutstanding: number;
  totalTransactions: number;
  overdueTransactions: number;
}

export default function RemindersPage() {
  const [members, setMembers] = useState<MemberWithTransactions[]>([]);
  const [summary, setSummary] = useState<ReminderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  useEffect(() => {
    fetchMembers();
  }, [statusFilter]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/reminders/members?${params}`
      );

      if (!response.ok) throw new Error('Failed to fetch members');

      const data = await response.json();
      setMembers(data.data.members);
      setSummary(data.data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateOverdue = async () => {
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/reminders/update-overdue`
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      alert(data.message);
      fetchMembers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSelectMember = (memberId: number, transactions: number[]) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(prev => prev.filter(id => id !== memberId));
      setSelectedTransactions(prev => prev.filter(id => !transactions.includes(id)));
    } else {
      setSelectedMembers(prev => [...prev, memberId]);
      setSelectedTransactions(prev => [...prev, ...transactions]);
    }
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
      setSelectedTransactions([]);
    } else {
      const allMemberIds = filteredMembers.map(m => m.member.id);
      const allTxnIds = filteredMembers.flatMap(m => m.transactions.map(t => t.id));
      setSelectedMembers(allMemberIds);
      setSelectedTransactions(allTxnIds);
    }
  };

  const handleSendReminders = async () => {
    if (selectedTransactions.length === 0) {
      alert('Please select at least one member');
      return;
    }

    setIsSending(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/reminders/send`,
        {
          transactionIds: selectedTransactions,
          message: customMessage || undefined,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setSendResult(data.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    setCustomMessage('');
    setSendResult(null);
    if (sendResult) {
      setSelectedMembers([]);
      setSelectedTransactions([]);
    }
  };

  const filteredMembers = members.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.member.firstName.toLowerCase().includes(query) ||
      m.member.lastName.toLowerCase().includes(query) ||
      m.member.memberId.toLowerCase().includes(query) ||
      (m.member.email && m.member.email.toLowerCase().includes(query))
    );
  });

  const selectedTotal = filteredMembers
    .filter(m => selectedMembers.includes(m.member.id))
    .reduce((sum, m) => sum + m.totalOutstanding, 0);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            Payment Reminders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Send payment reminders to members with outstanding balances
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Can permission={PERMISSIONS.FINANCE_EDIT}>
            <button
              onClick={handleUpdateOverdue}
              className="flex items-center gap-2 text-orange-600 hover:text-orange-800 px-4 py-2 border border-orange-300 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Update Overdue
            </button>
          </Can>
          <button
            onClick={fetchMembers}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Members with Balance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.totalMembers || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Outstanding</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                ₦{(summary?.totalOutstanding || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Transactions</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {summary?.totalTransactions || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {summary?.overdueTransactions || 0}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Pending</option>
              <option value="overdue">Overdue Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            {selectedMembers.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedMembers.length} member(s) selected • ₦{selectedTotal.toLocaleString()}
              </div>
            )}
            
            <Can permission={PERMISSIONS.FINANCE_EDIT}>
              <button
                onClick={() => setShowSendModal(true)}
                disabled={selectedMembers.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Send Reminders
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Pending Payments
          </h3>
          <p className="text-gray-500">
            All members are up to date with their payments!
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Select All */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select All ({filteredMembers.length} members)
              </span>
            </label>
          </div>

          {/* Members */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredMembers.map(item => (
              <div
                key={item.member.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  selectedMembers.includes(item.member.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(item.member.id)}
                    onChange={() => handleSelectMember(item.member.id, item.transactions.map(t => t.id))}
                    className="mt-1 w-4 h-4 rounded border-gray-300"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {item.member.firstName} {item.member.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {item.member.memberId} • {item.member.email || 'No email'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">
                          ₦{item.totalOutstanding.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.transactions.length} transaction(s)
                          {item.overdueCount > 0 && (
                            <span className="text-red-600 ml-1">
                              ({item.overdueCount} overdue)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Transaction details */}
                    <div className="mt-2 space-y-1">
                      {item.transactions.slice(0, 3).map(txn => (
                        <div
                          key={txn.id}
                          className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded px-3 py-1"
                        >
                          <span className="text-gray-600 dark:text-gray-400">
                            {txn.category}
                            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                              txn.status === 'overdue' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            }`}>
                              {txn.status}
                            </span>
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ₦{txn.balance.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {item.transactions.length > 3 && (
                        <p className="text-xs text-gray-500 pl-3">
                          +{item.transactions.length - 3} more transaction(s)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            {sendResult ? (
              // Results view
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  Reminders Sent
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{sendResult.sent}</p>
                      <p className="text-sm text-gray-500">Sent</p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{sendResult.failed}</p>
                      <p className="text-sm text-gray-500">Failed</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-gray-600">{sendResult.noEmail}</p>
                      <p className="text-sm text-gray-500">No Email</p>
                    </div>
                  </div>

                  {sendResult.details && sendResult.details.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      {sendResult.details.map((detail: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <span className="text-sm text-gray-900 dark:text-white">
                            {detail.memberName}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            detail.status === 'sent' 
                              ? 'bg-green-100 text-green-700'
                              : detail.status === 'no_email'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {detail.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={closeSendModal}
                  className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Done
                </button>
              </>
            ) : (
              // Send form
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Send Payment Reminders
                </h2>

                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>{selectedMembers.length}</strong> member(s) selected with{' '}
                      <strong>{selectedTransactions.length}</strong> pending transaction(s)
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                      Total outstanding: <strong>₦{selectedTotal.toLocaleString()}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Custom Message (Optional)
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={3}
                      placeholder="Add a personalized message to include in the reminder..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <p className="text-sm text-gray-500">
                    Reminders will be sent via email to members with valid email addresses.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={closeSendModal}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendReminders}
                    disabled={isSending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Reminders
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
