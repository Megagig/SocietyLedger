'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty } from '@/components/ajo/AjoStates';
import { GroupWizard } from '@/components/ajo/GroupWizard';
import { useAjoCan } from '@/lib/ajo/useAjoCan';

/** THO2: create a group. The wizard itself is shared with thrift onboarding. */
export default function NewGroupPage() {
  const router = useRouter();
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();

  if (!manage || !canWrite) return <AjoEmpty title="You cannot create circles." hint={!canWrite ? 'The Ajo add-on has expired, so nothing can be added until it is renewed.' : 'Ask an admin to give you permission to manage Ajo.'} action={<Link href="/dashboard/ajo" className="text-success-link underline">Back to circles</Link>} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/ajo" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline"><IconArrowLeft size={14} /> Circles</Link>
        <h1 className="mt-2 text-3xl font-bold text-ink">New circle</h1>
      </div>
      <GroupWizard onCreated={(group) => router.push(`/dashboard/ajo/${group.id}`)} />
    </div>
  );
}
