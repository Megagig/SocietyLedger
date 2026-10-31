'use client';

import { useState } from 'react';
import { Button, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCreditCard, IconLoader2 } from '@tabler/icons-react';
import { apiPost } from '@/utils/api';

interface PaymentButtonProps {
  transactionId: number;
  amount: number;
  disabled?: boolean;
  variant?: 'filled' | 'outline' | 'light';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

type PaymentProvider = 'paystack' | 'nomba';

export function PaymentButton({
  transactionId,
  amount,
  disabled = false,
  variant = 'filled',
  size = 'md',
  fullWidth = false,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<PaymentProvider>('paystack');

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const endpoint = provider === 'paystack' 
        ? '/api/payments/paystack/initialize'
        : '/api/payments/nomba/initialize';

      // Through the shared client so it carries THIS tab's token and association, not whichever group signed in last in the browser.
      const response = await apiPost(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        transactionId,
        callbackUrl: `${window.location.origin}/dashboard/finance/payments/verify`,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      // Redirect to payment gateway checkout
      const checkoutUrl = provider === 'paystack' 
        ? data.data.authorizationUrl 
        : data.data.checkoutLink;
      
      window.location.href = checkoutUrl;
    } catch (error: any) {
      notifications.show({
        title: 'Payment Error',
        message: error.message || 'Failed to initialize payment',
        color: 'red',
      });
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Select
        value={provider}
        onChange={(value) => setProvider(value as PaymentProvider)}
        data={[
          { value: 'paystack', label: 'Paystack' },
          { value: 'nomba', label: 'Nomba' },
        ]}
        disabled={disabled || isLoading}
        size={size}
        style={{ width: '140px' }}
      />
      <Button
        onClick={handlePayment}
        loading={isLoading}
        disabled={disabled || isLoading}
        color="green"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        leftSection={isLoading ? <IconLoader2 size={18} /> : <IconCreditCard size={18} />}
      >
        {isLoading ? 'Initializing...' : `Pay ₦${amount.toLocaleString()}`}
      </Button>
    </div>
  );
}
