'use client';

import { IconFileText, IconPhoto } from '@tabler/icons-react';
import { getAttachmentUrl, TicketAttachment } from '@/lib/api/support';
import { toast } from '@/lib/toast';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Files on a ticket or reply. Clicking one fetches a short-lived link and opens it in a new tab. */
export function TicketAttachments({ attachments }: { attachments?: TicketAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  async function open(attachment: TicketAttachment) {
    try {
      const { url } = await getAttachmentUrl(attachment.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message || 'Could not open the file');
    }
  }

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <button
            type="button"
            onClick={() => open(attachment)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:border-teal-500 hover:text-teal-600"
          >
            {attachment.mimeType.startsWith('image/') ? <IconPhoto size={14} /> : <IconFileText size={14} />}
            <span className="max-w-[180px] truncate">{attachment.originalName}</span>
            <span className="text-xs text-gray-400">{formatSize(attachment.fileSize)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
