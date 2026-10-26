'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';

export const MY_PHOTO_CHANGED = 'member-photo-changed';

type MyPhoto = { photoUrl: string | null; thumbUrl: string | null };

let cache: { at: number; data: MyPhoto } | null = null;
let inflight: Promise<MyPhoto> | null = null;
/** Photo links are signed and expire after hours, so the sidebar re-reads them now and then instead of trusting what was saved at sign-in. */
const FRESH_MS = 5 * 60 * 1000;

async function load(): Promise<MyPhoto> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.data;
  if (!inflight) {
    inflight = api
      .get('/members/me')
      .then((response) => {
        const member = response.data?.data;
        const data = { photoUrl: member?.photoUrl ?? null, thumbUrl: member?.thumbUrl ?? null };
        cache = { at: Date.now(), data };
        return data;
      })
      .catch(() => ({ photoUrl: null, thumbUrl: null })) // no member profile (platform staff) or offline: initials
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Tells every avatar on the page that the signed-in member's photo changed. */
export function announceMyPhotoChanged() {
  cache = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MY_PHOTO_CHANGED));
}

/** The signed-in member's own photo, kept current across the page (used by the sidebars). */
export function useMyPhoto(enabled = true): MyPhoto {
  const [photo, setPhoto] = useState<MyPhoto>({ photoUrl: null, thumbUrl: null });
  const refresh = useCallback(() => {
    if (enabled) void load().then(setPhoto);
  }, [enabled]);

  useEffect(() => {
    refresh();
    window.addEventListener(MY_PHOTO_CHANGED, refresh);
    return () => window.removeEventListener(MY_PHOTO_CHANGED, refresh);
  }, [refresh]);

  return photo;
}
