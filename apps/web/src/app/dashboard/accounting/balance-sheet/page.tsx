'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Text,
  Group,
  Stack,
  Loader,
  Alert,
  Paper,
  Table,
  Divider,
  Badge,
  ThemeIcon,
  Button,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconWallet, IconCheck, IconX, IconScale, IconRefresh } from '@tabler/icons-react';
import { accountingApi, BalanceSheet, AccountBalance } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';
import { DrillLink } from '@/components/reports/DrillLink';
import { entryHref, ledgerHref } from '@/lib/accounting-drill';

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState<Date | null>(new Date());

  const { data: reportData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['balance-sheet', asOfDate?.toISOString()],
    queryFn: () =>
      accountingApi.getBalanceSheet({
        asOfDate: asOfDate?.toISOString(),
      }),
    retry: false,
  });

  const handleGenerateReport = async () => {
    try {
      await refetch();
      toast.success('Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate report');
    }
  };

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load balance sheet');
    }
  }, [error]);

  const report: BalanceSheet | undefined = reportData?.data;
  // A figure opens everything posted up to the date the sheet is drawn for
  const dates = { to: report?.asOfDate, datesLabel: 'Up to the date shown' };
  const drill = (balance: unknown, target: { accountId?: number; accountIds?: number[]; scope?: string; title: string }) => (Number(balance) !== 0 ? ledgerHref({ ...target, ...dates }) : undefined);
  const idsOf = (list?: { accountId: number }[]) => (list ?? []).map((a) => a.accountId);

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(num || 0);
  };

  const renderAccountSection = (accounts: AccountBalance[], title: string) => {
    if (accounts.length === 0) return null;
    
    return (
      <>
        <Table.Tr>
          <Table.Td pl="xl">
            <Text size="sm" fw={500} c="dimmed">{title}</Text>
          </Table.Td>
          <Table.Td></Table.Td>
        </Table.Tr>
        {accounts.map((account) => (
          <Table.Tr key={account.accountId}>
            <Table.Td pl={40}>
              <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
            </Table.Td>
            <Table.Td align="right">
              <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Balance Sheet
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View your association&apos;s financial position
          </p>
        </div>
        <Alert icon={<IconWallet size={20} />} title="Unable to Load Report" color="red">
          <Text size="sm">
            Failed to load the balance sheet. Please ensure the chart of accounts is initialized.
          </Text>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Balance Sheet
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your association&apos;s financial position
        </p>
      </div>

      {/* Date Filter */}
      <Paper p="md" mb="xl" withBorder className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
          <DateInput
            label="As of Date"
            value={asOfDate}
            onChange={setAsOfDate}
            maxDate={new Date()}
            className="w-full sm:w-[200px]"
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={handleGenerateReport}
            loading={isFetching}
            className="w-full sm:w-auto"
          >
            Generate Report
          </Button>
        </div>
      </Paper>

      {!report && !isLoading && !error && (
        <Alert icon={<IconWallet size={20} />} title="No Report Data" color="blue" mb="xl">
          <Text size="sm">
            No financial data available. This could be because:
          </Text>
          <ul className="list-disc ml-4 mt-2 text-sm">
            <li>The chart of accounts has not been initialized yet</li>
            <li>There are no posted journal entries</li>
          </ul>
          <Text size="sm" mt="sm">
            Go to Chart of Accounts and click &quot;Initialize&quot; to set up your accounts, then create and post journal entries.
          </Text>
        </Alert>
      )}

      {report && (
        <>
          {/* Balance Status */}
          <Card withBorder padding="md" mb="xl">
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>
                  Balance Sheet as of {new Date(report.asOfDate).toLocaleDateString()}
                </Text>
              </div>
              <Badge
                size="lg"
                color={report.isBalanced ? 'green' : 'red'}
                leftSection={
                  report.isBalanced ? <IconCheck size={14} /> : <IconX size={14} />
                }
              >
                {report.isBalanced ? 'Balanced' : 'Not Balanced'}
              </Badge>
            </Group>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card withBorder padding="md" className="p-3 sm:p-4">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="xs" className="sm:text-sm" c="dimmed">Total Assets</Text>
              </Group>
              <Text size="lg" className="text-base sm:text-xl" fw={700} c="blue">
                <DrillLink href={drill(report.assets.total, { scope: 'ASSET', title: 'All assets' })} label="Total assets">{formatCurrency(report.assets.total)}</DrillLink>
              </Text>
            </Card>

            <Card withBorder padding="md" className="p-3 sm:p-4">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="red">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="xs" className="sm:text-sm" c="dimmed">Total Liabilities</Text>
              </Group>
              <Text size="lg" className="text-base sm:text-xl" fw={700} c="red">
                <DrillLink href={drill(report.liabilities.total, { scope: 'LIABILITY', title: 'All liabilities' })} label="Total liabilities">{formatCurrency(report.liabilities.total)}</DrillLink>
              </Text>
            </Card>

            <Card withBorder padding="md" className="p-3 sm:p-4">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="purple">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="xs" className="sm:text-sm" c="dimmed">Total Equity</Text>
              </Group>
              <Text size="lg" className="text-base sm:text-xl" fw={700} c="purple">
                {formatCurrency(report.equity.total)}
              </Text>
            </Card>

            <Card withBorder padding="md" className="p-3 sm:p-4">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconScale size={14} />
                </ThemeIcon>
                <Text size="xs" className="sm:text-sm" c="dimmed">Liab + Equity</Text>
              </Group>
              <Text size="lg" className="text-base sm:text-xl" fw={700} c="green">
                {formatCurrency(report.totalLiabilitiesAndEquity)}
              </Text>
            </Card>
          </div>

          {/* Detailed Balance Sheet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Assets */}
            <Card withBorder padding="lg">
              <Text size="lg" fw={700} c="blue" mb="md">ASSETS</Text>
              
              <Table>
                <Table.Tbody>
                  {/* Current Assets */}
                  {report.assets.current.length > 0 && (
                    <>
                      <Table.Tr>
                        <Table.Td>
                          <Text fw={600}>Current Assets</Text>
                        </Table.Td>
                        <Table.Td></Table.Td>
                      </Table.Tr>
                      {report.assets.current.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td pl="xl">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Current Assets</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}><DrillLink href={drill(report.assets.totalCurrent, { accountIds: idsOf(report?.assets.current), title: 'Current assets' })} label="Total current assets">{formatCurrency(report.assets.totalCurrent)}</DrillLink></Text>
                        </Table.Td>
                      </Table.Tr>
                    </>
                  )}

                  {/* Fixed Assets */}
                  {report.assets.fixed.length > 0 && (
                    <>
                      <Table.Tr>
                        <Table.Td colSpan={2}><Divider my="xs" /></Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>
                          <Text fw={600}>Fixed Assets</Text>
                        </Table.Td>
                        <Table.Td></Table.Td>
                      </Table.Tr>
                      {report.assets.fixed.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td pl="xl">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Fixed Assets</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}><DrillLink href={drill(report.assets.totalFixed, { accountIds: idsOf(report?.assets.fixed), title: 'Fixed assets' })} label="Total fixed assets">{formatCurrency(report.assets.totalFixed)}</DrillLink></Text>
                        </Table.Td>
                      </Table.Tr>
                    </>
                  )}

                  {/* Other Assets */}
                  {report.assets.other.length > 0 && (
                    <>
                      <Table.Tr>
                        <Table.Td colSpan={2}><Divider my="xs" /></Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>
                          <Text fw={600}>Other Assets</Text>
                        </Table.Td>
                        <Table.Td></Table.Td>
                      </Table.Tr>
                      {report.assets.other.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td pl="xl">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Other Assets</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}><DrillLink href={drill(report.assets.totalOther, { accountIds: idsOf(report?.assets.other), title: 'Other assets' })} label="Total other assets">{formatCurrency(report.assets.totalOther)}</DrillLink></Text>
                        </Table.Td>
                      </Table.Tr>
                    </>
                  )}

                  {/* Total Assets */}
                  <Table.Tr>
                    <Table.Td colSpan={2}><Divider my="sm" /></Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text fw={700}>TOTAL ASSETS</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text fw={700} c="blue"><DrillLink href={drill(report.assets.total, { scope: 'ASSET', title: 'All assets' })} label="Total assets">{formatCurrency(report.assets.total)}</DrillLink></Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Card>

            {/* Liabilities & Equity */}
            <Card withBorder padding="lg">
              <Text size="lg" fw={700} c="red" mb="md">LIABILITIES</Text>
              
              <Table>
                <Table.Tbody>
                  {/* Current Liabilities */}
                  {report.liabilities.current.length > 0 && (
                    <>
                      <Table.Tr>
                        <Table.Td>
                          <Text fw={600}>Current Liabilities</Text>
                        </Table.Td>
                        <Table.Td></Table.Td>
                      </Table.Tr>
                      {report.liabilities.current.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td pl="xl">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Current Liabilities</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}><DrillLink href={drill(report.liabilities.totalCurrent, { accountIds: idsOf(report?.liabilities.current), title: 'Current liabilities' })} label="Total current liabilities">{formatCurrency(report.liabilities.totalCurrent)}</DrillLink></Text>
                        </Table.Td>
                      </Table.Tr>
                    </>
                  )}

                  {/* Long-term Liabilities */}
                  {report.liabilities.longTerm.length > 0 && (
                    <>
                      <Table.Tr>
                        <Table.Td colSpan={2}><Divider my="xs" /></Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>
                          <Text fw={600}>Long-term Liabilities</Text>
                        </Table.Td>
                        <Table.Td></Table.Td>
                      </Table.Tr>
                      {report.liabilities.longTerm.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td pl="xl">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Long-term Liabilities</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}><DrillLink href={drill(report.liabilities.totalLongTerm, { accountIds: idsOf(report?.liabilities.longTerm), title: 'Long-term liabilities' })} label="Total long-term liabilities">{formatCurrency(report.liabilities.totalLongTerm)}</DrillLink></Text>
                        </Table.Td>
                      </Table.Tr>
                    </>
                  )}

                  {/* Total Liabilities */}
                  <Table.Tr>
                    <Table.Td colSpan={2}><Divider my="sm" /></Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text fw={700}>TOTAL LIABILITIES</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text fw={700} c="red"><DrillLink href={drill(report.liabilities.total, { scope: 'LIABILITY', title: 'All liabilities' })} label="Total liabilities">{formatCurrency(report.liabilities.total)}</DrillLink></Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Equity Section */}
                  <Table.Tr>
                    <Table.Td colSpan={2}><Divider my="md" /></Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Text size="lg" fw={700} c="purple">EQUITY</Text>
                    </Table.Td>
                  </Table.Tr>
                  {report.equity.accounts.map((account) => (
                    <Table.Tr key={account.accountId}>
                      <Table.Td pl="xl">
                        <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{account.accountCode} - {account.accountName}</DrillLink></Text>
                      </Table.Td>
                      <Table.Td align="right">
                        <Text size="sm"><DrillLink href={drill(account.balance, { accountId: account.accountId, title: account.accountName })} label={account.accountName}>{formatCurrency(account.balance)}</DrillLink></Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td pl="xl">
                      <Text size="sm">Retained Earnings</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text size="sm">{formatCurrency(report.equity.retainedEarnings)}</Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text fw={700}>TOTAL EQUITY</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text fw={700} c="purple">{formatCurrency(report.equity.total)}</Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Total Liabilities & Equity */}
                  <Table.Tr>
                    <Table.Td colSpan={2}><Divider my="sm" /></Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text fw={700}>TOTAL LIABILITIES & EQUITY</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text fw={700} c="green">{formatCurrency(report.totalLiabilitiesAndEquity)}</Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
