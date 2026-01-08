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
  CreditCard,
  ArrowLeft,
  DollarSign,
  Package,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { notifications } from '@mantine/notifications';

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  popular?: boolean;
}

// SMS Credit Pricing: ₦7 per credit (no discounts, no bonuses)
const PRICE_PER_CREDIT = 7;
const MINIMUM_CREDITS = 100;

const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    credits: 100,
    price: 700, // 100 × ₦7
  },
  {
    id: 'basic',
    credits: 500,
    price: 3500, // 500 × ₦7
  },
  {
    id: 'standard',
    credits: 1000,
    price: 7000, // 1,000 × ₦7
    popular: true,
  },
  {
    id: 'premium',
    credits: 2500,
    price: 17500, // 2,500 × ₦7
  },
  {
    id: 'enterprise',
    credits: 5000,
    price: 35000, // 5,000 × ₦7
  },
];

export default function SMSCreditsPage() {
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePurchase = async (packageId: string) => {
    const selectedPkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!selectedPkg) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sms/credits/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            credits: selectedPkg.credits,
            packageId: selectedPkg.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      // Redirect to Paystack checkout
      window.location.href = data.data.authorizationUrl;
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  const handleCustomPurchase = async () => {
    if (!customAmount || customAmount < MINIMUM_CREDITS) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sms/credits/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            credits: customAmount,
            packageId: 'custom',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      // Redirect to Paystack checkout
      window.location.href = data.data.authorizationUrl;
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  return (
    <Can permission={PERMISSIONS.SMS_SEND} fallback={<Alert color="red">You don't have permission to purchase SMS credits</Alert>}>
      <Stack gap="lg">
        {/* Header */}
        <Group>
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => router.back()}
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

        {/* Info Alert */}
        <Alert icon={<Info size={16} />} color="blue" variant="light">
          <Text size="sm">
            SMS credits are used to send messages to members. Each SMS costs 1 credit. 
            Credits never expire and can be used anytime.
          </Text>
        </Alert>

        {/* Pricing Info */}
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

        {/* Credit Packages */}
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
                    <Badge
                      color="blue"
                      variant="filled"
                      style={{ position: 'absolute', top: 10, right: 10 }}
                    >
                      Most Popular
                    </Badge>
                  )}
                  
                  <Stack gap="sm" mt={pkg.popular ? 'md' : 0}>
                    <Text size="lg" fw={700} tt="capitalize">
                      {pkg.id}
                    </Text>
                    
                    <div>
                      <Text size="xl" fw={700} c="blue">
                        {pkg.credits.toLocaleString()}
                      </Text>
                      <Text size="xs" c="dimmed">SMS Credits</Text>
                    </div>

                    <Divider />

                    <div>
                      <Text size="xl" fw={700}>
                        {formatCurrency(pkg.price)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        ₦{PRICE_PER_CREDIT} per credit
                      </Text>
                    </div>

                    <Button
                      fullWidth
                      variant={selectedPackage === pkg.id ? 'filled' : 'light'}
                      leftSection={<CreditCard size={16} />}
                      loading={loading && selectedPackage === pkg.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePurchase(pkg.id);
                      }}
                    >
                      Purchase
                    </Button>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </div>

        {/* Custom Amount */}
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
                leftSection={<Package size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Total Amount</Text>
                <Text size="xl" fw={700}>
                  {formatCurrency((customAmount || 0) * PRICE_PER_CREDIT)}
                </Text>
              </Stack>
            </Grid.Col>
          </Grid>

          <Button
            mt="md"
            leftSection={<CreditCard size={16} />}
            disabled={!customAmount || customAmount < MINIMUM_CREDITS}
            loading={loading}
            onClick={handleCustomPurchase}
          >
            Purchase {customAmount?.toLocaleString() || 0} Credits
          </Button>
        </Card>

        {/* Payment Info */}
        <Alert icon={<Info size={16} />} color="gray" variant="light">
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
