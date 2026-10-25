import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Maximize2 } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { isImageMime, isPdfMime } from '@/features/nigerianPayments/labels';
import { useCashSlipLink } from '../queries';

/** The deposit slip of a lodgment: an image shows inline and opens in the zoom viewer; a PDF opens in the phone's own viewer. */
export function SlipCard({ lodgmentId, hasSlip }: { lodgmentId: number; hasSlip: boolean }) {
  const { color } = useThemeTokens();
  const [viewerOpen, setViewerOpen] = useState(false);
  const link = useCashSlipLink(lodgmentId, hasSlip);

  if (!hasSlip) {
    return (
      <View className="rounded-lg border border-border bg-surface p-4 dark:border-transparent">
        <Text variant="body" tone="secondary">
          No deposit slip was attached.
        </Text>
      </View>
    );
  }

  if (link.isPending) return <Skeleton width="100%" height={220} radius="lg" />;
  if (link.isError || !link.data) return <ErrorState title="We couldn't load the deposit slip." onRetry={() => link.refetch()} error={link.error} />;

  const { url, filename, mimeType } = link.data;
  const open = () => void WebBrowser.openBrowserAsync(url).catch(() => toast.error('Could not open the slip. Try again.'));

  if (isPdfMime(mimeType) || !isImageMime(mimeType)) {
    return (
      <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="slip-file">
        <View className="flex-row items-center gap-3">
          <FileText size={28} color={color.primary} strokeWidth={1.5} />
          <View className="flex-1">
            <Text variant="body-strong" numberOfLines={1}>
              {filename}
            </Text>
            <Text variant="caption" tone="secondary">
              Deposit slip
            </Text>
          </View>
        </View>
        <Button variant="soft" onPress={open} testID="slip-open">
          Open slip
        </Button>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Deposit slip image. Open to zoom."
        className="overflow-hidden rounded-lg border border-border bg-surface-sunken dark:border-transparent"
        testID="slip-image"
      >
        <Image source={{ uri: url }} contentFit="contain" style={{ width: '100%', height: 260 }} accessibilityLabel="Deposit slip" />
        {/* Always-dark pill, so its content uses the always-light token (the `inverse` text is dark in dark mode). */}
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-overlay/80 px-3 py-1.5">
          <Maximize2 size={14} color={color.onPassbook} strokeWidth={2} />
          <Text variant="caption" tone="onPassbook">
            Zoom
          </Text>
        </View>
      </Pressable>
      <ImageViewerModal visible={viewerOpen} uri={url} title="Deposit slip" onClose={() => setViewerOpen(false)} />
    </>
  );
}
