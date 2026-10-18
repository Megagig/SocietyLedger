'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, Stack, Title, Text, TextInput,
  Button, Alert, Tabs, PinInput, Group,
} from '@mantine/core';
import { IconAlertCircle, IconKey, IconShield } from '@tabler/icons-react';

export default function TwoFactorPage() {
  const router = useRouter();

  const [tab, setTab] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitTotp() {
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/bff/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? 'Invalid code');
        setCode('');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryCode.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/bff/2fa/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode: recoveryCode.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? 'Invalid recovery code');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--admin-page-bg)',
      }}
    >
      <Card
        style={{ width: 380, backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        p="xl"
        radius="lg"
      >
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={2} ta="center">Two-factor authentication</Title>
            <Text size="sm" c="dimmed" ta="center">Enter your authenticator code or use a recovery code.</Text>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" p="sm">
              <Text size="sm">{error}</Text>
            </Alert>
          )}

          <Tabs value={tab} onChange={(v) => { setTab(v as typeof tab); setError(null); }}>
            <Tabs.List grow mb="md">
              <Tabs.Tab value="totp" leftSection={<IconShield size={14} />}>Authenticator</Tabs.Tab>
              <Tabs.Tab value="recovery" leftSection={<IconKey size={14} />}>Recovery code</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="totp">
              <Stack gap="md">
                <Text size="sm" c="dimmed">Enter the 6-digit code from your authenticator app.</Text>
                <Group justify="center">
                  <PinInput
                    length={6}
                    type="number"
                    value={code}
                    onChange={setCode}
                    onComplete={submitTotp}
                    size="md"
                    oneTimeCode
                  />
                </Group>
                <Button
                  fullWidth
                  size="sm"
                  loading={loading}
                  disabled={code.length !== 6}
                  onClick={submitTotp}
                >
                  Verify
                </Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="recovery">
              <form onSubmit={submitRecovery}>
                <Stack gap="md">
                  <Text size="sm" c="dimmed">Enter one of your saved recovery codes (format: XXXX-XXXX-XXXX).</Text>
                  <TextInput
                    placeholder="XXXX-XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.currentTarget.value)}
                    required
                    size="sm"
                    autoComplete="off"
                  />
                  <Button type="submit" fullWidth size="sm" loading={loading}>
                    Use recovery code
                  </Button>
                </Stack>
              </form>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
    </Box>
  );
}
