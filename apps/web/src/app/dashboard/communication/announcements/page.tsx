'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconSend, IconMail, IconMessage, IconUsers } from '@tabler/icons-react';
import {
  notificationsApi,
  AnnouncementInput,
  AnnouncementResult,
} from '@/lib/api/notifications';
import { membersApi, Member } from '@/lib/api/members';
import { MEMBER_CATEGORIES } from '@/utils/constants';

type Audience = 'ALL' | 'CATEGORY' | 'SELECTED';

const AUDIENCES: Array<{ value: Audience; label: string; hint: string }> = [
  { value: 'ALL', label: 'All active members', hint: 'Everyone currently active' },
  { value: 'CATEGORY', label: 'By category', hint: 'Pick one or more kinds of member' },
  { value: 'SELECTED', label: 'Chosen members', hint: 'Hand-pick who gets it' },
];

const PRIORITIES = [
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: 'ℹ️' },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '⚠️' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '🚨' },
] as const;

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent';

const money = (n: number) => `${n.toLocaleString('en-NG')} credit${n === 1 ? '' : 's'}`;

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'info' | 'warning' | 'urgent'>('info');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [categories, setCategories] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnnouncementResult | null>(null);

  const { data: membersData } = useQuery({
    queryKey: ['members-list'],
    queryFn: () => membersApi.getMembers({ limit: 1000 }),
    enabled: audience === 'SELECTED',
  });
  const shown = useMemo(() => {
    const members: Member[] = membersData?.members ?? [];
    const q = search.trim().toLowerCase();
    return q ? members.filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) : members;
  }, [membersData, search]);

  const input: AnnouncementInput = {
    title: title.trim(),
    message: message.trim(),
    priority,
    audience,
    ...(audience === 'CATEGORY' ? { categories } : {}),
    ...(audience === 'SELECTED' ? { memberIds } : {}),
    sendEmail,
    sendSms,
    ...(sendSms && smsText.trim() ? { smsText: smsText.trim() } : {}),
  };
  const audienceNamed = audience === 'ALL' || (audience === 'CATEGORY' ? categories.length > 0 : memberIds.length > 0);
  const ready = !!input.title && !!input.message && audienceNamed;

  // Who it reaches and what the texts cost, shown before anything is sent (re-checked as the form changes)
  const [debounced, setDebounced] = useState(JSON.stringify(input));
  const current = JSON.stringify(input);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(current), 400);
    return () => clearTimeout(t);
  }, [current]);

  const preview = useQuery({
    queryKey: ['announcement-preview', debounced],
    queryFn: () => notificationsApi.previewAnnouncement(JSON.parse(debounced)),
    enabled: ready,
    keepPreviousData: true,
    retry: false,
  });
  const reach = preview.data?.data.reach;
  const sms = preview.data?.data.sms ?? null;
  const previewError = preview.isError ? errorMessage(preview.error, 'Could not work out who this reaches') : '';

  const history = useQuery({
    queryKey: ['announcements-history'],
    queryFn: () => notificationsApi.listAnnouncements({ limit: 20 }),
    refetchInterval: (data) =>
      data?.data.announcements.some((a) => a.status === 'SENDING') ? 4000 : false,
  });

  const send = useMutation({
    mutationFn: () => notificationsApi.createAnnouncement(input),
    onSuccess: (response) => {
      setResult(response.data);
      setError('');
      setTitle('');
      setMessage('');
      setSmsText('');
      setMemberIds([]);
      setCategories([]);
      queryClient.invalidateQueries({ queryKey: ['announcements-history'] });
    },
    onError: (err) => {
      setResult(null);
      setError(errorMessage(err, 'Failed to send announcement'));
    },
  });

  const toggle = <T,>(list: T[], value: T, set: (next: T[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const cannotAfford = sendSms && sms !== null && !sms.enough;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Send Announcement
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Send an important message to all members, a category, or hand-picked members. It is kept in the history below.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
          className="space-y-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Announcement Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="Enter announcement title"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={2000}
                rows={6}
                placeholder="Write your announcement message..."
                className={`${inputClass} resize-none`}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{message.length}/2000 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority Level</label>
              <div className="grid grid-cols-3 gap-3">
                {PRIORITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPriority(option.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      priority === option.value
                        ? `${option.color} border-current`
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <p className="text-sm font-medium mt-1">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Who should get it?</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAudience(a.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      audience === a.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.hint}</p>
                  </button>
                ))}
              </div>

              {audience === 'CATEGORY' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.values(MEMBER_CATEGORIES).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(categories, c, setCategories)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        categories.includes(c)
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {audience === 'SELECTED' && (
                <div className="mt-3">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members"
                    className={inputClass}
                  />
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
                    {shown.map((m) => (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memberIds.includes(m.id)}
                          onChange={() => toggle(memberIds, m.id, setMemberIds)}
                          className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {m.firstName} {m.lastName}
                        </span>
                      </label>
                    ))}
                    {shown.length === 0 && <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">No members found.</p>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{memberIds.length} selected</p>
                </div>
              )}
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How should it reach them?</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                The app feed and a push notification always go to members who have logged in. Members without a login are reached by email or text only.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                  />
                  <IconMail size={20} className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">Also send by email</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                  />
                  <IconMessage size={20} className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">Also send as a text message (uses SMS credits)</span>
                </label>
              </div>

              {sendSms && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Text wording (optional, leave empty to use the title and message)
                  </label>
                  <textarea
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={preview.data?.data.smsText ?? 'Shorter wording for the text message'}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {result && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm space-y-1">
                <p className="font-medium">Announcement sent to {result.count.toLocaleString()} members.</p>
                <p>{result.inApp.toLocaleString()} in the app{result.noLogin ? `, ${result.noLogin.toLocaleString()} have no login` : ''}.</p>
                {result.emailsSent > 0 && <p>{result.emailsSent.toLocaleString()} emails sent to members without a login.</p>}
                {(result.smsSent > 0 || result.smsFailed > 0 || result.smsInProgress) && (
                  <p>
                    {result.smsInProgress
                      ? 'Texts are still going out. Follow them in the history below.'
                      : `${result.smsSent.toLocaleString()} texts sent${result.smsFailed ? `, ${result.smsFailed.toLocaleString()} did not go out (refunded)` : ''}.`}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={send.isPending || !ready || cannotAfford}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {send.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <IconSend size={20} />
                  {reach ? `Send to ${reach.members.toLocaleString()} members` : 'Send Announcement'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Reach and cost, before sending */}
        <aside className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              <IconUsers size={18} /> Who this reaches
            </h3>
            {!ready && <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the title, message and who should get it to see the reach.</p>}
            {previewError && <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>}
            {ready && reach && (
              <dl className="space-y-2 text-sm">
                <Row label="Members" value={reach.members} />
                <Row label="In the app (have a login)" value={reach.withLogin} />
                <Row label="No login" value={reach.noLogin} hint={sendEmail || sendSms ? undefined : 'Not reached unless email or text is ticked'} />
                {sendEmail && <Row label="Have an email" value={reach.withEmail} />}
                {sendSms && (
                  <>
                    <Row label="Will get a text" value={reach.willText} />
                    <Row label="No usable phone number" value={reach.noPhone} />
                    <Row label="Opted out of texts" value={reach.optedOut} />
                  </>
                )}
              </dl>
            )}
            {sendSms && sms && (
              <div
                className={`mt-4 rounded-lg p-3 text-sm ${
                  sms.enough ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}
              >
                <p>
                  {sms.segments} part{sms.segments === 1 ? '' : 's'} per text, so this costs <strong>{money(sms.credits)}</strong>. You have {money(sms.balance)}.
                </p>
                {!sms.enough && (
                  <p className="mt-1">
                    You are short by {money(sms.shortBy)}.{' '}
                    <Link href="/dashboard/communications/credits" className="underline">
                      Buy credits
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Preview</h3>
            <div
              className={`p-4 rounded-xl ${
                priority === 'urgent'
                  ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                  : priority === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
              }`}
            >
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{title || 'Announcement Title'}</h4>
              <p className="text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                {message || 'Your announcement message will appear here...'}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Sent announcements */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Sent announcements</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl divide-y divide-gray-100 dark:divide-gray-700">
          {history.isLoading && <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
          {history.data?.data.announcements.length === 0 && (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Nothing has been sent yet.</p>
          )}
          {history.data?.data.announcements.map((a) => (
            <div key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{a.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {a.sentBy} · {new Date(a.createdAt).toLocaleString()} ·{' '}
                    {a.audience === 'ALL' ? 'All active members' : a.audience === 'CATEGORY' ? 'By category' : 'Chosen members'}
                  </p>
                </div>
                {a.status !== 'COMPLETED' && (
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {a.status === 'SENDING' ? 'Texts sending' : 'Interrupted'}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2 whitespace-pre-wrap">{a.message}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {a.memberCount.toLocaleString()} members · {a.inAppCount.toLocaleString()} in the app
                {a.sendEmail ? ` · ${a.emailCount.toLocaleString()} emails` : ''}
                {a.sendSms
                  ? ` · ${a.smsSent.toLocaleString()} of ${a.smsRequested.toLocaleString()} texts sent${a.smsFailed ? `, ${a.smsFailed.toLocaleString()} failed` : ''}${
                      a.noPhoneCount ? `, ${a.noPhoneCount.toLocaleString()} no number` : ''
                    }${a.optedOutCount ? `, ${a.optedOutCount.toLocaleString()} opted out` : ''} · ${money(a.creditsUsed)}`
                  : ''}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="flex justify-between gap-3">
        <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
        <dd className="font-medium text-gray-900 dark:text-gray-100">{value.toLocaleString()}</dd>
      </div>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}
