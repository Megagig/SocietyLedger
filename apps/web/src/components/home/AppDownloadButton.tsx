'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Checkbox, Modal, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBrandAndroid, IconCheck, IconDownload } from '@tabler/icons-react';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ENDPOINT = () => `${apiBase()}/api/public/app-download`;

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', consent: false, website: '' };

/**
 * The "Download the Android app" button on the landing page. The link to the file is never in the page: the form posts the person's
 * details to the API, which saves them and answers with the link, and only then does the download start.
 * The button appears only when a version is published, so the page never offers a download that cannot happen.
 */
export function AppDownloadButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const [version, setVersion] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(ENDPOINT())
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (alive && body?.data?.available) setVersion(body.data.version ?? '');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (version === null) return null;

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.currentTarget.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.data?.url) {
        setError(body?.message ?? 'Something went wrong. Please try again.');
        return;
      }
      setLink(body.data.url);
      window.location.href = body.data.url;
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    close();
    // Start fresh next time, but only once the person has what they came for.
    if (link) {
      setForm(EMPTY);
      setLink(null);
    }
    setError(null);
  }

  return (
    <>
      <Button
        size="xl"
        variant="outline"
        className="border-2 border-teal-500 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"
        leftSection={<IconBrandAndroid size={22} />}
        onClick={open}
      >
        Download the Android app
      </Button>

      <Modal opened={opened} onClose={handleClose} title="Get the SocietyLedger Android app" centered size="md">
        {link ? (
          <Stack align="center" gap="sm" py="md">
            <IconCheck size={40} className="text-teal-500" />
            <Text fw={600}>Your download is starting.</Text>
            <Text size="sm" c="dimmed" ta="center">
              If it doesn&apos;t start, use the button below. When it finishes, open the file to install. Your phone may ask you to allow installs from your browser.
            </Text>
            <Button component="a" href={link} leftSection={<IconDownload size={18} />}>
              Download again
            </Button>
          </Stack>
        ) : (
          <form onSubmit={submit} noValidate>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Tell us who you are and the download starts straight away.{version ? ` Current version: ${version}.` : ''}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput label="First name" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" required />
                <TextInput label="Last name" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" required />
              </SimpleGrid>
              <TextInput label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
              <TextInput label="Phone number" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="0803 123 4567" required />
              {/* Honeypot: invisible to people and to screen readers, tempting to bots. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', height: 0, overflow: 'hidden' }}>
                <label>
                  Website
                  <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </label>
              </div>
              <Checkbox
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.currentTarget.checked })}
                label={
                  <>
                    I agree that SocietyLedger may store my details and contact me about the app and updates. See our{' '}
                    <Link href="/privacy" target="_blank" className="underline">
                      Privacy Policy
                    </Link>
                    .
                  </>
                }
              />
              {error && (
                <Text size="sm" c="red" role="alert">
                  {error}
                </Text>
              )}
              <Button type="submit" loading={busy} leftSection={<IconDownload size={18} />} className="bg-gradient-to-r from-teal-500 to-green-500 text-white">
                Download
              </Button>
            </Stack>
          </form>
        )}
      </Modal>
    </>
  );
}
