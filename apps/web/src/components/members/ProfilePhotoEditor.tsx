'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Group, Loader, Modal } from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';
import { announceMyPhotoChanged } from '@/hooks/useMyPhoto';
import { MemberAvatar } from './MemberAvatar';

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** The reason a picked file cannot be used as a profile photo, or null when it can. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'Choose a JPEG, PNG or WebP photo.';
  if (file.size > PHOTO_MAX_BYTES) return 'The photo is larger than 5MB.';
  return null;
}

interface ProfilePhotoEditorProps {
  name: string;
  imageUrl?: string | null;
  /** 'me' changes the signed-in member's own photo; a number is an officer changing that member's photo. */
  target: 'me' | number;
  size?: number;
  /** Called after a photo is saved or removed, with the new link (null after a removal), so the page can refresh what it shows. */
  onChanged?: (photoUrl: string | null, thumbUrl: string | null) => void;
}

const base = (target: 'me' | number) => (target === 'me' ? '/members/me/photo' : `/members/${target}/photo`);

/** Shows the member's photo with Change and Remove actions. Picking a file opens a preview, and nothing is saved until the person confirms. */
export function ProfilePhotoEditor({ name, imageUrl, target, size = 96, onChanged }: ProfilePhotoEditorProps) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still fires
    if (!picked) return;
    const problem = photoProblem(picked);
    if (problem) {
      toast.error(problem);
      return;
    }
    setFile(picked);
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const response = await api.put(base(target), form);
      const data = response.data?.data;
      if (target === 'me') announceMyPhotoChanged();
      onChanged?.(data?.photoUrl ?? null, data?.thumbUrl ?? null);
      toast.success('Photo updated');
      setFile(null);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not update the photo. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(base(target));
      if (target === 'me') announceMyPhotoChanged();
      onChanged?.(null, null);
      toast.success('Photo removed');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not remove the photo. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-label="Change profile photo"
      >
        <MemberAvatar name={name} imageUrl={imageUrl} size={size} />
        <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center border-2 border-white dark:border-gray-800">
          {busy ? <Loader size={14} color="white" /> : <IconCamera size={16} />}
        </span>
      </button>
      <input ref={input} type="file" accept={PHOTO_TYPES.join(',')} className="hidden" onChange={onPick} data-testid="photo-input" />
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50">
          {imageUrl ? 'Change photo' : 'Add photo'}
        </button>
        {imageUrl && (
          <button type="button" onClick={remove} disabled={busy} className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
            Remove
          </button>
        )}
      </div>

      <Modal opened={!!file} onClose={() => !busy && setFile(null)} title="Use this photo?" centered size="sm">
        <div className="flex flex-col items-center gap-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview of the new profile photo" className="w-48 h-48 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">The photo is cropped to a centred square and shown as a circle.</p>
          <Group justify="center">
            <Button variant="default" onClick={() => setFile(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Save photo
            </Button>
          </Group>
        </div>
      </Modal>
    </div>
  );
}
