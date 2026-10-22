'use client';

import { useRef, useState } from 'react';
import { IconFileText, IconPaperclip, IconPhoto, IconX } from '@tabler/icons-react';

export const MAX_TICKET_FILES = 3;
export const MAX_TICKET_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,image/jpeg,image/png,image/gif,image/webp,application/pdf';

/** The wording to show when a file can't be attached, or null when it can. Same rules the API enforces. */
export function validateTicketFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: attach a photo or a PDF.`;
  if (file.size > MAX_TICKET_FILE_BYTES) return `${file.name} is larger than 5MB.`;
  return null;
}

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}

/** Up to 3 photos or PDFs (5MB each) on a ticket or reply. Each file is checked as it is chosen. */
export function AttachmentPicker({ files, onChange, disabled = false, label = 'Attachments (optional)' }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ''; // so choosing the same file again still fires

    const next = [...files];
    let problem: string | null = null;
    for (const file of picked) {
      if (next.length >= MAX_TICKET_FILES) {
        problem = `You can attach up to ${MAX_TICKET_FILES} files.`;
        break;
      }
      const invalid = validateTicketFile(file);
      if (invalid) {
        problem = invalid;
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) {
        problem = `${file.name} is already attached.`;
        continue;
      }
      next.push(file);
    }
    setError(problem);
    onChange(next);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>

      {files.length > 0 && (
        <ul className="space-y-2 mb-3">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <span className="flex items-center gap-2 min-w-0">
                {file.type.startsWith('image/') ? <IconPhoto size={16} className="text-gray-500" /> : <IconFileText size={16} className="text-gray-500" />}
                <span className="truncate text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="p-1 text-gray-400 hover:text-red-600"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
              >
                <IconX size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length < MAX_TICKET_FILES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:border-teal-500 hover:text-teal-600 disabled:opacity-60"
        >
          <IconPaperclip size={16} />
          {files.length === 0 ? 'Attach files' : 'Attach another file'}
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={handlePick} />

      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">Up to {MAX_TICKET_FILES} files — photos or PDFs, 5MB each.</p>
      )}
    </div>
  );
}
