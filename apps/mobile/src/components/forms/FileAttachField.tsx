import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Paperclip, X } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { AttachSourceSheet, pickFrom, type AttachSource } from './AttachSourceSheet';
import { DEFAULT_ALLOWED_TYPES, DEFAULT_MAX_SIZE_BYTES, validateAttachment, type Attachment } from './attachmentPickers';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type { Attachment };

export type FileAttachFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  /** api-contract.md §6's real multer limits (F0.1) — 3 mimetypes, 5MB. */
  allowedTypes?: string[];
  maxSizeBytes?: number;
  testID?: string;
};

/** ui-rules.md/library-docs.md — Camera / Photos / Files via a quick-actions BottomSheet. Images compressed to quality 0.7 (max-dimension resize deferred — no `expo-image-manipulator` pinned yet, library-docs.md's own table explicitly allows this). */
export function FileAttachField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  testID,
}: FileAttachFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const attachment = (field.value as Attachment | null | undefined) ?? null;

  const pick = async (source: AttachSource) => {
    const result = await pickFrom(source, allowedTypes);
    if (!result) return;
    if ('error' in result) {
      setAttachError(result.error);
      return;
    }
    const problem = validateAttachment(result.attachment, allowedTypes, maxSizeBytes);
    if (problem) {
      setAttachError(problem);
      return;
    }
    setAttachError(null);
    field.onChange(result.attachment);
    sheetRef.current?.dismiss();
  };

  return (
    <FieldShell label={label} helper={attachError ?? helper} error={fieldState.error?.message}>
      {attachment ? (
        <View className="flex-row items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Paperclip size={18} color={color.textSecondary} strokeWidth={1.75} />
            <Text variant="body" numberOfLines={1} className="max-w-[200px]">
              {attachment.name}
            </Text>
          </View>
          <IconButton icon={X} accessibilityLabel="Remove attachment" onPress={() => field.onChange(null)} />
        </View>
      ) : (
        <Pressable
          testID={testID}
          onPress={() => sheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel={label ?? 'Attach a file'}
          className="h-[52px] flex-row items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-sunken px-4"
        >
          <Paperclip size={18} color={color.textSecondary} strokeWidth={1.75} />
          <Text variant="body" tone="secondary">
            Attach a file
          </Text>
        </Pressable>
      )}

      <AttachSourceSheet ref={sheetRef} onPick={pick} />
    </FieldShell>
  );
}
