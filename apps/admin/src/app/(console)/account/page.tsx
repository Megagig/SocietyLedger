'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, Card, Group, Text, Button, TextInput, PasswordInput,
  Skeleton, Avatar, Divider, Badge, Alert,
} from '@mantine/core';
import { IconShield, IconCheck, IconUser, IconAlertTriangle } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminProfile {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  platformRole: string;
  createdAt: string;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="xl"
      radius="lg"
    >
      <Stack gap="xs" mb="lg">
        <Text fw={700} size="md">{title}</Text>
        {description && <Text size="sm" c="dimmed">{description}</Text>}
      </Stack>
      {children}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const profileQ = useQuery({
    queryKey: ['admin-profile'],
    queryFn: () => bff<AdminProfile>('admin/me'),
  });

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileDirty, setProfileDirty] = useState(false);

  useEffect(() => {
    if (profileQ.data && !profileDirty) {
      setFirstName(profileQ.data.firstName ?? '');
      setLastName(profileQ.data.lastName ?? '');
    }
  }, [profileQ.data, profileDirty]);

  const profileMut = useMutation({
    mutationFn: () => bff('admin/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: firstName || null, lastName: lastName || null }),
    }),
    onSuccess: () => {
      notifications.show({ message: 'Profile updated', color: 'green' });
      setProfileDirty(false);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordMut = useMutation({
    mutationFn: () => bff('admin/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    onSuccess: () => {
      notifications.show({ message: 'Password changed', color: 'green' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const profile = profileQ.data;
  const initials = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('') || profile?.email?.[0]?.toUpperCase() || '?';

  const passwordsMatch = newPassword === confirmPassword;
  const passwordValid = newPassword.length >= 8 && passwordsMatch;

  if (profileQ.isError) {
    return <ErrorState message={(profileQ.error as Error).message} onRetry={() => profileQ.refetch()} />;
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="My Account"
        description="Manage your platform admin profile and credentials"
      />

      {/* Profile header */}
      {profileQ.isLoading ? (
        <Card
          style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
          p="xl" radius="lg"
        >
          <Group gap="md">
            <Skeleton circle h={60} />
            <Stack gap="xs">
              <Skeleton h={16} w={140} />
              <Skeleton h={12} w={200} />
            </Stack>
          </Group>
        </Card>
      ) : profile ? (
        <Card
          style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
          p="xl" radius="lg"
        >
          <Group gap="md">
            <Avatar size={60} radius="xl" color="blue">
              {initials}
            </Avatar>
            <Stack gap="xs">
              <Group gap="sm">
                <Text fw={700} size="lg">
                  {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email}
                </Text>
                <Badge variant="light" color="violet" size="sm">{profile.platformRole}</Badge>
                {profile.twoFactorEnabled && (
                  <Badge variant="light" color="green" size="sm" leftSection={<IconShield size={10} />}>
                    2FA enabled
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">{profile.email}</Text>
              {profile.lastLoginAt && (
                <Text size="xs" c="dimmed">
                  Last login: {new Date(profile.lastLoginAt).toLocaleString('en-NG', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              )}
            </Stack>
          </Group>
        </Card>
      ) : null}

      {/* Profile update */}
      <SectionCard
        title="Profile"
        description="Update your display name. Your email cannot be changed here."
      >
        <Stack gap="md" maw={480}>
          <Group gap="md" grow>
            <TextInput
              label="First name"
              value={firstName}
              onChange={(e) => { setFirstName(e.currentTarget.value); setProfileDirty(true); }}
              size="sm"
              disabled={profileQ.isLoading}
            />
            <TextInput
              label="Last name"
              value={lastName}
              onChange={(e) => { setLastName(e.currentTarget.value); setProfileDirty(true); }}
              size="sm"
              disabled={profileQ.isLoading}
            />
          </Group>
          <TextInput
            label="Email"
            value={profile?.email ?? ''}
            disabled
            size="sm"
            description="Contact a superadmin to change your email address."
          />
          {profileDirty && (
            <Button
              size="sm"
              leftSection={<IconCheck size={14} />}
              loading={profileMut.isPending}
              onClick={() => profileMut.mutate()}
              maw={160}
            >
              Save profile
            </Button>
          )}
        </Stack>
      </SectionCard>

      {/* Password change */}
      <SectionCard
        title="Change password"
        description="Choose a strong password of at least 8 characters."
      >
        <Stack gap="md" maw={400}>
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            size="sm"
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            size="sm"
            autoComplete="new-password"
            description="At least 8 characters."
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            size="sm"
            error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
            autoComplete="new-password"
          />
          <Button
            size="sm"
            leftSection={<IconCheck size={14} />}
            loading={passwordMut.isPending}
            disabled={!currentPassword || !passwordValid}
            onClick={() => passwordMut.mutate()}
            maw={180}
          >
            Change password
          </Button>
        </Stack>
      </SectionCard>

      {/* 2FA notice */}
      {!profile?.twoFactorEnabled && (
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
          <Text size="sm">
            Two-factor authentication is not enabled on your account. Enable it for stronger security.
          </Text>
        </Alert>
      )}
    </Stack>
  );
}
