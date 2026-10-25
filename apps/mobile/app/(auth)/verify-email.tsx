import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';
import { z } from 'zod';
import { Mail } from 'lucide-react-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { OtpInput } from '@/components/forms/OtpInput';
import { Screen } from '@/components/layout/Screen';
import { useResendVerification, useVerifyEmail } from '@/features/auth/mutations';
import { otpSchema, type OtpFormValues } from '@/features/auth/schemas';
import { t } from '@/lib/i18n';
import { parseParams } from '@/lib/params';
import { useThemeTokens } from '@/providers/ThemeProvider';

const RESEND_COOLDOWN_SECONDS = 60;
const paramsSchema = z.object({ email: z.string().email() });

export default function VerifyEmailScreen() {
  const { color } = useThemeTokens();
  const rawParams = useLocalSearchParams();
  const params = parseParams(paramsSchema, rawParams);

  const { control, handleSubmit } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Reached only from Login's EMAIL_NOT_VERIFIED branch, which always supplies `email` — this is
  // a safety net for a malformed/missing param, not a real path.
  useEffect(() => {
    if (!params) router.replace('/(auth)/login');
  }, [params]);

  if (!params) return null;
  const { email } = params;

  function onSubmit({ code }: OtpFormValues) {
    verify.mutate(
      { email, code },
      {
        onSuccess: () => router.replace({ pathname: '/(auth)/pending', params: { email } }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : t('errors.generic')),
      },
    );
  }

  function onResend() {
    if (cooldown > 0) return;
    resend.mutate(
      { email },
      {
        onSuccess: () => {
          setCooldown(RESEND_COOLDOWN_SECONDS);
          toast.success(t('auth.verifyEmail.resent'));
        },
      },
    );
  }

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.verifyEmail.title') }} />
      <AuthBrandMark />
      {/* Hero icon block */}
      <View style={{ alignItems: 'center', paddingVertical: 24, gap: 16 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: color.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mail size={36} color={color.primary} strokeWidth={1.5} />
        </View>
        <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 24 }}>
          <Text variant="h2" align="center">
            {t('auth.verifyEmail.title')}
          </Text>
          <Text variant="body" tone="secondary" align="center">
            {t('auth.verifyEmail.description', { email })}
          </Text>
        </View>
      </View>
      <View className="gap-4">
        <OtpInput control={control} name="code" testID="verify-email-otp" />
        <Button variant="gradient" size="lg" fullWidth loading={verify.isPending} onPress={() => handleSubmit(onSubmit)()} testID="verify-email-submit">
          {t('auth.verifyEmail.verify')}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          fullWidth
          disabled={cooldown > 0}
          loading={resend.isPending}
          onPress={onResend}
          testID="verify-email-resend"
        >
          {cooldown > 0 ? t('auth.verifyEmail.resendCooldown', { seconds: cooldown }) : t('auth.verifyEmail.resend')}
        </Button>
      </View>
    </Screen>
  );
}
