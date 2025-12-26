'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCreditCard, IconLoader2 } from '@tabler/icons-react';

interface PaymentButtonProps {
  transactionId: number;
  amount: number;
  disabled?: boolean;
  variant?: 'filled' | 'outline' | 'light';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

export function PaymentButton({
  transactionId,
  amount,
  disabled = false,
  variant = 'filled',
  size = 'md',
  fullWidth = false,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/paystack/initialize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            transactionId,
            callbackUrl: `${window.location.origin}/dashboard/finance/payments/verify`,
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
      notifications.show({
        title: 'Payment Error',
        message: error.message || 'Failed to initialize payment',
        color: 'red',
      });
      setIsLoading(false);
    }
  };

  return (
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
  );
}
