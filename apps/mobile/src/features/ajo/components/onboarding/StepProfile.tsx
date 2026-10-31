import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { LOGO_TYPES, MAX_LOGO_BYTES, profileStepSchema, type ProfileStepValues } from '../../schemas';
import { NIGERIAN_STATES, splitAddress } from '../../states';

/** Step 1: confirm who the group is. Saved with the same calls the association profile uses; the group address never changes. */
export function StepProfile({ groupName, onDone, onSkip }: { groupName: string; onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, reset } = useForm<ProfileStepValues>({
    resolver: zodResolver(profileStepSchema),
    defaultValues: { name: groupName, phone: '', email: '', area: '', state: '', logo: null },
    mode: 'onTouched',
  });

  // What is already saved (the sign-up phone and email, or an earlier visit) is the starting point.
  useEffect(() => {
    let cancelled = false;
    ajoApi
      .profile()
      .then((p) => {
        if (cancelled) return;
        const { area, state } = splitAddress(p.address);
        reset({ name: groupName, phone: p.phone ?? '', email: p.email ?? '', area, state, logo: null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [groupName, reset]);

  const save = handleSubmit(async (values) => {
    if (values.logo && (!LOGO_TYPES.includes(values.logo.type) || (values.logo.size ?? 0) > MAX_LOGO_BYTES)) {
      setProblem('The logo must be a PNG or JPG of up to 2 MB.');
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      await ajoApi.saveProfile({ name: values.name.trim(), address: [values.area?.trim(), values.state].filter(Boolean).join(', '), phone: values.phone.trim(), email: values.email.trim() });
      if (values.logo) await ajoApi.uploadLogo({ uri: values.logo.uri, name: values.logo.name, type: values.logo.type });
      await onDone();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not save the profile. Please try again.');
      setBusy(false);
    }
  });

  return (
    <View className="gap-4" testID="ajo-step-profile">
      <TextField control={control} name="name" label="Group name" helper="Changing the name does not change your group address." maxLength={80} testID="ajo-profile-name" />
      <TextField control={control} name="phone" label="Contact phone" keyboardType="phone-pad" testID="ajo-profile-phone" />
      <TextField control={control} name="email" label="Contact email (optional)" keyboardType="email-address" autoCapitalize="none" testID="ajo-profile-email" />
      <TextField control={control} name="area" label="Where the group meets (area or town, optional)" testID="ajo-profile-area" />
      <SelectSheet control={control} name="state" label="State (optional)" placeholder="Choose a state" options={NIGERIAN_STATES.map((s) => ({ value: s, label: s }))} testID="ajo-profile-state" />
      <FileAttachField control={control} name="logo" label="Logo (optional)" helper="PNG or JPG, up to 2 MB." allowedTypes={LOGO_TYPES} maxSizeBytes={MAX_LOGO_BYTES} testID="ajo-profile-logo" />
      {problem ? (
        <Text variant="body" tone="danger">
          {problem}
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void onSkip().finally(() => setBusy(false));
          }}
          testID="ajo-profile-skip"
        >
          Skip this step
        </Button>
        <Button fullWidth loading={busy} onPress={() => void save()} testID="ajo-profile-save">
          Save and continue
        </Button>
      </View>
    </View>
  );
}
