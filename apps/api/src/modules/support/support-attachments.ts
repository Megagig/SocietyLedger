import path from 'path';
import { deleteFile, uploadFile } from '../../lib/storage';
import { supportService } from './support.service';

/**
 * Streams the uploaded files (already type- and size-checked by multer) to storage and records them against a ticket
 * (responseId null) or one of its replies. Returns what was saved, or an error message if storage failed — the
 * ticket or reply itself is never undone by it.
 *
 * `associationId` is the ticket's own association, so files land under the same folder whoever uploads them.
 */
export async function saveAttachments(
  associationId: number,
  ticketId: number,
  userId: number,
  responseId: number | null,
  files: Express.Multer.File[]
): Promise<{ attachments: Awaited<ReturnType<typeof supportService.addAttachments>>; attachmentError?: string }> {
  if (files.length === 0) return { attachments: [] };

  const uploaded: { key: string; originalName: string; mimeType: string; size: number }[] = [];
  try {
    for (const file of files) {
      const key = `support-tickets/${associationId}/${ticketId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || ''}`;
      await uploadFile(key, file.buffer, file.mimetype);
      uploaded.push({ key, originalName: file.originalname, mimeType: file.mimetype, size: file.size });
    }
    return { attachments: await supportService.addAttachments(ticketId, userId, responseId, uploaded) };
  } catch (error) {
    console.error('Support attachment upload failed:', error);
    await Promise.all(uploaded.map((u) => deleteFile(u.key)));
    return { attachments: [], attachmentError: 'Your files could not be uploaded. Try attaching them again.' };
  }
}
