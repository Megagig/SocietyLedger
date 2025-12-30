'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Table, Pagination, TextInput, Select } from '@mantine/core';
import {
  IconFileAnalytics, IconCurrencyNaira, IconSearch, IconUsers,
  IconArrowUpRight, IconArrowDownRight, IconRefresh, IconEye
} from '@tabler/icons-react';
import { toast } from '@/lib/toast';
import { getAllMemberBalances, bulkSyncLedgers, MemberBalance } from '@/lib/api/member-ledger';

export default function MemberLedgerPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSyncing, setIsSyncing] = useState(false);

  // Summary stats
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalOutstanding: 0,
    totalCredit: 0,
    membersWithBalance: 0,
  });

  useEffect(() => {
    fetchMembers();
  }, [pagination.page, search, sortBy, sortOrder]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const result = await getAllMemberBalances({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        sortBy,
        sortOrder,
      });
      
      // API returns { data: { members: [...], pagination: {...} } }
      const membersData = result.data?.members || [];
      const paginationData = result.data?.pagination;
      
      // Transform to expected format
      const transformedMembers: MemberBalance[] = membersData.map((m: any) => ({
        memberId: m.id,
        memberName: `${m.firstName} ${m.lastName}`,
        memberNumber: m.memberId,
        balance: m.balance || 0,
        lastActivity: null, // Not provided by API
      }));
      
      setMembers(transformedMembers);
      if (paginationData) {
        setPagination(prev => ({ 
          ...prev, 
          page: paginationData.page,
          limit: paginationData.limit,
          total: paginationData.total,
          pages: paginationData.totalPages 
        }));
      }
      
      // Calculate stats
      const outstanding = transformedMembers.filter((m: MemberBalance) => m.balance > 0).reduce((sum: number, m: MemberBalance) => sum + m.balance, 0);
      const credit = transformedMembers.filter((m: MemberBalance) => m.balance < 0).reduce((sum: number, m: MemberBalance) => sum + Math.abs(m.balance), 0);
      const withBalance = transformedMembers.filter((m: MemberBalance) => m.balance !== 0).length;
      
      setStats({
        totalMembers: paginationData?.total || transformedMembers.length,
        totalOutstanding: outstanding,
        totalCredit: credit,
        membersWithBalance: withBalance,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSync = async () => {
    try {
      setIsSyncing(true);
      const result = await bulkSyncLedgers();
      toast.success(`Synced ${result.data.synced} entries for ${result.data.members} members`);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${Math.abs(amount).toLocaleString()}`;
  const formatDate = (date: string | null) => date 
    ? new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No activity';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Member Ledgers
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all member financial ledgers
          </p>
        </div>
        <button
          onClick={handleBulkSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          <IconRefresh size={18} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing...' : 'Sync All Ledgers'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <IconUsers className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Members</p>
              <p className="text-xl font-bold text-blue-600">{stats.totalMembers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <IconArrowUpRight className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <IconArrowDownRight className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Credit</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalCredit)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <IconFileAnalytics className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">With Balance</p>
              <p className="text-xl font-bold text-purple-600">{stats.membersWithBalance}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4">
            <TextInput
              placeholder="Search by name or member ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
              className="w-64"
            />
            <Select
              placeholder="Sort by"
              data={[
                { value: 'balance', label: 'Balance' },
                { value: 'memberName', label: 'Name' },
                { value: 'lastActivity', label: 'Last Activity' },
              ]}
              value={sortBy}
              onChange={(v) => setSortBy(v || 'balance')}
              className="w-40"
            />
            <Select
              placeholder="Order"
              data={[
                { value: 'desc', label: 'Descending' },
                { value: 'asc', label: 'Ascending' },
              ]}
              value={sortOrder}
              onChange={(v) => setSortOrder((v as 'asc' | 'desc') || 'desc')}
              className="w-36"
            />
            <button
              onClick={fetchMembers}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <IconRefresh size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th className="text-right">Balance</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last Activity</Table.Th>
                <Table.Th className="text-center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={6} className="text-center py-8 text-gray-500">
                    Loading members...
                  </Table.Td>
                </Table.Tr>
              ) : members.length > 0 ? members.map((member) => (
                <Table.Tr key={member.memberId} className="cursor-pointer" onClick={() => router.push(`/dashboard/finance/member-ledger/${member.memberId}`)}>
                  <Table.Td className="font-mono text-sm">{member.memberNumber}</Table.Td>
                  <Table.Td className="font-medium">{member.memberName}</Table.Td>
                  <Table.Td className={`text-right font-bold ${member.balance > 0 ? 'text-red-600' : member.balance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {member.balance > 0 ? formatCurrency(member.balance) : member.balance < 0 ? `-${formatCurrency(member.balance)}` : '₦0'}
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      color={member.balance > 0 ? 'red' : member.balance < 0 ? 'green' : 'gray'}
                      size="sm"
                    >
                      {member.balance > 0 ? 'Outstanding' : member.balance < 0 ? 'Credit' : 'Balanced'}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-500">{formatDate(member.lastActivity)}</Table.Td>
                  <Table.Td className="text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/finance/member-ledger/${member.memberId}`);
                      }}
                      className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg"
                      title="View Ledger"
                    >
                      <IconEye size={18} />
                    </button>
                  </Table.Td>
                </Table.Tr>
              )) : (
                <Table.Tr>
                  <Table.Td colSpan={6} className="text-center py-8 text-gray-500">
                    No members found
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
            <Pagination
              total={pagination.pages}
              value={pagination.page}
              onChange={(page) => setPagination(prev => ({ ...prev, page }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
