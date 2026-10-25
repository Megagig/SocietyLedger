import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { Image, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { pickFromPhotos, validateAttachment } from '@/components/forms/attachmentPickers';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { resolveAssetUrl } from '@/lib/assets';
import { useDeleteLogo, useUploadLogo } from '../mutations';

/** What the server accepts for a logo: a real JPEG, PNG or WebP up to 2MB. */
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** The association's logo with Change and Remove. Each is saved straight away; the rest of the profile saves with its own button. */
export function LogoEditor({ name, logo, tintColor }: { name: string; logo: string | null | undefined; tintColor?: string | null }) {
  const upload = useUploadLogo();
  const remove = useDeleteLogo();
  const removeRef = useRef<BottomSheetModal>(null);
  const url = resolveAssetUrl(logo);

  const choose = async () => {
    const picked = await pickFromPhotos();
    if (!picked) return;
    if ('error' in picked) {
      toast.error(picked.error);
      return;
    }
    const problem = validateAttachment(picked.attachment, LOGO_TYPES, LOGO_MAX_BYTES);
    if (problem) {
      toast.error(problem.includes('larger') ? 'That picture is larger than 2MB. Choose a smaller one.' : 'Use a JPEG, PNG or WebP picture.');
      return;
    }
    upload.mutate(
      { uri: picked.attachment.uri, name: picked.attachment.name, type: picked.attachment.type },
      {
        onSuccess: () => toast.success('Logo updated'),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not upload the logo. Try again.'),
      },
    );
  };

  return (
    <View className="flex-row items-center gap-4">
      {url ? (
        <Image source={{ uri: url }} accessibilityLabel={`${name} logo`} resizeMode="contain" className="h-16 w-16 rounded-md bg-surface-sunken" testID="logo-image" />
      ) : (
        <Avatar name={name} size={64} shape="square" tintColor={tintColor ?? undefined} />
      )}
      <View className="flex-1 gap-2">
        <Text variant="caption" tone="secondary">
          A square picture works best. JPEG, PNG or WebP, up to 2MB.
        </Text>
        <View className="flex-row gap-2">
          <Button variant="secondary" size="sm" loading={upload.isPending} onPress={() => void choose()} testID="logo-change">
            {url ? 'Change logo' : 'Add a logo'}
          </Button>
          {url ? (
            <Button variant="danger-ghost" size="sm" loading={remove.isPending} onPress={() => removeRef.current?.present()} testID="logo-remove">
              Remove
            </Button>
          ) : null}
        </View>
      </View>

      <ConfirmSheet
        ref={removeRef}
        title="Remove the logo?"
        description="Members will see your association's initials instead."
        confirmLabel="Remove logo"
        onConfirm={() => {
          removeRef.current?.dismiss();
          remove.mutate(undefined, {
            onSuccess: () => toast.success('Logo removed'),
            onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not remove the logo. Try again.'),
          });
        }}
      />
    </View>
  );
}
