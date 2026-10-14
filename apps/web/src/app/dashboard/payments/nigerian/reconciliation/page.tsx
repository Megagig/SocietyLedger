'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack,
  Badge,
  Loader,
  Alert,
  SimpleGrid,
  Progress
} from '@mantine/core';
import { 
  IconRefresh, 
  IconChecklist, 
  IconArrowsLeftRight, 
  IconUpload,
  IconSearch
} from '@tabler/icons-react';
import nigerianPaymentsApi, { Reconciliation, UnmatchedDashboard } from '@/lib/api/nigerian-payments';
import { HelpLink } from '@/components/docs/HelpLink';

export default function ReconciliationDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<UnmatchedDashboard | null>(null);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await nigerianPaymentsApi.getUnmatchedDashboard();
      setDashboardData(data);
      const reconciliationsResponse = await nigerianPaymentsApi.getReconciliations({ status: 'PENDING', limit: 10 });
      
      // Handle different response structures
      if (Array.isArray(reconciliationsResponse)) {
        // Response is directly an array
        setReconciliations(reconciliationsResponse);
      } else if (reconciliationsResponse && typeof reconciliationsResponse === 'object' && 'data' in reconciliationsResponse) {
        // Response has a data property
        setReconciliations(Array.isArray(reconciliationsResponse.data) ? reconciliationsResponse.data : []);
      } else {
        // Fallback
        setReconciliations([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reconciliation data');
      setReconciliations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    try {
      setAutoMatching(true);
      const result = await nigerianPaymentsApi.runAutoMatch();
      if (result.matches.length > 0) {
        alert(`Found ${result.matches.length} potential matches. Review and apply.`);
      } else {
        alert('No matches found. Try manual reconciliation.');
      }
      loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Auto-match failed');
    } finally {
      setAutoMatching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Title order={2}>Payment Reconciliation</Title>
          <HelpLink />
        </Group>
        <Button
          leftSection={<IconRefresh size={20} />}
          onClick={loadDashboard}
          variant="subtle"
        >
          Refresh
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" icon={<IconRefresh />} mb="md" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Unmatched Summary */}
      {dashboardData && (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="md" mb="xl">
          <Card shadow="sm" padding="lg" withBorder>
            <Stack align="center" gap="xs">
              <Text size="xl" fw={700} c="orange">
                {dashboardData.totalUnmatched}
              </Text>
              <Text size="sm" c="dimmed">
                Unmatched Payments
              </Text>
            </Stack>
          </Card>

          <Card shadow="sm" padding="lg" withBorder>
            <Stack align="center" gap="xs">
              <Text size="xl" fw={700} c="red">
                ₦{dashboardData.totalUnmatchedAmount.toLocaleString()}
              </Text>
              <Text size="sm" c="dimmed">
                Unmatched Amount
              </Text>
            </Stack>
          </Card>

          <Card shadow="sm" padding="lg" withBorder>
            <Stack align="center" gap="xs">
              <Text size="xl" fw={700} c="blue">
                {dashboardData.pendingProofs}
              </Text>
              <Text size="sm" c="dimmed">
                Pending Verifications
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      )}

      {/* Quick Actions */}
      <Title order={3} mb="md">Quick Actions</Title>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" mb="xl">
        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="md">
            <div className="text-orange-600">
              <IconArrowsLeftRight size={48} />
            </div>
            <div>
              <Text fw={600} mb="xs">Auto-Match</Text>
              <Text size="sm" c="dimmed">
                Automatically match payments to bank statement entries
              </Text>
              <Button
                fullWidth
                onClick={handleAutoMatch}
                loading={autoMatching}
                mt="md"
              >
                Run Auto-Match
              </Button>
            </div>
          </Stack>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="md">
            <div className="text-blue-600">
              <IconChecklist size={48} />
            </div>
            <div>
              <Text fw={600} mb="xs">Manual Reconciliation</Text>
              <Text size="sm" c="dimmed">
                Manually match bank entries to payments
              </Text>
              <Button
                fullWidth
                onClick={() => router.push('/dashboard/payments/nigerian/statement-entries')}
                mt="md"
              >
                View Unmatched Entries
              </Button>
            </div>
          </Stack>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Stack align="center" gap="md">
            <div className="text-green-600">
              <IconUpload size={48} />
            </div>
            <div>
              <Text fw={600} mb="xs">Import Statement</Text>
              <Text size="sm" c="dimmed">
                Import bank statement (CSV) for reconciliation
              </Text>
              <Button
                fullWidth
                onClick={() => router.push('/dashboard/payments/nigerian/statements')}
                mt="md"
              >
                Import Statement
              </Button>
            </div>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Pending Reconciliations */}
      {reconciliations && reconciliations.length > 0 && (
        <>
          <Group justify="space-between" mb="md">
            <Title order={3}>Pending Reconciliations</Title>
            <Button onClick={() => router.push('/dashboard/payments/nigerian/reconciliation-history')}>
              View History
            </Button>
          </Group>

          <Card shadow="sm" padding="0" withBorder>
            {reconciliations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 border-b border-gray-200 last:border-b-0"
              >
                <Group justify="space-between" mb="xs">
                  <Group gap="sm">
                    <Text fw={500}>Entry: {rec.bankStatementEntryId || 'N/A'}</Text>
                    <Text size="sm" c="dimmed">
                      {new Date(rec.createdAt).toLocaleString()}
                    </Text>
                  </Group>
                  <Badge color={rec.status === 'PENDING' ? 'yellow' : rec.status === 'CONFIRMED' ? 'green' : 'red'}>
                    {rec.status}
                  </Badge>
                </Group>

                <Group gap="xs" mb="xs">
                  <Text fw={500}>Transfer: {rec.bankTransferId || 'N/A'}</Text>
                  <Text fw={500}>Transaction: {rec.transactionId || 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" c="dimmed">Variance:</Text>
                  <Text fw={700} c={rec.variance > 0 ? 'red' : 'green'}>
                    ₦{rec.variance.toLocaleString()}
                  </Text>
                </Group>

                {rec.confidenceScore && (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Confidence:</Text>
                    <Badge color={rec.confidenceScore > 80 ? 'green' : rec.confidenceScore > 50 ? 'yellow' : 'red'}>
                      {rec.confidenceScore}%
                    </Badge>
                  </Group>
                )}

                <Group justify="flex-end" mt="md">
                  <Button size="xs" variant="subtle">
                    View Details
                  </Button>
                  {rec.status === 'PENDING' && (
                    <>
                      <Button size="xs" color="green" ml="xs">
                        Confirm
                      </Button>
                      <Button size="xs" color="red" ml="xs">
                        Reject
                      </Button>
                    </>
                  )}
                </Group>
              </div>
            ))}
          </Card>
        </>
      )}

      {(!reconciliations || reconciliations.length === 0) && !loading && (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <IconSearch size={48} className="text-gray-400" />
            <Text c="dimmed" ta="center">
              No pending reconciliations. Run auto-match or import a bank statement to get started.
            </Text>
            <Button onClick={handleAutoMatch} variant="light">
              Run Auto-Match
            </Button>
          </Stack>
        </Card>
      )}
    </div>
  );
}
