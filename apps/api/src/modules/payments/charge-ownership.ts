/**
 * Whether the signed-in user is the member a charge belongs to. Members are linked to their login by user id, and — for a member
 * whose login was never linked — by the same email address (the app links those on first use).
 */
export function userOwnsCharge(user: { id: number; email?: string | null } | undefined, member: { userId: number | null; email: string | null }): boolean {
  if (!user) return false;
  if (member.userId !== null) return member.userId === user.id;
  return !!user.email && !!member.email && user.email.trim().toLowerCase() === member.email.trim().toLowerCase();
}
