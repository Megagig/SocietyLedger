import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner-native';
import {
  ASSOCIATION_TYPES,
  ASSOCIATION_TYPE_OTHER,
  SUBDOMAIN_REMINDER,
  associationAddress,
  subdomainProblem,
  suggestSubdomain,
} from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { Checkbox } from '@/components/forms/Checkbox';
import { PasswordField } from '@/components/forms/PasswordField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useCreateAssociation } from '@/features/associationSignup/mutations';
import {
  createAssociationSchema,
  STEP_ONE_FIELDS,
  STEP_TWO_FIELDS,
  toSignupPayload,
  type CreateAssociationFormValues,
} from '@/features/associationSignup/schemas';
import { useCheckSubdomain } from '@/features/tenant/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { t } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

const TYPE_OPTIONS = ASSOCIATION_TYPES.map((type) => ({ label: type.label, value: type.key as string }));

/** A13 — creates a new association in two steps: (1) its name, kind and address, (2) the founding admin. The founder then verifies their
 * email and waits for the SaaS owner to approve the account, exactly like the web signup. */
export default function CreateAssociationScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const create = useCreateAssociation();
  const setCurrentTenant = useTenantStore((state) => state.setCurrent);

  const { control, handleSubmit, trigger, setValue } = useForm<CreateAssociationFormValues>({
    resolver: zodResolver(createAssociationSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      type: '',
      customType: '',
      subdomain: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const name = useWatch({ control, name: 'name' }) ?? '';
  const type = useWatch({ control, name: 'type' });
  const subdomain = (useWatch({ control, name: 'subdomain' }) ?? '').trim().toLowerCase();

  // Suggest an address from the name until they type one of their own.
  const lastSuggestion = useRef('');
  useEffect(() => {
    const suggestion = suggestSubdomain(name);
    if (subdomain === '' || subdomain === lastSuggestion.current) {
      lastSuggestion.current = suggestion;
      setValue('subdomain', suggestion, { shouldValidate: false });
    }
  }, [name, subdomain, setValue]);

  // Check the address a moment after they stop typing.
  const debounced = useDebouncedValue(subdomain, 450);
  const problem = debounced ? subdomainProblem(debounced) : 'TOO_SHORT';
  const lookup = useCheckSubdomain(debounced, !problem);
  const settled = debounced === subdomain && !problem;
  const lookupError = lookup.error instanceof ApiError ? lookup.error : null;
  const available = settled && lookup.isError && lookupError?.status === 404;
  const taken = settled && (lookup.isSuccess || (lookup.isError && lookupError !== null && lookupError.status !== 404));
  const checkFailed = settled && lookup.isError && lookupError === null;

  async function goToStepTwo() {
    const ok = await trigger([...STEP_ONE_FIELDS]);
    if (!ok) return;
    if (taken) {
      toast.error(t('auth.createAssociation.taken'));
      return;
    }
    setStep(2);
  }

  function onSubmit(values: CreateAssociationFormValues) {
    create.mutate(toSignupPayload(values), {
      onSuccess: ({ signup, tenant }) => {
        toast.success(t('auth.createAssociation.created'));
        if (!tenant) {
          // Created, but we could not adopt it: the code screen can find it by its address.
          router.replace('/(auth)/association');
          return;
        }
        setCurrentTenant(tenant);
        const email = signup.user.email;
        router.replace(
          signup.requiresVerification
            ? { pathname: '/(auth)/verify-email', params: { email } }
            : { pathname: '/(auth)/pending', params: { email } },
        );
      },
      onError: (error) => {
        if (error instanceof ApiError && (error.code === 'SUBDOMAIN_TAKEN' || error.code === 'SUBDOMAIN_RESERVED')) {
          setStep(1);
          toast.error(error.message);
          return;
        }
        if (error instanceof ApiError && error.code === 'SIGNUPS_CLOSED') {
          toast.error(t('auth.createAssociation.signupsClosed'));
          return;
        }
        toast.error(error instanceof ApiError ? error.message : t('errors.generic'));
      },
    });
  }

  async function submit() {
    const ok = await trigger([...STEP_TWO_FIELDS]);
    if (!ok) return;
    void handleSubmit(onSubmit)();
  }

  function goBack() {
    if (step === 2) setStep(1);
    else router.back();
  }

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.createAssociation.title') }} />
      <AuthBrandMark />
      <ScreenHeader title={t('auth.createAssociation.title')} large onBack={goBack} />
      <Text variant="caption" tone="secondary" className="mb-4">
        {t('auth.createAssociation.stepOf', { current: step, total: 2 })} · {step === 1 ? t('auth.createAssociation.step1Title') : t('auth.createAssociation.step2Title')}
      </Text>

      {step === 1 ? (
        <View className="gap-4">
          <View className="rounded-lg bg-warning-soft p-3">
            <Text variant="caption" tone="warning" testID="create-association-reminder">
              {SUBDOMAIN_REMINDER}
            </Text>
          </View>
          <TextField
            control={control}
            name="name"
            label={t('auth.createAssociation.nameLabel')}
            placeholder={t('auth.createAssociation.namePlaceholder')}
            autoCapitalize="words"
            returnKeyType="next"
            testID="create-association-name"
          />
          <SelectSheet
            control={control}
            name="type"
            label={t('auth.createAssociation.typeLabel')}
            placeholder={t('auth.createAssociation.typePlaceholder')}
            options={TYPE_OPTIONS}
            testID="create-association-type"
          />
          {type === ASSOCIATION_TYPE_OTHER ? (
            <TextField
              control={control}
              name="customType"
              label={t('auth.createAssociation.customTypeLabel')}
              placeholder={t('auth.createAssociation.customTypePlaceholder')}
              autoCapitalize="sentences"
              testID="create-association-custom-type"
            />
          ) : null}
          <TextField
            control={control}
            name="subdomain"
            label={t('auth.createAssociation.addressLabel')}
            helper={t('auth.createAssociation.addressHelper')}
            autoCapitalize="none"
            testID="create-association-address"
          />
          <AddressStatus
            address={subdomain}
            valid={!subdomainProblem(subdomain)}
            checking={settled && lookup.isFetching}
            available={available}
            taken={taken}
            checkFailed={checkFailed}
          />
          <Button variant="gradient" size="lg" fullWidth onPress={() => void goToStepTwo()} testID="create-association-next">
            {t('auth.createAssociation.next')}
          </Button>
        </View>
      ) : (
        <View className="gap-4">
          <TextField control={control} name="firstName" label={t('auth.register.firstNameLabel')} autoCapitalize="words" returnKeyType="next" testID="create-association-first-name" />
          <TextField control={control} name="lastName" label={t('auth.register.lastNameLabel')} autoCapitalize="words" returnKeyType="next" testID="create-association-last-name" />
          <TextField control={control} name="email" label={t('auth.register.emailLabel')} keyboardType="email-address" returnKeyType="next" testID="create-association-email" />
          <TextField control={control} name="phone" label={t('auth.createAssociation.phoneLabel')} keyboardType="phone-pad" returnKeyType="next" testID="create-association-phone" />
          <PasswordField control={control} name="password" label={t('auth.login.passwordLabel')} showStrength testID="create-association-password" />
          <PasswordField control={control} name="confirmPassword" label={t('auth.register.confirmPasswordLabel')} testID="create-association-confirm-password" />
          <Checkbox control={control} name="acceptTerms" label={t('auth.register.acceptTerms')} testID="create-association-terms" />
          <Button variant="gradient" size="lg" fullWidth loading={create.isPending} onPress={() => void submit()} testID="create-association-submit">
            {t('auth.createAssociation.submit')}
          </Button>
        </View>
      )}

      <View className="mt-6 items-center">
        <Button variant="ghost" size="md" onPress={() => router.replace('/(auth)/association')} testID="create-association-sign-in">
          {t('auth.createAssociation.signIn')}
        </Button>
      </View>
    </Screen>
  );
}

function AddressStatus({
  address,
  valid,
  checking,
  available,
  taken,
  checkFailed,
}: {
  address: string;
  valid: boolean;
  checking: boolean;
  available: boolean;
  taken: boolean;
  checkFailed: boolean;
}) {
  if (!address || !valid) return null;
  return (
    <Card>
      <Text variant="caption" tone="secondary" testID="create-association-preview">
        {t('auth.createAssociation.addressPreview', { address: associationAddress(address) })}
      </Text>
      <View className="mt-2 flex-row items-center gap-2">
        {checking ? <Spinner /> : null}
        {checking ? <Text variant="caption" tone="secondary">{t('auth.createAssociation.checking')}</Text> : null}
        {!checking && available ? <Text variant="caption" tone="success" testID="create-association-available">{t('auth.createAssociation.available')}</Text> : null}
        {!checking && taken ? <Text variant="caption" tone="danger" testID="create-association-taken">{t('auth.createAssociation.taken')}</Text> : null}
        {!checking && checkFailed ? <Text variant="caption" tone="warning">{t('auth.createAssociation.checkFailed')}</Text> : null}
      </View>
    </Card>
  );
}
