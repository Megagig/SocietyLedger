'use client';

import { VersionedEditor } from '@/components/billing/VersionedEditor';

export default function AddonEditorPage({ params }: { params: { id: string } }) {
  return <VersionedEditor kind="addon" id={Number(params.id)} />;
}
