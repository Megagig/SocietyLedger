import { Linking, Pressable, View } from 'react-native';
import { FileText, Image as ImageIcon } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { supportApi } from '@/api/endpoints/support';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { TicketAttachmentDTO } from '@/types/api/support';
import { formatFileSize } from '../labels';

/** Files on a ticket or reply. Tapping one fetches a short-lived link and opens it. */
export function TicketAttachmentChips({ attachments }: { attachments?: TicketAttachmentDTO[] }) {
  const { color } = useThemeTokens();
  if (!attachments || attachments.length === 0) return null;

  const open = async (attachment: TicketAttachmentDTO) => {
    try {
      const { url } = await supportApi.getAttachmentUrl(attachment.id);
      await Linking.openURL(url);
    } catch {
      toast.error('Could not open the file. Try again.');
    }
  };

  return (
    <View className="mt-2 gap-1.5">
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => void open(attachment)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${attachment.originalName}`}
          className="flex-row items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
          testID={`attachment-${attachment.id}`}
        >
          {attachment.mimeType.startsWith('image/') ? (
            <ImageIcon size={16} color={color.primary} strokeWidth={1.75} />
          ) : (
            <FileText size={16} color={color.primary} strokeWidth={1.75} />
          )}
          <Text variant="caption" numberOfLines={1} className="flex-1">
            {attachment.originalName}
          </Text>
          <Text variant="caption" tone="secondary">
            {formatFileSize(attachment.fileSize)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
