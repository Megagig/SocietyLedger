'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Modal, Textarea } from '@mantine/core';
import { ajoApi, ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay } from '@/lib/ajo/format';
import { useRuleVersions } from '@/lib/ajo/staffHooks';
import type { RosterPersonDTO } from '@/lib/ajo/staffTypes';
import { toast } from '@/lib/toast';

/**
 * An officer records that a person accepted the circle's rules in person: someone who is not using the app, or who agreed at a meeting. It
 * records the version in force now, who recorded it and the note about how it was given, and the roster then shows it as accepted by an
 * officer. The officer must say they read the rules to the person and the person agreed; the note is required.
 */
export function RecordRulesAcceptanceDialog({ person, groupId, onClose }: { person: RosterPersonDTO | null; groupId: number; onClose: () => void }) {
  const client = useQueryClient();
  const versions = useRuleVersions(groupId);
  const [note, setNote] = useState('');
  const [read, setRead] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (person) {
      setNote('');
      setRead(false);
      setProblem(null);
      setBusy(false);
    }
  }, [person]);

  // The version in force now is the one a person joins under; a later one that has not started yet is accepted when it does.
  const inForce = [...(versions.data?.versions ?? [])].filter((v) => new Date(v.effectiveFrom).getTime() <= Date.now()).sort((a, b) => b.version - a.version)[0];

  const submit = async () => {
    if (!person || !inForce) return;
    if (!read) return setProblem('Tick the box to say you read the rules to them and they agreed.');
    if (note.trim().length < 5) return setProblem('Say how it was given, for example “read aloud at the 14 Nov meeting”.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoApi.acceptRules(person.membershipId, { ruleVersionId: inForce.id, note: note.trim() });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(`${person.name}'s acceptance was recorded.`);
      onClose();
    } catch (error) {
      setProblem(ajoErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <Modal opened={person !== null} onClose={onClose} title="Record rules acceptance" centered size="lg">
      {person && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Use this when <strong>{person.name}</strong> accepted the circle&apos;s rules in person, for example at a meeting, and is not accepting them in the app. It is recorded as accepted by an officer, with your name and the note below.
          </p>
          {!inForce ? (
            <p className="text-sm text-ink-muted">Loading the rules…</p>
          ) : (
            <div className="rounded-md bg-surface-muted p-3 text-sm">
              <p className="font-medium text-ink">
                Version {inForce.version}, in force from {formatDay(inForce.effectiveFrom)}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
                {inForce.summary.map((line: string) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <Checkbox label={`I read these rules to ${person.name} and they agreed to them.`} checked={read} onChange={(e) => setRead(e.currentTarget.checked)} />
          <Textarea label="How it was given" description="For example “read aloud at the 14 Nov meeting”. It stays on the record." autosize minRows={2} maxLength={300} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          {problem && (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button color="green" onClick={submit} loading={busy} disabled={!inForce}>
              Record acceptance
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
