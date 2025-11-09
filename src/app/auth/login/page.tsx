'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Anchor,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconLogin } from '@tabler/icons-react';
import Link from 'next/link';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length > 0 ? null : 'Password is required'),
    },
  });

  const { login, isLoading: authLoading, error: authError } = useAuthStore();

  const handleSubmit = async (values: LoginForm) => {
    const success = await login(values);
    
    if (success) {
      // Redirect to dashboard
      window.location.href = '/dashboard';
    }
  };

  return (
    <Container size={420} className="min-h-screen flex items-center">
      <div className="w-full">
        <Paper withBorder shadow="md" p={30} radius="md">
          <Title ta="center" className="text-2xl font-bold mb-6">
            Welcome Back
          </Title>

          {error && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title="Login Error"
              color="red"
              className="mb-4"
            >
              {error}
            </Alert>
          )}

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="Enter your email"
                required
                {...form.getInputProps('email')}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                required
                {...form.getInputProps('password')}
              />

              <Button
                type="submit"
                fullWidth
                leftSection={<IconLogin size="1rem" />}
                loading={loading}
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Group justify="center" mt="lg">
            <Anchor component={Link} href="/auth/register" size="sm">
              Don't have an account? Register here
            </Anchor>
          </Group>
        </Paper>
      </div>
    </Container>
  );
}