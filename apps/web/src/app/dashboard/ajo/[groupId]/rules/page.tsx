'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { DEFAULT_RULES, RulesFields, rulesFormToInput, type RulesFormValues } from '@/components/ajo/RulesFields';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useAjoAction, useRuleVersions } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';


/** Rules are never edited: a change is a new version that takes effect after a notice period, and a member is bound only once they accept it. */
export default function GroupRulesPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();
  const versions = useRuleVersions(groupId);
  const publish = useAjoAction((rules: Parameters<typeof ajoStaffApi.publishRules>[1]) => ajoStaffApi.publishRules(groupId, rules));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RulesFormValues>(DEFAULT_RULES);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const built = rulesFormToInput(form);
    if ('error' in built) return setProblem(built.error);
    setProblem(null);
    try {
      await publish.mutateAsync(built.input);
      toast.success('A new version of the rules was published. Members accept it before it binds them.');
      setEditing(false);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  if (versions.isLoading) return <AjoLoading />;
  if (versions.isError) return <AjoError error={versions.error} onRetry={() => versions.refetch()} />;
  const list = [...(versions.data ?? [])].sort((x, y) => y.version - x.version);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">Changing the rules makes a new version. It takes effect after a notice period, and each member is only bound by the version they accepted.</p>
        {manage && canWrite && !editing && <Button onClick={() => { const v = list[0]; if (v) setForm({ lateFeeType: v.rules.lateFeeType, lateFeeValue: v.rules.lateFeeType === 'FIXED' ? (Number(v.rules.lateFeeValue) / 100).toFixed(2) : v.rules.lateFeeType === 'PERCENT' ? String(Number(v.rules.lateFeeValue) / 100) : '', lateFeeCap: v.rules.lateFeeCapKobo ? (Number(v.rules.lateFeeCapKobo) / 100).toFixed(2) : '', graceDays: v.rules.graceDays, guarantorPolicy: v.rules.guarantorPolicy, defaultProcedure: v.rules.defaultProcedure, remindersEnabled: v.rules.remindersEnabled, blockAtRiskEarly: v.rules.blockAtRiskEarly }); setEditing(true); }}>Publish a new version</Button>}
      </div>

      {editing && (
        <section className="space-y-4 rounded-lg border border-line p-5">
          <RulesFields value={form} onChange={setForm} />
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex gap-2"><Button color="green" onClick={submit} loading={publish.isLoading}>Publish</Button><Button variant="default" onClick={() => setEditing(false)}>Cancel</Button></div>
        </section>
      )}

      {list.length === 0 ? (
        <AjoEmpty title="No rules have been set yet." />
      ) : (
        <ul className="space-y-3">
          {list.map((v) => (
            <li key={v.id} className="rounded-lg border border-line p-4">
              <p className="font-semibold">Version {v.version} <span className="text-sm font-normal text-ink-faint">· from {formatDay(v.effectiveFrom)}</span></p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{v.summary.map((line) => <li key={line}>{line}</li>)}</ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
