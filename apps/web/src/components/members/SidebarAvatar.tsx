'use client';

import { useMyPhoto } from '@/hooks/useMyPhoto';
import { MemberAvatar } from './MemberAvatar';

/** The signed-in person's avatar in a sidebar: their photo when they have one, otherwise the first letter of their email as before. */
export function SidebarAvatar({ email }: { email: string }) {
  const { thumbUrl } = useMyPhoto();
  return <MemberAvatar name={email} initials={email.charAt(0).toUpperCase()} imageUrl={thumbUrl} size={40} />;
}
