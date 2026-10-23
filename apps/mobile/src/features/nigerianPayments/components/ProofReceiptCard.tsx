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
import type { ProofDetailDTO } from '@/types/api/paymentProofsManage';
import { isImageMime, isPdfMime, proofBacking } from '../labels';
import { useProofFileLink } from '../queries';

/**
 * PY3's receipt: an image shows inline and opens in the full-screen zoom viewer; a PDF opens in the in-app browser (the phone's own
 * viewer — no PDF library); a proof with no file shows the member's written declaration instead.
 */
export function ProofReceiptCard({ proof }: { proof: ProofDetailDTO }) {
  const { color } = useThemeTokens();
  const [viewerOpen, setViewerOpen] = useState(false);
  const backing = proofBacking(proof);
  const link = useProofFileLink(proof.id, backing === 'file');

  if (backing === 'declaration') {
    return (
      <View className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="proof-declaration">
        <Text variant="label" tone="secondary">
          No receipt — the member wrote this instead
        </Text>
        <Text variant="body">{proof.declarationNote}</Text>
      </View>
    );
  }

  if (backing === 'none') {
    return (
      <View className="rounded-lg border border-border bg-surface p-4 dark:border-transparent">
        <Text variant="body" tone="secondary">
          The member attached no receipt or note.
        </Text>
      </View>
    );
  }

  if (link.isPending) return <Skeleton width="100%" height={220} radius="lg" />;
  if (link.isError || !link.data) {
    return <ErrorState title="We couldn't load the receipt." onRetry={() => link.refetch()} error={link.error} />;
  }

  const { url, filename, mimeType } = link.data;

  if (isPdfMime(mimeType)) {
    return (
      <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="proof-pdf">
        <View className="flex-row items-center gap-3">
          <FileText size={28} color={color.primary} strokeWidth={1.5} />
          <View className="flex-1">
            <Text variant="body-strong" numberOfLines={1}>
              {filename ?? 'Receipt.pdf'}
            </Text>
            <Text variant="caption" tone="secondary">
              PDF receipt
            </Text>
          </View>
        </View>
        <Button
          variant="soft"
          onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => toast.error('Could not open the receipt. Try again.'))}
          testID="proof-open-pdf"
        >
          Open receipt
        </Button>
      </View>
    );
  }

  if (!isImageMime(mimeType)) {
    return (
      <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent">
        <Text variant="body-strong" numberOfLines={1}>
          {filename ?? 'Receipt'}
        </Text>
        <Button variant="soft" onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => toast.error('Could not open the receipt. Try again.'))}>
          Open receipt
        </Button>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Receipt image. Open to zoom."
        className="overflow-hidden rounded-lg border border-border bg-surface-sunken dark:border-transparent"
        testID="proof-image"
      >
        <Image source={{ uri: url }} contentFit="contain" style={{ width: '100%', height: 260 }} accessibilityLabel="Payment receipt" />
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-overlay/70 px-3 py-1.5">
          <Maximize2 size={14} color={color.textInverse} strokeWidth={2} />
          <Text variant="caption" tone="inverse">
            Zoom
          </Text>
        </View>
      </Pressable>
      <ImageViewerModal visible={viewerOpen} uri={url} title={filename ?? 'Receipt'} onClose={() => setViewerOpen(false)} />
    </>
  );
}
