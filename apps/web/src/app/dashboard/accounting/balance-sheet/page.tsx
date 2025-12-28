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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconWallet, IconCheck, IconX, IconScale } from '@tabler/icons-react';
import { accountingApi, BalanceSheet, AccountBalance } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState<Date | null>(new Date());

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['balance-sheet', asOfDate?.toISOString()],
    queryFn: () =>
      accountingApi.getBalanceSheet({
        asOfDate: asOfDate?.toISOString(),
      }),
    retry: false,
  });

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load balance sheet');
    }
  }, [error]);

  const report: BalanceSheet | undefined = reportData?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
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
              <Text size="sm">{account.accountCode} - {account.accountName}</Text>
            </Table.Td>
            <Table.Td align="right">
              <Text size="sm">{formatCurrency(account.balance)}</Text>
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
            View your association's financial position
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
          View your association's financial position
        </p>
      </div>

      {/* Date Filter */}
      <Paper p="md" mb="xl" withBorder>
        <Group>
          <DateInput
            label="As of Date"
            value={asOfDate}
            onChange={setAsOfDate}
            maxDate={new Date()}
            w={200}
          />
        </Group>
      </Paper>

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Total Assets</Text>
              </Group>
              <Text size="xl" fw={700} c="blue">
                {formatCurrency(report.assets.total)}
              </Text>
            </Card>

            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="red">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Total Liabilities</Text>
              </Group>
              <Text size="xl" fw={700} c="red">
                {formatCurrency(report.liabilities.total)}
              </Text>
            </Card>

            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="purple">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Total Equity</Text>
              </Group>
              <Text size="xl" fw={700} c="purple">
                {formatCurrency(report.equity.total)}
              </Text>
            </Card>

            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconScale size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Liabilities + Equity</Text>
              </Group>
              <Text size="xl" fw={700} c="green">
                {formatCurrency(report.totalLiabilitiesAndEquity)}
              </Text>
            </Card>
          </div>

          {/* Detailed Balance Sheet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            <Text size="sm">{account.accountCode} - {account.accountName}</Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm">{formatCurrency(account.balance)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Current Assets</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}>{formatCurrency(report.assets.totalCurrent)}</Text>
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
                            <Text size="sm">{account.accountCode} - {account.accountName}</Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm">{formatCurrency(account.balance)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Fixed Assets</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}>{formatCurrency(report.assets.totalFixed)}</Text>
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
                            <Text size="sm">{account.accountCode} - {account.accountName}</Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm">{formatCurrency(account.balance)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Other Assets</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}>{formatCurrency(report.assets.totalOther)}</Text>
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
                      <Text fw={700} c="blue">{formatCurrency(report.assets.total)}</Text>
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
                            <Text size="sm">{account.accountCode} - {account.accountName}</Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm">{formatCurrency(account.balance)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Current Liabilities</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}>{formatCurrency(report.liabilities.totalCurrent)}</Text>
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
                            <Text size="sm">{account.accountCode} - {account.accountName}</Text>
                          </Table.Td>
                          <Table.Td align="right">
                            <Text size="sm">{formatCurrency(account.balance)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr>
                        <Table.Td pl="xl">
                          <Text size="sm" fw={500}>Total Long-term Liabilities</Text>
                        </Table.Td>
                        <Table.Td align="right">
                          <Text size="sm" fw={500}>{formatCurrency(report.liabilities.totalLongTerm)}</Text>
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
                      <Text fw={700} c="red">{formatCurrency(report.liabilities.total)}</Text>
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
                        <Text size="sm">{account.accountCode} - {account.accountName}</Text>
                      </Table.Td>
                      <Table.Td align="right">
                        <Text size="sm">{formatCurrency(account.balance)}</Text>
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
