'use client';

import { Button } from '@mantine/core';
import { IconReceipt } from '@tabler/icons-react';
import { useState } from 'react';
import { coopErrorMessage } from '@/lib/coop/api';
import { toast } from '@/lib/toast';

/**
 * Opens a proof of payment in a new tab. The short-lived link is asked for only when the button is pressed, so a proof's address is never
 * kept on the page or in a cache. Whoever may see it is decided by the server.
 */
export function ReceiptButton({ getUrl, label = 'View proof' }: { getUrl: () => Promise<{ url: string }>; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="subtle"
      size="xs"
      loading={busy}
      leftSection={<IconReceipt size={14} />}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await getUrl();
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
          toast.error(coopErrorMessage(error, 'We could not open the proof.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
