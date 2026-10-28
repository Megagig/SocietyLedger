'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { API_ROUTES } from '@/utils/constants';
import { getSubdomainUrl } from '@/utils/domain';
import { ASSOCIATION_TYPE_OTHER, SUBDOMAIN_MESSAGES, associationSignupSchema, subdomainProblem, suggestSubdomain } from '@societyledger/shared';

type Form = { groupName: string; subdomain: string; firstName: string; lastName: string; email: string; phone: string; password: string; confirmPassword: string };

const inputClass = 'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

/**
 * T7.6: a thrift group signs up on its own, with no association behind it. It uses only Ajo and pays only for an Ajo tier (it has a 14-day
 * trial with the Starter tier free). The server keeps this closed until the platform switch is turned on, and the page says so plainly.
 */
export default function ThriftSignupPage() {
  const [form, setForm] = useState<Form>({ groupName: '', subdomain: '', firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [done, setDone] = useState<{ requiresVerification: boolean; pendingApproval: boolean } | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [addressNote, setAddressNote] = useState<string | null>(null);
  const touched = useRef(false);
  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // The address follows the group name until the person types their own.
  useEffect(() => {
    if (!touched.current) setForm((f) => ({ ...f, subdomain: suggestSubdomain(f.groupName) }));
  }, [form.groupName]);

  useEffect(() => {
    setAvailable(null);
    setAddressNote(null);
    const subdomain = form.subdomain;
    if (!subdomain) return;
    const problem = subdomainProblem(subdomain);
    if (problem) {
      if (problem !== 'TOO_SHORT') {
        setAvailable(false);
        setAddressNote(SUBDOMAIN_MESSAGES[problem]);
      }
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_ROUTES.ASSOCIATIONS.CHECK_SUBDOMAIN}?subdomain=${encodeURIComponent(subdomain)}`);
        if (cancelled) return;
        if (res.status === 404) setAvailable(true);
        else {
          setAvailable(false);
          setAddressNote(res.status === 409 ? SUBDOMAIN_MESSAGES.RESERVED : 'That address is already taken.');
        }
      } catch {
        if (!cancelled) setAvailable(null);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.subdomain]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) return setError('The two passwords do not match.');
    const payload = {
      association: { name: form.groupName.trim(), subdomain: form.subdomain, type: ASSOCIATION_TYPE_OTHER, customType: 'Thrift group' },
      admin: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password },
    };
    const checked = associationSignupSchema.safeParse(payload);
    if (!checked.success) return setError(checked.error.issues[0]?.message ?? 'Please check the form.');
    setLoading(true);
    try {
      const response = await fetch(API_ROUTES.ASSOCIATIONS.THRIFT_SIGNUP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checked.data) });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'THRIFT_SIGNUP_CLOSED') return setClosed(true);
        throw new Error(data.message || 'Sign-up failed.');
      }
      setDone({ requiresVerification: data.data?.requiresVerification !== false, pendingApproval: data.data?.pendingApproval !== false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">{body}</div>
    </div>
  );

  if (closed) {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thrift group sign-up is not open yet</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">We are not accepting new thrift groups right now. Please check back soon.</p>
        <p className="mt-4 text-sm text-gray-500">Already part of an association? <Link href="/signup" className="text-green-700 underline">Sign up your association</Link> and add the Ajo add-on.</p>
      </div>,
    );
  }

  if (done) {
    const steps = [done.requiresVerification ? 'Verify your email with the code we sent' : null, done.pendingApproval ? 'Wait for SocietyLedger to approve your group. Your access starts then.' : null, 'Sign in at your group address'].filter((s): s is string => s !== null);
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{done.requiresVerification ? 'Check your email' : 'Your group was created'}</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400"><span className="font-semibold">{form.groupName}</span> is ready.{done.requiresVerification ? <> We sent a code to <span className="font-semibold">{form.email}</span>.</> : null}</p>
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-left dark:bg-green-900/20"><p className="text-sm text-gray-600 dark:text-gray-400">Your group address</p><p className="break-all font-mono font-semibold text-green-700 dark:text-green-400">{getSubdomainUrl(form.subdomain)}</p></div>
        <ol className="mt-4 list-inside list-decimal space-y-1 text-left text-sm text-gray-700 dark:text-gray-300">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">You start with a 14-day free trial of the Ajo add-on. After that you pay only for the Ajo tier that fits the number of people who contribute. There is nothing else to buy.</p>
        <Link href={done.requiresVerification ? `/auth/verify-email?email=${encodeURIComponent(form.email)}` : '/auth/login'} className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700">{done.requiresVerification ? 'Enter verification code' : 'Go to sign in'}</Link>
      </div>,
    );
  }

  return shell(
    <form onSubmit={submit} className="space-y-5">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Start a thrift group</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Run your savings circle (ajo, esusu, adashe) with proper records. You do not need an association. You pay only for Ajo, and SocietyLedger never holds your group&apos;s money.</p>
      </div>
      <div><label className={labelClass} htmlFor="groupName">Group name</label><input id="groupName" className={inputClass} value={form.groupName} onChange={(e) => set('groupName', e.target.value)} required maxLength={80} /></div>
      <div>
        <label className={labelClass} htmlFor="subdomain">Your group address</label>
        <div className="flex items-center gap-2"><input id="subdomain" className={inputClass} value={form.subdomain} onChange={(e) => { touched.current = true; set('subdomain', e.target.value.toLowerCase()); }} required /></div>
        <p className="mt-1 text-xs text-gray-500">{getSubdomainUrl(form.subdomain || 'yourgroup')}</p>
        {available === true && <p className="mt-1 text-sm text-green-600">That address is free.</p>}
        {available === false && addressNote && <p className="mt-1 text-sm text-red-600">{addressNote}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass} htmlFor="firstName">Your first name</label><input id="firstName" className={inputClass} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required /></div><div><label className={labelClass} htmlFor="lastName">Your last name</label><input id="lastName" className={inputClass} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required /></div></div>
      <div><label className={labelClass} htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} required /></div>
      <div><label className={labelClass} htmlFor="phone">Phone number</label><input id="phone" type="tel" autoComplete="tel" className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} required /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass} htmlFor="password">Password</label><input id="password" type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={(e) => set('password', e.target.value)} required /></div><div><label className={labelClass} htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" type="password" autoComplete="new-password" className={inputClass} value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} required /></div></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={loading || available === false} className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-60">{loading ? 'Creating your group…' : 'Create my group'}</button>
      <p className="text-center text-sm text-gray-500">Part of an association? <Link href="/signup" className="text-green-700 underline">Sign up your association</Link> and add the Ajo add-on. Already have an account? <Link href="/auth/login" className="text-green-700 underline">Sign in</Link></p>
    </form>,
  );
}
