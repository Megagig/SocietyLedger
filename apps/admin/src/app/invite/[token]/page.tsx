'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Card, Stack, Title, Text, TextInput, PasswordInput,
  Button, Alert, Skeleton,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT_AGENT: 'Support Agent',
  FINANCE_ADMIN: 'Finance Admin',
  COMPLIANCE_ADMIN: 'Compliance Admin',
};

interface InviteDetails {
  email: string;
  platformRole: string;
  invitedByEmail: string;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/bff/invite/${params.token}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setLoadError(json.message ?? 'This invite is invalid or has expired.');
          return;
        }
        setInvite(json.data);
      })
      .catch(() => setLoadError('Network error — please try again.'))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/bff/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, firstName, lastName, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.message ?? 'Failed to accept invite.');
        return;
      }
      router.push('/login');
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
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
        style={{ width: 400, backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        p="xl"
        radius="lg"
      >
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={2} ta="center">SocietyLedger</Title>
            <Text size="sm" c="dimmed" ta="center">Accept Admin Invite</Text>
          </Stack>

          {loading ? (
            <Stack gap="md">
              <Skeleton h={36} radius="sm" />
              <Skeleton h={36} radius="sm" />
              <Skeleton h={36} radius="sm" />
            </Stack>
          ) : loadError ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" p="sm">
              <Text size="sm">{loadError}</Text>
            </Alert>
          ) : invite ? (
            <>
              <Text size="sm" c="dimmed" ta="center">
                {invite.invitedByEmail} invited <strong>{invite.email}</strong> as{' '}
                <strong>{ROLE_LABELS[invite.platformRole] ?? invite.platformRole}</strong>
              </Text>

              {submitError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" p="sm">
                  <Text size="sm">{submitError}</Text>
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <TextInput
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.currentTarget.value)}
                    required
                    size="sm"
                  />
                  <TextInput
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.currentTarget.value)}
                    required
                    size="sm"
                  />
                  <PasswordInput
                    label="Password"
                    description="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    required
                    autoComplete="new-password"
                    size="sm"
                  />
                  <PasswordInput
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                    required
                    autoComplete="new-password"
                    size="sm"
                  />
                  <Button type="submit" fullWidth loading={submitting} size="sm" mt="xs">
                    Create account
                  </Button>
                </Stack>
              </form>
            </>
          ) : null}
        </Stack>
      </Card>
    </Box>
  );
}
