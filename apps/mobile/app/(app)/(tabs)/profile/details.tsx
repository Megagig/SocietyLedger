import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useUpdateProfile } from '@/features/session/mutations';
import { useProfile } from '@/features/session/queries';
import { t } from '@/lib/i18n';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** project-overview.md §6.7 P2 — edit personal info (firstName, lastName, phone). */
export default function ProfileDetailsScreen() {
  const router = useRouter();
  const profileQuery = useProfile();
  const update = useUpdateProfile();

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profileQuery.data
      ? {
          firstName: profileQuery.data.firstName,
          lastName: profileQuery.data.lastName,
          phone: profileQuery.data.phone ?? '',
        }
      : undefined,
  });

  function onSubmit(data: FormValues) {
    update.mutate(data, {
      onSuccess: () => {
        toast.success(t('profile.details.success'));
        router.back();
      },
      onError: () => toast.error('Could not update profile. Try again.'),
    });
  }

  return (
    <Screen edges={['top', 'bottom']} scroll keyboard>
      <ScreenHeader title={t('profile.details.title')} onBack={() => router.back()} />

      {profileQuery.isPending && (
        <View className="gap-4 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={52} />
          ))}
        </View>
      )}

      {profileQuery.isError && <ErrorState onRetry={() => profileQuery.refetch()} />}

      {profileQuery.isSuccess && (
        <View className="gap-6">
          <Section>
            <TextField
              control={control}
              name="firstName"
              label={t('profile.details.firstName')}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextField
              control={control}
              name="lastName"
              label={t('profile.details.lastName')}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextField
              control={control}
              name="phone"
              label={t('profile.details.phone')}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </Section>

          {/* Read-only fields */}
          <Section>
            <View className="gap-1 py-3">
              <Text variant="caption" tone="secondary">{t('profile.details.email')}</Text>
              <Text variant="body">{profileQuery.data.email ?? '—'}</Text>
            </View>
            <View className="gap-1 py-3">
              <Text variant="caption" tone="secondary">{t('profile.details.memberId')}</Text>
              <Text variant="body">{profileQuery.data.memberId}</Text>
            </View>
          </Section>

          <StickyFooter>
            <Button
              variant="primary"
              loading={update.isPending}
              onPress={() => { handleSubmit(onSubmit)(); }}
              fullWidth
            >
              {t('profile.details.save')}
            </Button>
          </StickyFooter>
        </View>
      )}
    </Screen>
  );
}
