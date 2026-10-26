'use client';

import { useState } from 'react';

interface MemberAvatarProps {
  /** Full name, used for the initials shown when there is no photo. */
  name: string;
  /** The member's photo (`thumbUrl` for lists and the sidebar, `photoUrl` for profile pages). Missing or broken shows initials. */
  imageUrl?: string | null;
  /** What to show when there is no photo. Defaults to the first and last name's initials. */
  initials?: string;
  /** Width and height in pixels. */
  size?: number;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** One round avatar for every place a member appears: their photo when they have one, the gradient initials circle when they do not. */
export function MemberAvatar({ name, imageUrl, initials, size = 40, className = '' }: MemberAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!imageUrl && imageUrl !== failedUrl;

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-teal-500 to-green-500 text-white font-bold select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
      aria-label={name}
    >
      {showImage ? (
        // A plain <img>: the link is a short-lived signed storage address, so Next's image optimiser cannot cache or re-fetch it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} width={size} height={size} className="w-full h-full object-cover" loading="lazy" onError={() => setFailedUrl(imageUrl ?? null)} />
      ) : (
        <span aria-hidden="true">{initials ?? initialsOf(name)}</span>
      )}
    </div>
  );
}
