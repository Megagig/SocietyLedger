import { forwardRef } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Camera, FolderOpen, Image as ImageIcon, type LucideIcon } from 'lucide-react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { pickFromCamera, pickFromFiles, pickFromPhotos, type PickResult } from './attachmentPickers';

export type AttachSource = 'camera' | 'photos' | 'files';

/** Runs the picker for a source. Files honours the allowed types; camera and photos always produce images. */
export function pickFrom(source: AttachSource, allowedTypes?: string[]): Promise<PickResult> {
  return source === 'camera' ? pickFromCamera() : source === 'photos' ? pickFromPhotos() : pickFromFiles(allowedTypes);
}

function SheetAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { color } = useThemeTokens();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="h-12 flex-row items-center gap-3 px-1">
      <Icon size={20} color={color.text} strokeWidth={1.75} />
      <Text variant="body-lg">{label}</Text>
    </Pressable>
  );
}

/** ui-rules.md/library-docs.md — Camera / Photos / Files as a quick-actions BottomSheet, shared by the single- and multi-file attach controls. */
export const AttachSourceSheet = forwardRef<BottomSheetModal, { onPick: (source: AttachSource) => void }>(function AttachSourceSheet({ onPick }, ref) {
  return (
    <BottomSheet ref={ref} title="Attach a file">
      <View className="gap-1 pb-4">
        <SheetAction icon={Camera} label="Take a photo" onPress={() => onPick('camera')} />
        <SheetAction icon={ImageIcon} label="Choose from photos" onPress={() => onPick('photos')} />
        <SheetAction icon={FolderOpen} label="Choose a file" onPress={() => onPick('files')} />
      </View>
    </BottomSheet>
  );
});
