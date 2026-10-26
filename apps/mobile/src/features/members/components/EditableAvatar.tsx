import { ActivityIndicator, Pressable, View } from 'react-native';
import { Camera } from 'lucide-react-native';

import { Avatar, type AvatarSize } from '@/components/ui/Avatar';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { t } from '@/lib/i18n';
import { useProfilePhoto, type PhotoTarget } from '../useProfilePhoto';

type EditableAvatarProps = {
  name: string;
  colorSeed?: number | string;
  imageUrl?: string | null;
  size?: AvatarSize;
  target: PhotoTarget;
  testID?: string;
};

/** A member's avatar that opens the take / choose / remove sheet when tapped, with a small camera badge so it reads as tappable. */
export function EditableAvatar({ name, colorSeed, imageUrl, size = 64, target, testID }: EditableAvatarProps) {
  const { color } = useThemeTokens();
  const { choose, busy } = useProfilePhoto(target, !!imageUrl);

  return (
    <Pressable onPress={choose} accessibilityRole="button" accessibilityLabel={t('profile.photo.change')} testID={testID} disabled={busy}>
      <Avatar name={name} size={size} colorSeed={colorSeed} imageUrl={imageUrl} />
      <View
        className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-bg"
        style={{ backgroundColor: color.primary }}
      >
        {busy ? <ActivityIndicator size="small" color={color.textInverse} /> : <Camera size={14} color={color.textInverse} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}
