import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FolderOpen, Image as ImageIcon, Paperclip, X, type LucideIcon } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type Attachment = { uri: string; name: string; type: string; size?: number };

export type FileAttachFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  /** api-contract.md §6's real multer limits (F0.1) — 3 mimetypes, 5MB. */
  allowedTypes?: string[];
  maxSizeBytes?: number;
  testID?: string;
};

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

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

  const accept = (next: Attachment) => {
    if (!allowedTypes.includes(next.type)) {
      setAttachError('That file type is not supported.');
      return;
    }
    if (next.size && next.size > maxSizeBytes) {
      setAttachError(`File is larger than ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`);
      return;
    }
    setAttachError(null);
    field.onChange(next);
    sheetRef.current?.dismiss();
  };

  // Review finding (Phase 1 retro): a denied permission or a picker throwing used to silently
  // no-op — the sheet just sat there with no feedback. Reuse `attachError`/`FieldShell`'s own
  // helper-text slot (consistent with this component's existing validation-error pattern) rather
  // than introducing a new toast for what's still a form-field-scoped error.
  const fromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setAttachError('Camera permission is needed to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        accept({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
      }
    } catch {
      setAttachError('Could not open the camera. Try again.');
    }
  };

  const fromPhotos = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setAttachError('Photo library permission is needed to choose a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        accept({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
      }
    } catch {
      setAttachError('Could not open your photos. Try again.');
    }
  };

  const fromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: allowedTypes, copyToCacheDirectory: true });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        accept({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? undefined });
      }
    } catch {
      setAttachError('Could not open Files. Try again.');
    }
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

      <BottomSheet ref={sheetRef} title="Attach a file">
        <View className="gap-1 pb-4">
          <SheetAction icon={Camera} label="Take a photo" onPress={fromCamera} />
          <SheetAction icon={ImageIcon} label="Choose from photos" onPress={fromPhotos} />
          <SheetAction icon={FolderOpen} label="Choose a file" onPress={fromFiles} />
        </View>
      </BottomSheet>
    </FieldShell>
  );
}

function SheetAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { color } = useThemeTokens();
  return (
    <Pressable onPress={onPress} className="h-12 flex-row items-center gap-3 px-1">
      <Icon size={20} color={color.text} strokeWidth={1.75} />
      <Text variant="body-lg">{label}</Text>
    </Pressable>
  );
}
