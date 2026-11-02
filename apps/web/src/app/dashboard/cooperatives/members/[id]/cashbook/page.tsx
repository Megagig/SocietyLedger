'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { CashbookScreen } from '@/components/coop/CashbookScreen';

/** An officer opening one member's cashbook (the same statement the member sees on their own page). Needs the savings-manage permission on the server. */
export default function MemberCashbookPage() {
  const params = useParams<{ id: string }>();
  const memberId = Number(params.id);

  return (
    <div className="space-y-4">
      <Button component={Link} href={`/dashboard/cooperatives/members/${params.id}`} variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />}>
        Back to the member
      </Button>
      <CashbookScreen
        title="Member cashbook"
        subtitle="The member's shares, savings, loans and loan interest for the selected period."
        filename={`member-${params.id}-cashbook`}
        memberId={memberId}
      />
    </div>
  );
}
