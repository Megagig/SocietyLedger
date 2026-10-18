'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, Stack, Title, Text, PinInput,
  Button, Alert, CopyButton, Code, Group, Divider, Skeleton,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconCopy } from '@tabler/icons-react';
import QRCode from 'qrcode';

interface SetupData {
  qrUri: string;
  secret: string;
}

export default function TotpSetupPage() {
  const router = useRouter();

  const [setup, setSetup] = useState<SetupData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/bff/2fa/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (!res.ok) {
          setLoadError(json.message ?? 'Could not start setup');
          return;
        }
        const data: SetupData = { qrUri: json.data.qrUri, secret: json.data.secret };
        setSetup(data);
        // Generate QR code locally — never send the secret to a third party
        const dataUrl = await QRCode.toDataURL(data.qrUri, { width: 180, margin: 1 });
        setQrDataUrl(dataUrl);
      } catch {
        setLoadError('Network error — please try again.');
      }
    })();
  }, []);

  async function handleConfirm() {
    if (code.length !== 6) return;
    setSubmitError(null);
    setLoading(true);

    try {
      const res = await fetch('/bff/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.message ?? 'Invalid code — try again');
        setCode('');
        return;
      }
      router.push('/dashboard');
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--admin-page-bg)',
      }}
    >
      <Card
        style={{ width: 420, backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        p="xl"
        radius="lg"
      >
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={2} ta="center">Set up two-factor authentication</Title>
            <Text size="sm" c="dimmed" ta="center">
              Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
            </Text>
          </Stack>

          {loadError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" p="sm">
              <Text size="sm">{loadError}</Text>
            </Alert>
          )}

          <Group justify="center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="TOTP QR code" width={180} height={180} style={{ borderRadius: 8 }} />
            ) : (
              <Skeleton width={180} height={180} radius="md" />
            )}
          </Group>

          {setup && (
            <>
              <Divider label="or enter manually" labelPosition="center" />
              <Stack gap={4}>
                <Text size="xs" c="dimmed" ta="center">Manual entry key</Text>
                <Group justify="center" gap="xs">
                  <Code fz="sm" style={{ letterSpacing: '0.1em' }}>{setup.secret}</Code>
                  <CopyButton value={setup.secret}>
                    {({ copied, copy }) => (
                      <Button
                        size="xs"
                        variant="subtle"
                        color={copied ? 'green' : 'gray'}
                        onClick={copy}
                        leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </Stack>
            </>
          )}

          {submitError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" p="sm">
              <Text size="sm">{submitError}</Text>
            </Alert>
          )}

          <Stack gap="sm">
            <Text size="sm" ta="center">Enter the 6-digit code from your app to confirm setup:</Text>
            <Group justify="center">
              <PinInput
                length={6}
                type="number"
                value={code}
                onChange={setCode}
                onComplete={handleConfirm}
                size="md"
                oneTimeCode
                disabled={!setup}
              />
            </Group>
            <Button
              fullWidth
              size="sm"
              loading={loading}
              disabled={code.length !== 6 || !setup}
              onClick={handleConfirm}
            >
              Confirm and enable 2FA
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}
