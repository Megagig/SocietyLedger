'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Grid,
  Button,
  Stack,
  Group,
  NumberInput,
  Badge,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconCreditCard,
  IconArrowLeft,
  IconPackage,
  IconInfoCircle,
} from '@tabler/icons-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { smsApi } from '@/lib/api/sms';

// R3.1/G38: ported from the orphaned /dashboard/communication/sms/credits
// (deleted at R3.1) — this was the only implementation with a real,
// working Paystack purchase flow. The linked set's old "Top Up Credits"
// posted to /credits/topup, removed entirely in R1.4 (G41, free-grant bug).

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  popular?: boolean;
}

const PRICE_PER_CREDIT = 7;
const MINIMUM_CREDITS = 100;

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', credits: 100, price: 700 },
  { id: 'basic', credits: 500, price: 3500 },
  { id: 'standard', credits: 1000, price: 7000, popular: true },
  { id: 'premium', credits: 2500, price: 17500 },
  { id: 'enterprise', credits: 5000, price: 35000 },
];

export default function SMSCreditsPage() {
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

  const purchase = async (credits: number, packageId: string) => {
    setLoading(true);
    try {
      const data = await smsApi.purchaseCredits({ credits, packageId });
      window.location.href = data.authorizationUrl;
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  const handlePurchase = (packageId: string) => {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return;
    setSelectedPackage(packageId);
    purchase(pkg.credits, pkg.id);
  };

  const handleCustomPurchase = () => {
    if (!customAmount || customAmount < MINIMUM_CREDITS) return;
    purchase(customAmount, 'custom');
  };

  return (
    <Can permission={PERMISSIONS.SMS_SEND} fallback={<Alert color="red">You don't have permission to purchase SMS credits</Alert>}>
      <Stack gap="lg">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/dashboard/communications/reports')}
          >
            Back
          </Button>
        </Group>

        <div>
          <Title order={2}>Buy SMS Credits</Title>
          <Text size="sm" c="dimmed">
            Choose a package or enter a custom amount to top up your SMS credits
          </Text>
        </div>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            SMS credits are used to send messages to members. Each SMS costs 1 credit.
            Credits never expire and can be used anytime.
          </Text>
        </Alert>

        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Text size="sm" c="dimmed">Current Rate</Text>
              <Text size="xl" fw={700}>₦{PRICE_PER_CREDIT} per SMS</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">Minimum Purchase</Text>
              <Text size="xl" fw={700}>{MINIMUM_CREDITS} Credits</Text>
            </div>
          </Group>
        </Card>

        <div>
          <Title order={3} mb="md">Credit Packages</Title>
          <Grid>
            {CREDIT_PACKAGES.map((pkg) => (
              <Grid.Col key={pkg.id} span={{ base: 12, sm: 6, md: 4 }}>
                <Card
                  withBorder
                  padding="lg"
                  style={{
                    cursor: 'pointer',
                    border: selectedPackage === pkg.id ? '2px solid #228be6' : undefined,
                    position: 'relative',
                  }}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  {pkg.popular && (
                    <Badge color="blue" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}>
                      Most Popular
                    </Badge>
                  )}
                  <Stack gap="sm" mt={pkg.popular ? 'md' : 0}>
                    <Text size="lg" fw={700} tt="capitalize">{pkg.id}</Text>
                    <div>
                      <Text size="xl" fw={700} c="blue">{pkg.credits.toLocaleString()}</Text>
                      <Text size="xs" c="dimmed">SMS Credits</Text>
                    </div>
                    <Divider />
                    <div>
                      <Text size="xl" fw={700}>{formatCurrency(pkg.price)}</Text>
                      <Text size="xs" c="dimmed">₦{PRICE_PER_CREDIT} per credit</Text>
                    </div>
                    <Button
                      fullWidth
                      variant={selectedPackage === pkg.id ? 'filled' : 'light'}
                      leftSection={<IconCreditCard size={16} />}
                      loading={loading && selectedPackage === pkg.id}
                      onClick={(e) => { e.stopPropagation(); handlePurchase(pkg.id); }}
                    >
                      Purchase
                    </Button>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </div>

        <Card withBorder padding="lg">
          <Title order={4} mb="md">Custom Amount</Title>
          <Text size="sm" c="dimmed" mb="md">
            Need a different amount? Enter the number of credits you want to purchase.
          </Text>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <NumberInput
                label="Number of Credits"
                placeholder="Enter amount (min 100)"
                min={MINIMUM_CREDITS}
                max={100000}
                value={customAmount}
                onChange={(val) => setCustomAmount(val as number)}
                leftSection={<IconPackage size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Total Amount</Text>
                <Text size="xl" fw={700}>{formatCurrency((customAmount || 0) * PRICE_PER_CREDIT)}</Text>
              </Stack>
            </Grid.Col>
          </Grid>
          <Button
            mt="md"
            leftSection={<IconCreditCard size={16} />}
            disabled={!customAmount || customAmount < MINIMUM_CREDITS}
            loading={loading && selectedPackage === null}
            onClick={handleCustomPurchase}
          >
            Purchase {customAmount?.toLocaleString() || 0} Credits
          </Button>
        </Card>

        <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
          <Text size="sm" fw={500} mb="xs">Payment Information</Text>
          <Text size="xs">
            • Payments are processed securely via Paystack<br />
            • Credits are added to your account instantly after successful payment<br />
            • You'll receive a receipt via email<br />
            • For bulk purchases (10,000+ credits), contact support for special pricing
          </Text>
        </Alert>
      </Stack>
    </Can>
  );
}
