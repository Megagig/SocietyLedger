'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useAjoNav } from '@/lib/ajo/useAjoNav';
import { useAuthStore } from '@/store/authStore';

const KEY = 'ajo-onboarding-resume-dismissed';
const read = () => { try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

/**
 * For the admin of a standalone thrift group who has not finished setting up: where they got to, and a way back in. It can be put away
 * for this visit only. Everyone else (associations, officers, members) never sees it.
 */
export function OnboardingResume() {
  const nav = useAjoNav();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin' && !s.user?.platformRole);
  const [hidden, setHidden] = useState(read);
  const status = useQuery({ queryKey: ['ajo', 'onboarding'], queryFn: ajoStaffApi.onboardingStatus, enabled: nav.thriftOnly && isAdmin, retry: false });
  const data = status.data;
  if (!nav.thriftOnly || !isAdmin || hidden || !data || data.flow !== 'THRIFT') return null;
  // "Skip for now" also marks setup as ended, so skipping is told apart from finishing: only a finished setup (completedAt) stops the reminder.
  const unfinished = !data.onboarding.onboardingComplete || (!!data.onboarding.skippedAt && !data.onboarding.completedAt);
  if (!unfinished) return null;
  const done = data.onboarding.completedSteps.length;

  return (
    <section aria-label="Finish setting up" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-line bg-success-soft p-4">
      <p className="text-sm font-medium text-success-strong">Finish setting up {data.association?.name ?? 'your group'} · {done} of {data.steps.length} done</p>
      <div className="flex items-center gap-2">
        <Button component={Link} href="/onboarding/thrift?resume=true" size="xs" color="green">Continue</Button>
        <Button size="xs" variant="subtle" color="gray" onClick={() => { try { window.sessionStorage.setItem(KEY, '1'); } catch { /* it just comes back next time */ } setHidden(true); }}>Not now</Button>
      </div>
    </section>
  );
}
