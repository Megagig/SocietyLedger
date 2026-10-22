'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Text, Badge, Loader, Alert, Button, Group, Stack, Table } from '@mantine/core';
import { IconArrowLeft, IconWallet, IconCreditCard, IconShieldCheck, IconStar } from '@tabler/icons-react';
import { getMemberCooperativeProfile } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface CooperativeProfile {
  memberId: number;
  memberName: string;
  savingsAccounts: { id: number; accountNumber: string; accountType: string; balance: string; status: string }[];
  totalSavings: string;
  activeLoans: { id: number; loanNumber: string; principalAmount: string; outstandingBalance: string; status: string }[];
  totalOutstandingLoans: string;
  guarantorExposure: string;
  guaranteedLoans: { id: number; loanNumber: string | null; applicationNumber: string; principalAmount: string | null; loanStatus: string | null; applicationStatus: string }[];
  loanEligibility: { maxLoanAmount: string; eligibleProducts: { id: number; name: string }[]; reasons: string[] };
  creditScore: number;
  memberSince: string;
}

export default function MemberCooperativeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = Number(params.id);

  const [profile, setProfile] = useState<CooperativeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const result = await getMemberCooperativeProfile(memberId);
        setProfile(result.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load cooperative profile');
        toast.error(err.message || 'Failed to load cooperative profile');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [memberId]);

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <Alert color="red" title="Unable to load cooperative profile">
        {error || 'Profile not found'}
      </Alert>
    );
  }

  return (
    <div>
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => router.push(`/dashboard/members/${memberId}`)}
        mb="md"
      >
        Back to Member Profile
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          {profile.memberName}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Cooperative Standing</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Total Savings</Text>
            <IconWallet size={18} className="text-teal-600" />
          </Group>
          <Text size="xl" fw={700} c="green">{formatCurrency(profile.totalSavings)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Outstanding Loans</Text>
            <IconCreditCard size={18} className="text-orange-600" />
          </Group>
          <Text size="xl" fw={700} c="orange">{formatCurrency(profile.totalOutstandingLoans)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Guarantor Exposure</Text>
            <IconShieldCheck size={18} className="text-blue-600" />
          </Group>
          <Text size="xl" fw={700}>{formatCurrency(profile.guarantorExposure)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Credit Score</Text>
            <IconStar size={18} className="text-purple-600" />
          </Group>
          <Text size="xl" fw={700}>{profile.creditScore}</Text>
        </Card>
      </div>

      {/* Savings Accounts */}
      <Card withBorder padding={0} mb="xl">
        <div className="p-4"><Text fw={600}>Savings Accounts</Text></div>
        {profile.savingsAccounts.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">No savings accounts</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profile.savingsAccounts.map((acc) => (
                <Table.Tr key={acc.id}>
                  <Table.Td>{acc.accountNumber}</Table.Td>
                  <Table.Td>{acc.accountType}</Table.Td>
                  <Table.Td>{formatCurrency(acc.balance)}</Table.Td>
                  <Table.Td><Badge color={acc.status === 'ACTIVE' ? 'green' : 'gray'} size="sm">{acc.status}</Badge></Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" onClick={() => router.push(`/dashboard/cooperatives/savings/${acc.id}`)}>
                      View
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Active Loans */}
      <Card withBorder padding={0} mb="xl">
        <div className="p-4"><Text fw={600}>Active Loans</Text></div>
        {profile.activeLoans.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">No active loans</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Loan</Table.Th>
                <Table.Th>Principal</Table.Th>
                <Table.Th>Outstanding</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profile.activeLoans.map((loan) => (
                <Table.Tr key={loan.id}>
                  <Table.Td>{loan.loanNumber}</Table.Td>
                  <Table.Td>{formatCurrency(loan.principalAmount)}</Table.Td>
                  <Table.Td>{formatCurrency(loan.outstandingBalance)}</Table.Td>
                  <Table.Td><Badge size="sm">{loan.status}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Guaranteed Loans */}
      <Card withBorder padding={0} mb="xl">
        <div className="p-4"><Text fw={600}>Loans Guaranteed for Others</Text></div>
        {profile.guaranteedLoans.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Not guaranteeing any loans</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Loan</Table.Th>
                <Table.Th>Principal</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profile.guaranteedLoans.map((loan) => (
                <Table.Tr key={loan.id}>
                  <Table.Td>{loan.loanNumber ?? loan.applicationNumber}</Table.Td>
                  <Table.Td>{formatCurrency(loan.principalAmount ?? 0)}</Table.Td>
                  <Table.Td><Badge size="sm">{(loan.loanStatus ?? loan.applicationStatus).replace(/_/g, ' ')}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Loan Eligibility */}
      <Card withBorder padding="md">
        <Text fw={600} mb="sm">Loan Eligibility</Text>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Max Loan Amount</Text>
            <Text size="sm" fw={600}>{formatCurrency(profile.loanEligibility.maxLoanAmount)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Eligible Products</Text>
            <Text size="sm">
              {profile.loanEligibility.eligibleProducts.length > 0
                ? profile.loanEligibility.eligibleProducts.map((p) => p.name).join(', ')
                : 'None'}
            </Text>
          </Group>
          {profile.loanEligibility.reasons.length > 0 && (
            <Alert color="orange" mt="sm">
              {profile.loanEligibility.reasons.join('; ')}
            </Alert>
          )}
        </Stack>
      </Card>
    </div>
  );
}
