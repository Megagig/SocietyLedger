import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Share, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { RosterPersonDTO } from '@/types/api/ajo';
import { formatDay } from '../format';
import { useAjoAction } from '../mutations';
import { guarantorSchema, MIN_GUARANTOR_NOTE, type GuarantorValues } from '../schemas';

export type GuarantorSheetHandle = { open: (person: RosterPersonDTO) => void };

type Mode = 'link' | 'self';

/**
 * A guarantor is a recorded agreement only; nothing is ever taken from them automatically. The officer either sends the guarantor a
 * link (opened in the browser, whether or not they have the app) or records an agreement made in person. The link works once.
 */
export const GuarantorSheet = forwardRef<GuarantorSheetHandle>(function GuarantorSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [person, setPerson] = useState<RosterPersonDTO | null>(null);
  const [mode, setMode] = useState<Mode>('link');
  const [wording, setWording] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; expiresAt: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, getValues, reset } = useForm<GuarantorValues>({ resolver: zodResolver(guarantorSchema), defaultValues: { name: '', phone: '', relationship: '', note: '' }, mode: 'onTouched' });
  const membershipId = person?.membershipId ?? 0;
  const save = useAjoAction((body: Parameters<typeof ajoApi.recordGuarantor>[1]) => ajoApi.recordGuarantor(membershipId, body));
  const makeLink = useAjoAction((body: { name: string; phone: string; relationship: string }) => ajoApi.guarantorLink(membershipId, body));

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setPerson(next);
        sheet.current?.present();
      },
    }),
    [],
  );

  const showWording = async () => {
    const name = getValues('name').trim();
    if (!person || name.length < 2) {
      setProblem('Enter the guarantor’s name first.');
      return;
    }
    setProblem(null);
    try {
      setWording((await ajoApi.guarantorWording(person.membershipId, name)).wording);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not load the wording.');
    }
  };

  const createLink = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const result = await makeLink.mutateAsync({ name: values.name.trim(), phone: values.phone.trim(), relationship: values.relationship.trim() });
      setMade({ link: result.link, expiresAt: result.expiresAt });
      setWording(result.wording);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not create the link.');
    }
  });

  const record = handleSubmit(async (values) => {
    if (!wording) {
      setProblem('Read the wording to the guarantor first, using “Show the wording”.');
      return;
    }
    const note = (values.note ?? '').trim();
    if (note.length < MIN_GUARANTOR_NOTE) {
      setProblem('Say how the guarantor agreed (for example “agreed by phone on 5 March”).');
      return;
    }
    setProblem(null);
    try {
      await save.mutateAsync({ name: values.name.trim(), phone: values.phone.trim(), relationship: values.relationship.trim(), note });
      toast.success('The guarantor’s agreement was recorded.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not record the agreement.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title={`Guarantor for ${person?.name ?? ''}`}
      snapPoints={['92%']}
      onDismiss={() => {
        reset();
        setMode('link');
        setWording(null);
        setMade(null);
        setProblem(null);
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          A guarantor is a recorded agreement only. Nothing is ever taken from them automatically.
        </Text>

        {made ? (
          <View className="gap-3" testID="ajo-guarantor-made">
            <Text variant="body">
              Send this link to {getValues('name')}, for example by WhatsApp or text. It works once and expires on {formatDay(made.expiresAt)}. It is shown only now.
            </Text>
            <View className="rounded-lg bg-surface-sunken p-3">
              <Text variant="caption" testID="ajo-guarantor-link">
                {made.link}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Button
                variant="secondary"
                fullWidth
                onPress={async () => {
                  await Clipboard.setStringAsync(made.link);
                  toast.success('Link copied.');
                }}
                testID="ajo-guarantor-copy"
              >
                Copy
              </Button>
              <Button
                fullWidth
                onPress={() => void Share.share({ message: `Please open this link to agree to be ${person?.name ?? 'a member'}’s guarantor: ${made.link}` })}
                testID="ajo-guarantor-share"
              >
                Share
              </Button>
            </View>
            {wording ? (
              <View className="rounded-lg bg-surface-sunken p-3">
                <Text variant="caption">They will be asked to agree to: {wording}</Text>
              </View>
            ) : null}
            <Text variant="caption" tone="tertiary">
              You are told when they accept, and the member is activated if nothing else is missing. Creating another link replaces this one.
            </Text>
            <Button onPress={() => sheet.current?.dismiss()}>Done</Button>
          </View>
        ) : (
          <>
            <SegmentedControl
              options={[
                { label: 'Send them a link', value: 'link' },
                { label: 'I will record it', value: 'self' },
              ]}
              value={mode}
              onChange={(value) => {
                setMode(value);
                setProblem(null);
              }}
              testID="ajo-guarantor-mode"
            />
            <TextField control={control} name="name" label="Guarantor’s name" testID="ajo-guarantor-name" />
            <TextField control={control} name="phone" label="Phone" keyboardType="phone-pad" testID="ajo-guarantor-phone" />
            <TextField control={control} name="relationship" label="Relationship to the member" testID="ajo-guarantor-relationship" />
            {mode === 'self' ? (
              <>
                <Button variant="soft" size="sm" onPress={() => void showWording()} testID="ajo-guarantor-wording">
                  Show the wording
                </Button>
                {wording ? (
                  <View className="rounded-lg bg-surface-sunken p-3">
                    <Text variant="caption">{wording}</Text>
                  </View>
                ) : null}
                <TextField control={control} name="note" label="How they agreed" multiline testID="ajo-guarantor-note" />
              </>
            ) : null}
            {problem ? (
              <Text variant="body" tone="danger" testID="ajo-guarantor-problem">
                {problem}
              </Text>
            ) : null}
            <View className="flex-row gap-3">
              <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
                Cancel
              </Button>
              {mode === 'link' ? (
                <Button fullWidth loading={makeLink.isPending} onPress={() => void createLink()} testID="ajo-guarantor-create-link">
                  Create the link
                </Button>
              ) : (
                <Button fullWidth loading={save.isPending} onPress={() => void record()} testID="ajo-guarantor-record">
                  Record agreement
                </Button>
              )}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
});
