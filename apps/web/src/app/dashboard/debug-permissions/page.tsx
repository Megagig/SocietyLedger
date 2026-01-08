'use client';

import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/lib/permissions';
import { Card, Title, Text, Stack, Code, Button } from '@mantine/core';

export default function DebugPermissionsPage() {
  const { user, _hasHydrated } = useAuthStore();

  const checkPermission = (permKey: string, permValue: string) => {
    const has = user?.permissions?.includes(permValue);
    return (
      <div key={permKey}>
        <Text size="sm">
          <strong>{permKey}</strong>: {permValue} - {has ? '✅ HAS' : '❌ MISSING'}
        </Text>
      </div>
    );
  };

  return (
    <Stack gap="lg" p="md">
      <Card withBorder padding="lg">
        <Title order={2}>Permission Debug Tool</Title>
        
        <Stack gap="md" mt="lg">
          <div>
            <Text fw={700}>Store Status:</Text>
            <Text size="sm">Hydrated: {_hasHydrated ? '✅ Yes' : '❌ No'}</Text>
            <Text size="sm">User: {user ? '✅ Logged In' : '❌ Not Logged In'}</Text>
            {user && (
              <>
                <Text size="sm">Email: {user.email}</Text>
                <Text size="sm">Role: {user.role}</Text>
                <Text size="sm">Platform Role: {user.platformRole || 'None'}</Text>
              </>
            )}
          </div>

          <div>
            <Text fw={700}>User Permissions ({user?.permissions?.length || 0} total):</Text>
            {user?.permissions && user.permissions.length > 0 ? (
              <Code block mt="xs">
                {JSON.stringify(user.permissions, null, 2)}
              </Code>
            ) : (
              <Text size="sm" c="red">No permissions found!</Text>
            )}
          </div>

          <div>
            <Text fw={700}>Checking Nigerian Payment Permissions:</Text>
            <Stack gap="xs" mt="xs">
              {checkPermission('PAYMENT_RECORD', PERMISSIONS.PAYMENT_RECORD)}
              {checkPermission('PAYMENT_VERIFY', PERMISSIONS.PAYMENT_VERIFY)}
              {checkPermission('PAYMENT_VIEW', PERMISSIONS.PAYMENT_VIEW)}
              {checkPermission('PAYMENT_NIGERIAN_VIEW', 'payments.nigerian.view')}
              {checkPermission('PAYMENT_NIGERIAN_RECORD', 'payments.nigerian.record')}
              {checkPermission('PAYMENT_NIGERIAN_VERIFY', 'payments.nigerian.verify')}
              {checkPermission('PAYMENT_NIGERIAN_RECONCILE', 'payments.nigerian.reconcile')}
              {checkPermission('PAYMENT_NIGERIAN_IMPORT', 'payments.nigerian.import')}
            </Stack>
          </div>

          <Button
            onClick={() => {
              console.log('=== PERMISSION DEBUG ===');
              console.log('User:', user);
              console.log('Permissions:', user?.permissions);
              console.log('PERMISSIONS constant:', PERMISSIONS);
              console.log('PAYMENT_RECORD value:', PERMISSIONS.PAYMENT_RECORD);
              console.log('Has PAYMENT_RECORD?', user?.permissions?.includes(PERMISSIONS.PAYMENT_RECORD));
            }}
          >
            Log to Console
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
