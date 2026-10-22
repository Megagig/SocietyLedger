/** Maps a stored notification's deep-link type (the push `data.type` vocabulary) to the web page it is about. */
export function notificationHref(pushType?: string | null, entityId?: number | null): string | null {
  switch (pushType) {
    case 'support.ticket_created':
    case 'support.ticket_member_reply':
    case 'support.ticket_reply':
      return entityId ? `/dashboard/help/tickets/${entityId}` : '/dashboard/help/tickets';
    case 'guarantor.requested':
      return '/dashboard/cooperatives/guarantors';
    case 'loan.application_updated':
      return entityId ? `/dashboard/cooperatives/applications/${entityId}` : '/dashboard/cooperatives/applications';
    case 'meeting.scheduled':
    case 'meeting.reminder':
    case 'meeting.cancelled':
      return '/dashboard/governance/meetings';
    case 'announcement':
      return '/dashboard/communications';
    default:
      return null;
  }
}
