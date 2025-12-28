'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Select, Table, Pagination, Tabs } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileAnalytics, IconCurrencyNaira, IconArrowUpRight, IconArrowDownRight,
  IconAdjustments, IconDownload, IconCalendar, IconFilter, IconRefresh
} from '@tabler/icons-react';
import { toast } from '@/lib/toast';
import {
  getMyLedgerSummary, getMyLedgerEntries, getMyStatement, exportMyStatement,
  LedgerSummary, LedgerEntry, LedgerStatement
} from '@/lib/api/member-ledger';

const LEDGER_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'DUES', label: 'Dues' },
  { value: 'LEVY', label: 'Levy' },
  { value: 'PENALTY', label: 'Penalty' },
  { value: 'DONATION', label: 'Donation' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'WAIVER', label: 'Waiver' },
  { value: 'COOPERATIVE_SAVINGS', label: 'Cooperative Savings' },
  { value: 'COOPERATIVE_LOAN', label: 'Cooperative Loan' },
  { value: 'COOPERATIVE_INTEREST', label: 'Cooperative Interest' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'OTHER', label: 'Other' },
];

const ENTRY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'DEBIT', label: 'Debit (Charges)' },
  { value: 'CREDIT', label: 'Credit (Payments)' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
];

export default function MyLedgerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  
  // Filters
  const [category, setCategory] = useState('');
  const [entryType, setEntryType] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [statementDates, setStatementDates] = useState<[Date | null, Date | null]>([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    new Date()
  ]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === 'entries') {
      fetchEntries();
    } else if (activeTab === 'statement' && statementDates[0] && statementDates[1]) {
      fetchStatement();
    }
  }, [activeTab, pagination.page, category, entryType, dateRange]);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const result = await getMyLedgerSummary();
      setSummary(result.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (category) params.category = category;
      if (entryType) params.entryType = entryType;
      if (dateRange[0]) params.startDate = dateRange[0].toISOString().split('T')[0];
      if (dateRange[1]) params.endDate = dateRange[1].toISOString().split('T')[0];
      
      const result = await getMyLedgerEntries(params);
      setEntries(result.data);
      if (result.pagination) {
        setPagination(prev => ({ ...prev, ...result.pagination }));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatement = async () => {
    if (!statementDates[0] || !statementDates[1]) return;
    try {
      setIsLoading(true);
      const result = await getMyStatement({
        startDate: statementDates[0].toISOString().split('T')[0],
        endDate: statementDates[1].toISOString().split('T')[0],
      });
      setStatement(result.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!statementDates[0] || !statementDates[1]) {
      toast.error('Please select a date range');
      return;
    }
    try {
      setIsExporting(true);
      const blob = await exportMyStatement({
        startDate: statementDates[0].toISOString().split('T')[0],
        endDate: statementDates[1].toISOString().split('T')[0],
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-statement-${statementDates[0].toISOString().split('T')[0]}-${statementDates[1].toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Statement exported successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => `₦${Math.abs(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });

  const getEntryTypeIcon = (type: string) => {
    switch (type) {
      case 'DEBIT': return <IconArrowUpRight className="text-red-500" size={16} />;
      case 'CREDIT': return <IconArrowDownRight className="text-green-500" size={16} />;
      default: return <IconAdjustments className="text-blue-500" size={16} />;
    }
  };

  const getEntryTypeBadge = (type: string) => {
    const colors: Record<string, string> = { DEBIT: 'red', CREDIT: 'green', ADJUSTMENT: 'blue' };
    return <Badge color={colors[type] || 'gray'} size="sm">{type}</Badge>;
  };

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading your ledger...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Financial Ledger
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete history of all your financial activity
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          <IconDownload size={18} />
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-teal-500 to-green-500 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-100 text-sm">Current Balance</p>
            <p className="text-4xl font-bold mt-1">
              {summary?.currentBalance !== undefined ? (
                summary.currentBalance >= 0 
                  ? formatCurrency(summary.currentBalance)
                  : `-${formatCurrency(summary.currentBalance)}`
              ) : '₦0'}
            </p>
            <p className="text-teal-100 text-sm mt-2">
              {summary?.currentBalance && summary.currentBalance > 0 
                ? 'You have an outstanding balance' 
                : summary?.currentBalance && summary.currentBalance < 0 
                  ? 'You have a credit balance'
                  : 'Your account is balanced'}
            </p>
          </div>
          <div className="p-4 bg-white/20 rounded-full">
            <IconFileAnalytics size={40} />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <IconArrowUpRight className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Debits</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(summary?.totalDebits || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <IconArrowDownRight className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Credits</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(summary?.totalCredits || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <IconAdjustments className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Adjustments</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(summary?.totalAdjustments || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <IconFileAnalytics className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Entries</p>
              <p className="text-xl font-bold text-purple-600">{summary?.entryCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="summary">Summary</Tabs.Tab>
          <Tabs.Tab value="entries">All Entries</Tabs.Tab>
          <Tabs.Tab value="statement">Statement</Tabs.Tab>
        </Tabs.List>

        {/* Summary Tab */}
        <Tabs.Panel value="summary" pt="md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
            {summary?.categoryBreakdown && Object.keys(summary.categoryBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(summary.categoryBreakdown).map(([cat, data]) => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="font-medium capitalize">{cat.toLowerCase().replace('_', ' ')}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-red-600">Debits: {formatCurrency(data.debits)}</span>
                      <span className="text-green-600">Credits: {formatCurrency(data.credits)}</span>
                      <span className={data.net >= 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                        Net: {data.net >= 0 ? formatCurrency(data.net) : `-${formatCurrency(data.net)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No transactions yet</p>
            )}
          </div>
        </Tabs.Panel>

        {/* Entries Tab */}
        <Tabs.Panel value="entries" pt="md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-4">
                <Select
                  placeholder="Category"
                  data={LEDGER_CATEGORIES}
                  value={category}
                  onChange={(v) => setCategory(v || '')}
                  className="w-40"
                  leftSection={<IconFilter size={16} />}
                />
                <Select
                  placeholder="Type"
                  data={ENTRY_TYPES}
                  value={entryType}
                  onChange={(v) => setEntryType(v || '')}
                  className="w-40"
                />
                <DatePickerInput
                  type="range"
                  placeholder="Date range"
                  value={dateRange}
                  onChange={setDateRange}
                  className="w-64"
                  leftSection={<IconCalendar size={16} />}
                  clearable
                />
                <button
                  onClick={fetchEntries}
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
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th className="text-right">Amount</Table.Th>
                    <Table.Th className="text-right">Balance</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entries.length > 0 ? entries.map((entry) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td>{formatDate(entry.effectiveDate)}</Table.Td>
                      <Table.Td>
                        <div className="flex items-center gap-2">
                          {getEntryTypeIcon(entry.entryType)}
                          {getEntryTypeBadge(entry.entryType)}
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm">
                          {entry.category.replace('_', ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td className="max-w-xs truncate">{entry.description}</Table.Td>
                      <Table.Td className={`text-right font-medium ${entry.entryType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.entryType === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                      </Table.Td>
                      <Table.Td className="text-right font-semibold">
                        {entry.runningBalance >= 0 ? formatCurrency(entry.runningBalance) : `-${formatCurrency(entry.runningBalance)}`}
                      </Table.Td>
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={6} className="text-center py-8 text-gray-500">
                        No ledger entries found
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
        </Tabs.Panel>

        {/* Statement Tab */}
        <Tabs.Panel value="statement" pt="md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <DatePickerInput
                type="range"
                label="Statement Period"
                placeholder="Select date range"
                value={statementDates}
                onChange={setStatementDates}
                className="w-72"
                leftSection={<IconCalendar size={16} />}
              />
              <div className="flex items-end gap-2">
                <button
                  onClick={fetchStatement}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Generate Statement
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting || !statement}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <IconDownload size={16} />
                  Export PDF
                </button>
              </div>
            </div>

            {statement ? (
              <div className="space-y-6">
                {/* Statement Header */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold">Statement of Account</h3>
                  <p className="text-sm text-gray-500">
                    Period: {formatDate(statement.period.startDate)} - {formatDate(statement.period.endDate)}
                  </p>
                </div>

                {/* Opening/Closing Balance */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500">Opening Balance</p>
                    <p className="text-2xl font-bold">
                      {(statement.openingBalance || 0) >= 0 
                        ? formatCurrency(statement.openingBalance || 0) 
                        : `-${formatCurrency(statement.openingBalance || 0)}`}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500">Closing Balance</p>
                    <p className="text-2xl font-bold">
                      {(statement.closingBalance || 0) >= 0 
                        ? formatCurrency(statement.closingBalance || 0) 
                        : `-${formatCurrency(statement.closingBalance || 0)}`}
                    </p>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex gap-4">
                  <div className="flex-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                    <p className="text-sm text-red-600">Total Debits</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(statement.totals?.totalDebits || 0)}</p>
                  </div>
                  <div className="flex-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-sm text-green-600">Total Credits</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(statement.totals?.totalCredits || 0)}</p>
                  </div>
                </div>

                {/* Entries Table */}
                <div className="overflow-x-auto">
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Description</Table.Th>
                        <Table.Th className="text-right">Debit</Table.Th>
                        <Table.Th className="text-right">Credit</Table.Th>
                        <Table.Th className="text-right">Balance</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {statement.entries.map((entry: any) => (
                        <Table.Tr key={entry.id}>
                          <Table.Td>{formatDate(entry.date)}</Table.Td>
                          <Table.Td>{entry.description}</Table.Td>
                          <Table.Td className="text-right text-red-600">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </Table.Td>
                          <Table.Td className="text-right text-green-600">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </Table.Td>
                          <Table.Td className="text-right font-medium">
                            {(entry.balance || 0) >= 0 ? formatCurrency(entry.balance || 0) : `-${formatCurrency(entry.balance || 0)}`}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <IconFileAnalytics size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select a date range and click "Generate Statement" to view your statement</p>
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
