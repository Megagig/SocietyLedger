import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';

/**
 * Opens a proof of payment: an image in the zoom viewer, a PDF in the in-app browser. The short-lived link is asked for only when the
 * button is pressed, so a proof's address is never kept on the screen or in a cache.
 */
export function ProofButton({
  load,
  label = 'View proof',
  testID,
}: {
  load: () => Promise<{ url: string; filename?: string; mimeType?: string }>;
  label?: string;
  testID?: string;
}) {
  const [viewer, setViewer] = useState<{ uri: string; title?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const link = await load();
      if (link.mimeType?.startsWith('image/')) setViewer({ uri: link.url, title: link.filename });
      else await WebBrowser.openBrowserAsync(link.url);
    } catch {
      toast.error('Could not open the proof. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" loading={busy} onPress={() => void open()} testID={testID}>
        {label}
      </Button>
      <ImageViewerModal visible={viewer !== null} uri={viewer?.uri ?? null} title={viewer?.title} onClose={() => setViewer(null)} />
    </>
  );
}
