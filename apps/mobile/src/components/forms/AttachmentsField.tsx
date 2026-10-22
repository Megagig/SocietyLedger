import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { AttachSourceSheet, pickFrom, type AttachSource } from './AttachSourceSheet';
import { DEFAULT_ALLOWED_TYPES, DEFAULT_MAX_SIZE_BYTES, validateAttachment, type Attachment } from './attachmentPickers';
import { FieldShell } from './FieldShell';

export type AttachmentsFieldProps = {
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
  label?: string;
  helper?: string;
  /** How many files may be attached. Matches the API's per-message limit. */
  max?: number;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  disabled?: boolean;
  testID?: string;
};

/**
 * Several files on one message — a controlled sibling of `FileAttachField` (which holds a single file in a form
 * field). Camera / Photos / Files through the same sheet, each file checked for type and size as it is picked, shown
 * as removable rows, with the add button hidden once `max` is reached.
 */
export function AttachmentsField({
  files,
  onChange,
  label,
  helper,
  max = 3,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  disabled = false,
  testID,
}: AttachmentsFieldProps) {
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: AttachSource) => {
    const result = await pickFrom(source, allowedTypes);
    if (!result) return;
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const problem = validateAttachment(result.attachment, allowedTypes, maxSizeBytes);
    if (problem) {
      setError(problem);
      return;
    }
    if (files.some((f) => f.uri === result.attachment.uri)) {
      setError('That file is already attached.');
      return;
    }
    setError(null);
    onChange([...files, result.attachment].slice(0, max));
    sheetRef.current?.dismiss();
  };

  return (
    <FieldShell label={label} helper={error ?? helper}>
      <View className="gap-2" testID={testID}>
        {files.map((file, index) => (
          <View key={`${file.uri}-${index}`} className="flex-row items-center justify-between rounded-md border border-border bg-surface px-3 py-1">
            <View className="flex-1 flex-row items-center gap-2">
              {file.type.startsWith('image/') ? (
                <ImageIcon size={18} color={color.textSecondary} strokeWidth={1.75} />
              ) : (
                <FileText size={18} color={color.textSecondary} strokeWidth={1.75} />
              )}
              <Text variant="body" numberOfLines={1} className="flex-1">
                {file.name}
              </Text>
            </View>
            <IconButton icon={X} accessibilityLabel={`Remove ${file.name}`} onPress={() => onChange(files.filter((_, i) => i !== index))} />
          </View>
        ))}

        {files.length < max ? (
          <Pressable
            disabled={disabled}
            onPress={() => sheetRef.current?.present()}
            accessibilityRole="button"
            accessibilityLabel={files.length === 0 ? 'Attach files' : 'Attach another file'}
            className="h-[48px] flex-row items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-sunken px-4"
          >
            <Paperclip size={18} color={color.textSecondary} strokeWidth={1.75} />
            <Text variant="body" tone="secondary">
              {files.length === 0 ? 'Attach files' : 'Attach another file'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <AttachSourceSheet ref={sheetRef} onPick={pick} />
    </FieldShell>
  );
}
