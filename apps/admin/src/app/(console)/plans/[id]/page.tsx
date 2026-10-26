'use client';

import { VersionedEditor } from '@/components/billing/VersionedEditor';

export default function PlanEditorPage({ params }: { params: { id: string } }) {
  return <VersionedEditor kind="plan" id={Number(params.id)} />;
}
