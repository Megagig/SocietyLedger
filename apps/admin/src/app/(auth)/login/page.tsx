'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Card, Stack, Title, Text, TextInput, PasswordInput,
  Button, Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('expired') ? 'Your session has expired. Please log in again.' : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/bff/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message ?? 'Invalid credentials');
        return;
      }

      const { requires2fa, requires2faSetup } = json.data ?? {};

      if (requires2fa) {
        router.push('/2fa');
      } else if (requires2faSetup) {
        router.push('/2fa/setup');
      } else {
        const next = params.get('next');
        router.push(next && next.startsWith('/') ? next : '/dashboard');
      }
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
            <Title order={2} ta="center">SocietyLedger</Title>
            <Text size="sm" c="dimmed" ta="center">Platform Administration</Text>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" p="sm">
              <Text size="sm">{error}</Text>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                placeholder="admin@societyledger.com.ng"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                autoComplete="email"
                size="sm"
              />

              <PasswordInput
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                autoComplete="current-password"
                size="sm"
              />

              <Button
                type="submit"
                fullWidth
                loading={loading}
                size="sm"
                mt="xs"
              >
                Sign in
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Box>
  );
}
