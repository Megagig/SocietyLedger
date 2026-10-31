import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { SUBDOMAIN_REMINDER, associationAddress, subdomainProblem, suggestSubdomain } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { Checkbox } from '@/components/forms/Checkbox';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useCreateThriftGroup } from '@/features/thriftSignup/mutations';
import { thriftSignupSchema, toThriftPayload, type ThriftSignupValues } from '@/features/thriftSignup/schemas';
import { useCheckSubdomain } from '@/features/tenant/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTenantStore } from '@/stores/tenant';

/**
 * T7.6 on the phone: a thrift group signs up on its own, with no association behind it. It uses only Ajo and pays only for an Ajo tier
 * (a 14-day trial with the Starter tier free). The server keeps this closed until platform staff switch it on, and the screen says so plainly.
 */
export default function CreateThriftGroupScreen() {
  const create = useCreateThriftGroup();
  const setCurrentTenant = useTenantStore((state) => state.setCurrent);
  const [closed, setClosed] = useState(false);
  const { control, handleSubmit, setValue } = useForm<ThriftSignupValues>({
    resolver: zodResolver(thriftSignupSchema),
    mode: 'onTouched',
    defaultValues: { groupName: '', subdomain: '', firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', acceptTerms: false },
  });
  const groupName = useWatch({ control, name: 'groupName' }) ?? '';
  const subdomain = (useWatch({ control, name: 'subdomain' }) ?? '').trim().toLowerCase();

  // The address follows the group name until the person types their own.
  const lastSuggestion = useRef('');
  useEffect(() => {
    const suggestion = suggestSubdomain(groupName);
    if (subdomain === '' || subdomain === lastSuggestion.current) {
      lastSuggestion.current = suggestion;
      setValue('subdomain', suggestion, { shouldValidate: false });
    }
  }, [groupName, subdomain, setValue]);

  // Check the address a moment after they stop typing.
  const debounced = useDebouncedValue(subdomain, 450);
  const problem = debounced ? subdomainProblem(debounced) : 'TOO_SHORT';
  const lookup = useCheckSubdomain(debounced, !problem);
  const settled = debounced === subdomain && !problem;
  const lookupError = lookup.error instanceof ApiError ? lookup.error : null;
  const available = settled && lookup.isError && lookupError?.status === 404;
  const taken = settled && (lookup.isSuccess || (lookup.isError && lookupError !== null && lookupError.status !== 404));

  function onSubmit(values: ThriftSignupValues) {
    create.mutate(toThriftPayload(values), {
      onSuccess: ({ signup, tenant }) => {
        toast.success('Your group was created.');
        if (!tenant) {
          router.replace('/(auth)/association');
          return;
        }
        setCurrentTenant(tenant);
        const email = signup.user.email;
        router.replace(signup.requiresVerification ? { pathname: '/(auth)/verify-email', params: { email } } : { pathname: '/(auth)/pending', params: { email } });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'THRIFT_SIGNUP_CLOSED') {
          setClosed(true);
          return;
        }
        toast.error(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
      },
    });
  }

  if (closed) {
    return (
      <Screen edges={['top']}>
        <Stack.Screen options={{ title: 'Start a thrift group' }} />
        <AuthBrandMark />
        <ScreenHeader title="Start a thrift group" large onBack={() => router.back()} />
        <View className="items-center gap-3 px-4 py-10" testID="thrift-signup-closed">
          <Text variant="h3" align="center">
            Thrift group sign-up is not open yet
          </Text>
          <Text variant="body" tone="secondary" align="center">
            We are not accepting new thrift groups right now. Please check back soon.
          </Text>
          <Text variant="caption" tone="tertiary" align="center">
            Already part of an association? Sign up your association and add the Ajo add-on.
          </Text>
          <Button variant="secondary" onPress={() => router.replace('/(auth)/create-association')}>
            Create an association
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: 'Start a thrift group' }} />
      <AuthBrandMark />
      <ScreenHeader title="Start a thrift group" large onBack={() => router.back()} />
      <Text variant="body" tone="secondary" className="mb-4">
        Run your savings circle (ajo, esusu, adashe) with proper records. You do not need an association. You pay only for Ajo, and SocietyLedger never holds your group&apos;s money.
      </Text>

      <View className="gap-4">
        <View className="rounded-lg bg-warning-soft p-3">
          <Text variant="caption" tone="warning">
            {SUBDOMAIN_REMINDER}
          </Text>
        </View>
        <TextField control={control} name="groupName" label="Group name" placeholder="e.g. Aba Market Women" autoCapitalize="words" maxLength={80} returnKeyType="next" testID="thrift-signup-name" />
        <TextField control={control} name="subdomain" label="Your group address" helper="Lowercase letters, numbers and hyphens. This is what your members type to find you." autoCapitalize="none" testID="thrift-signup-address" />
        {subdomain && !subdomainProblem(subdomain) ? (
          <Card>
            <Text variant="caption" tone="secondary" testID="thrift-signup-preview">
              Members will sign in at {associationAddress(subdomain)}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              {settled && lookup.isFetching ? <Spinner /> : null}
              {settled && lookup.isFetching ? (
                <Text variant="caption" tone="secondary">
                  Checking…
                </Text>
              ) : null}
              {!lookup.isFetching && available ? (
                <Text variant="caption" tone="success" testID="thrift-signup-available">
                  That address is free.
                </Text>
              ) : null}
              {!lookup.isFetching && taken ? (
                <Text variant="caption" tone="danger" testID="thrift-signup-taken">
                  That address is already taken.
                </Text>
              ) : null}
            </View>
          </Card>
        ) : null}
        <TextField control={control} name="firstName" label="Your first name" autoCapitalize="words" returnKeyType="next" testID="thrift-signup-first-name" />
        <TextField control={control} name="lastName" label="Your last name" autoCapitalize="words" returnKeyType="next" testID="thrift-signup-last-name" />
        <TextField control={control} name="email" label="Email" keyboardType="email-address" returnKeyType="next" testID="thrift-signup-email" />
        <TextField control={control} name="phone" label="Phone number" keyboardType="phone-pad" returnKeyType="next" testID="thrift-signup-phone" />
        <PasswordField control={control} name="password" label="Password" showStrength testID="thrift-signup-password" />
        <PasswordField control={control} name="confirmPassword" label="Confirm password" testID="thrift-signup-confirm" />
        <Checkbox control={control} name="acceptTerms" label="I accept the terms and privacy policy" testID="thrift-signup-terms" />
        <Button variant="gradient" size="lg" fullWidth loading={create.isPending} disabled={taken} onPress={() => void handleSubmit(onSubmit)()} testID="thrift-signup-submit">
          Create my group
        </Button>
      </View>

      <View className="mt-6 items-center gap-1">
        <Button variant="ghost" size="md" onPress={() => router.replace('/(auth)/create-association')}>
          Part of an association? Sign up your association
        </Button>
        <Button variant="ghost" size="md" onPress={() => router.replace('/(auth)/association')} testID="thrift-signup-sign-in">
          Already have an account? Sign in
        </Button>
      </View>
    </Screen>
  );
}
