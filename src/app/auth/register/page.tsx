'use client';

import { useState } from 'react';
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
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconUserPlus, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<RegisterForm>({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) =>
        value.length < 6 ? 'Password must be at least 6 characters' : null,
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords did not match' : null,
      firstName: (value) =>
        value.length < 2 ? 'First name must be at least 2 characters' : null,
      lastName: (value) =>
        value.length < 2 ? 'Last name must be at least 2 characters' : null,
    },
  });

  const handleSubmit = async (values: RegisterForm) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setSuccess(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container size={420} className="min-h-screen flex items-center">
        <div className="w-full">
          <Paper withBorder shadow="md" p={30} radius="md">
            <Alert
              icon={<IconCheck size="1rem" />}
              title="Registration Successful"
              color="green"
              className="mb-4"
            >
              Your account has been created successfully. Please wait for admin
              approval before you can log in.
            </Alert>

            <Group justify="center" mt="lg">
              <Anchor component={Link} href="/auth/login" size="sm">
                Return to Login
              </Anchor>
            </Group>
          </Paper>
        </div>
      </Container>
    );
  }

  return (
    <Container size={420} className="min-h-screen flex items-center">
      <div className="w-full">
        <Paper withBorder shadow="md" p={30} radius="md">
          <Title ta="center" className="text-2xl font-bold mb-6">
            Create Account
          </Title>

          <Text ta="center" size="sm" className="text-gray-600 mb-6">
            Registration requires admin approval before you can log in.
          </Text>

          {error && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title="Registration Error"
              color="red"
              className="mb-4"
            >
              {error}
            </Alert>
          )}

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="Enter your first name"
                  required
                  {...form.getInputProps('firstName')}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Enter your last name"
                  required
                  {...form.getInputProps('lastName')}
                />
              </Group>

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

              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                required
                {...form.getInputProps('confirmPassword')}
              />

              <Button
                type="submit"
                fullWidth
                leftSection={<IconUserPlus size="1rem" />}
                loading={loading}
              >
                Register
              </Button>
            </Stack>
          </form>

          <Group justify="center" mt="lg">
            <Anchor component={Link} href="/auth/login" size="sm">
              Already have an account? Login here
            </Anchor>
          </Group>
        </Paper>
      </div>
    </Container>
  );
}