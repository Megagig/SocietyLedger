import { UserX } from 'lucide-react-native';

import { EmptyState } from './EmptyState';

export type NoMemberProfileProps = {
  /** What the screen shows, e.g. "welfare records" — completes "This screen shows your …". */
  subject: string;
};

/** Shown on member-only screens when the signed-in account has no member profile linked. */
export function NoMemberProfile({ subject }: NoMemberProfileProps) {
  return (
    <EmptyState
      icon={UserX}
      title="No member profile on this account"
      description={`This screen shows your own ${subject}, which need a member profile. Sign in with a member account, or ask an admin to add you as a member.`}
    />
  );
}
