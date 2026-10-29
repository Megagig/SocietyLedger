'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Checkbox, Textarea } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay } from '@/lib/ajo/format';
import { useAcceptRules, useRulesToAccept } from '@/lib/ajo/hooks';
import { toast } from '@/lib/toast';

/** THM4: read the circle's current rules in plain words and accept them. A rule change only binds you once you accept it. */
export default function RulesPage() {
  const params = useParams<{ membershipId: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const { canWrite } = useAjoAccess();
  const rules = useRulesToAccept(membershipId);
  const accept = useAcceptRules(membershipId);
  const [read, setRead] = useState(false);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const back = `/dashboard/my-thrift/${membershipId}`;

  if (rules.isLoading) return <AjoLoading rows={2} />;
  if (rules.isError) return <AjoError error={rules.error} onRetry={() => rules.refetch()} />;
  if (!rules.data) return <AjoEmpty title="This circle has no rules to accept yet." action={<Link href={back} className="text-success-link underline">Back</Link>} />;
  const current = rules.data;

  const submit = async () => {
    if (!read) return setProblem('Tick the box to say you have read the rules.');
    setProblem(null);
    try {
      await accept.mutateAsync({ ruleVersionId: current.ruleVersionId, note: note.trim() || undefined });
      setAccepted(true);
      toast.success('Rules accepted.');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'Could not record your acceptance.'));
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline">
          <IconArrowLeft size={14} /> Back to my circle
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-ink">Circle rules</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Version {current.version}, in force from {formatDay(current.effectiveFrom)}.
        </p>
      </div>

      <ul className="space-y-2 rounded-lg border border-line p-4">
        {current.summary.map((line) => (
          <li key={line} className="text-ink-soft">{line}</li>
        ))}
      </ul>

      {accepted ? (
        <p role="status" className="rounded-lg border border-success-line bg-success-soft p-4 text-success-strong">
          You accepted version {current.version}. It is on your record.
        </p>
      ) : canWrite ? (
        <div className="space-y-4">
          <Checkbox label="I have read these rules and I agree to them." checked={read} onChange={(e) => setRead(e.currentTarget.checked)} />
          <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={300} autosize minRows={2} />
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <Button color="green" onClick={submit} loading={accept.isLoading}>
            Accept the rules
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Accepting is switched off while the add-on is expired.</p>
      )}
    </div>
  );
}
