'use client';

import { useEffect, useState } from 'react';
import { Button, FileInput, Select, TextInput } from '@mantine/core';
import { normalizeNigerianPhone } from '@/lib/ajo/contributorCsv';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { ajoStaffApi } from '@/lib/ajo/staffApi';

const STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Step 1: confirm who the group is. Saved with the same calls the association profile uses; the group address never changes. */
export function StepProfile({ groupName, subdomain, onDone, onSkip }: { groupName: string; subdomain?: string; onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const [name, setName] = useState(groupName);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // What is already saved (the sign-up phone and email, or an earlier visit) is the starting point.
  useEffect(() => {
    ajoStaffApi.profile().then((p) => {
      setPhone(p.phone ?? '');
      setEmail(p.email ?? '');
      const parts = (p.address ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && STATES.includes(last)) {
        setState(last);
        setArea(parts.slice(0, -1).join(', '));
      } else setArea(parts.join(', '));
    }).catch(() => undefined);
  }, []);
  useEffect(() => setName(groupName), [groupName]);

  const save = async () => {
    if (name.trim().length < 2 || name.trim().length > 80) return setProblem('The group name is 2 to 80 characters.');
    if (!normalizeNigerianPhone(phone)) return setProblem('Enter a Nigerian phone number for the group, for example 08031234567.');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setProblem('That email address does not look right.');
    if (logo && (!['image/png', 'image/jpeg'].includes(logo.type) || logo.size > MAX_LOGO_BYTES)) return setProblem('The logo must be a PNG or JPG of up to 2 MB.');
    setProblem(null);
    setBusy(true);
    try {
      await ajoStaffApi.saveProfile({ name: name.trim(), address: [area.trim(), state].filter(Boolean).join(', '), phone: phone.trim(), email: email.trim() });
      if (logo) await ajoStaffApi.uploadLogo(logo);
      await onDone();
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not save the profile. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextInput label="Group name" value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={80} required description={subdomain ? `Changing the name does not change your group address (${subdomain}).` : undefined} />
      <TextInput label="Contact phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} required />
      <TextInput label="Contact email (optional)" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Where the group meets (area or town, optional)" value={area} onChange={(e) => setArea(e.currentTarget.value)} />
        <Select label="State (optional)" data={STATES} value={state} onChange={setState} searchable clearable />
      </div>
      <FileInput label="Logo (optional)" description="PNG or JPG, up to 2 MB." accept="image/png,image/jpeg" value={logo} onChange={setLogo} clearable />
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      <div className="flex justify-between">
        <Button variant="subtle" onClick={() => { setBusy(true); onSkip().finally(() => setBusy(false)); }} disabled={busy}>Skip this step</Button>
        <Button color="green" onClick={save} loading={busy}>Save and continue</Button>
      </div>
    </div>
  );
}
