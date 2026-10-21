import { useState } from 'react';
import { Clipboard, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AlertCircle, Building2, Check, CreditCard, Copy } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { useInitializePaystackPayment, useSubmitPaymentProof } from '@/features/memberFinance/mutations';
import { useMemberDues, useMemberLevies, usePaymentInfo } from '@/features/memberFinance/queries';
import { useThemeTokens } from '@/providers/ThemeProvider';

const PAYSTACK_MOBILE_CALLBACK = 'https://api.societyledger.app/api/payments/mobile-return';

type Tab = 'online' | 'bank';

type AttachedFile = {
  uri: string;
  name: string;
  type: string;
};

export default function PayScreen() {
  const { transactionId: rawId } = useLocalSearchParams<{ transactionId: string }>();
  const transactionId = rawId ? Number(rawId) : NaN;

  const [activeTab, setActiveTab] = useState<Tab>('online');
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [notes, setNotes] = useState('');

  const { color } = useThemeTokens();
  const paymentInfoQuery = usePaymentInfo();
  const leviesQuery = useMemberLevies();
  const duesQuery = useMemberDues();

  const initMutation = useInitializePaystackPayment();
  const proofMutation = useSubmitPaymentProof();

  // Levies have transactionId; dues use their own id as the payment reference.
  const levy = leviesQuery.data?.find((l) => l.transactionId === transactionId);
  const due = !levy ? (duesQuery.data?.find((d) => d.id === transactionId) ?? null) : null;

  const amount = levy?.balance ?? due?.balance ?? null;
  const itemName = levy?.campaign.name ?? due?.category.name ?? '—';

  // Paystack requires a server-side transactionId which only levies expose.
  const supportsOnlinePayment = !!levy;
  // When online payment isn't available (dues), force the bank tab.
  const effectiveTab = supportsOnlinePayment ? activeTab : 'bank';

  const paymentInfo = paymentInfoQuery.data;
  const bankAccounts = paymentInfo?.bankAccounts ?? [];
  const paystackEnabled = paymentInfo?.paystackEnabled ?? false;

  const isLoading = leviesQuery.isPending || paymentInfoQuery.isPending || (!levy && duesQuery.isPending);
  const isError = leviesQuery.isError || paymentInfoQuery.isError;

  async function handlePayOnline() {
    if (isNaN(transactionId)) return;
    try {
      const result = await initMutation.mutateAsync({ transactionId, callbackUrl: PAYSTACK_MOBILE_CALLBACK });
      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.authorizationUrl,
        'societyledger://'
      );
      if (browserResult.type === 'success' && browserResult.url) {
        const url = new URL(browserResult.url);
        const reference = url.searchParams.get('reference');
        if (reference) {
          router.replace({ pathname: '/money/transaction/[reference]' as never, params: { reference } });
        }
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not start payment. Please try again.');
    }
  }

  async function handleAttachReceipt() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Photo library access is needed to attach a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() ?? 'receipt.jpg';
      setAttachedFile({ uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg' });
    }
  }

  async function handleAttachDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' });
      }
    } catch {
      toast.error('Could not open file picker.');
    }
  }

  async function handleSubmitProof() {
    if (isNaN(transactionId)) return;
    if (!attachedFile) {
      toast.error('Please attach your payment receipt before submitting.');
      return;
    }
    try {
      await proofMutation.mutateAsync({ transactionId, file: attachedFile, notes: notes || undefined });
      toast.success('Receipt submitted — pending admin review.');
      router.back();
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not submit proof. Please try again.');
    }
  }

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay" onBack={() => router.back()} />
        <View className="gap-3 px-4">
          <Skeleton width="100%" height={100} radius="lg" />
          <Skeleton width="100%" height={56} radius="md" />
          <Skeleton width="100%" height={56} radius="md" />
        </View>
      </Screen>
    );
  }

  if (isError || isNaN(transactionId)) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay" onBack={() => router.back()} />
        <EmptyState icon={AlertCircle} title="Could not load payment details" description="Pull down to retry." />
      </Screen>
    );
  }

  if (!levy && !due) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay" onBack={() => router.back()} />
        <EmptyState icon={AlertCircle} title="Item not found" description="Could not find this payment item. Pull down to retry." />
      </Screen>
    );
  }

  if (!amount || amount.lte(0)) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay" onBack={() => router.back()} />
        <EmptyState
          icon={Check}
          title="Already paid"
          description="This item has no outstanding balance."
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen edges={['top']}>
      <ScreenHeader title="Make Payment" onBack={() => router.back()} />

      {/* Summary card */}
      <View className="mx-4 mb-6 rounded-2xl overflow-hidden bg-surface-raised p-5 gap-1">
        <Text variant="caption" tone="secondary" className="uppercase tracking-wide">{itemName}</Text>
        <Money value={amount} size="display" />
        <Text variant="caption" tone="secondary">Outstanding balance</Text>
      </View>

      {/* Tab switcher — only show online tab if Paystack is supported for this item */}
      <View className="flex-row mx-4 mb-6 rounded-xl overflow-hidden bg-surface-raised">
        {supportsOnlinePayment && (
          <TouchableOpacity
            className="flex-1 py-3 items-center"
            style={{ backgroundColor: effectiveTab === 'online' ? color.primary : 'transparent' }}
            onPress={() => setActiveTab('online')}
          >
            <Text variant="body-strong" style={{ color: effectiveTab === 'online' ? '#fff' : color.textSecondary }}>
              Pay online
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          className="flex-1 py-3 items-center"
          style={{ backgroundColor: effectiveTab === 'bank' ? color.primary : 'transparent' }}
          onPress={() => setActiveTab('bank')}
        >
          <Text variant="body-strong" style={{ color: effectiveTab === 'bank' ? '#fff' : color.textSecondary }}>
            Bank transfer
          </Text>
        </TouchableOpacity>
      </View>

      {/* Online tab */}
      {activeTab === 'online' && supportsOnlinePayment && (
        <View className="gap-4">
          {paystackEnabled ? (
            <>
              <View className="rounded-xl bg-surface-raised p-4 gap-2">
                <View className="flex-row items-center gap-2">
                  <CreditCard size={20} color={color.primary} strokeWidth={1.75} />
                  <Text variant="body-strong">Pay with Paystack</Text>
                </View>
                <Text variant="body" tone="secondary">
                  You'll be redirected to Paystack's secure checkout page to complete your payment.
                  Cards, bank transfer, and USSD are all accepted.
                </Text>
              </View>
              <Button
                variant="gradient"
                size="lg"
                fullWidth
                onPress={handlePayOnline}
                disabled={initMutation.isPending}
                loading={initMutation.isPending}
              >
                {`Pay ${formatMoney(amount!)} now`}
              </Button>
            </>
          ) : (
            <EmptyState
              icon={CreditCard}
              title="Online payments not enabled"
              description="This association has not enabled online payments. Please use the bank transfer option."
            />
          )}
        </View>
      )}

      {/* Bank transfer tab */}
      {effectiveTab === 'bank' && (
        <View className="gap-4" style={{ paddingBottom: 96 }}>
          {bankAccounts.length === 0 ? (
            <View className="px-4">
              <EmptyState
                icon={Building2}
                title="No bank accounts configured"
                description="Contact your association admin for bank account details."
              />
            </View>
          ) : (
            <Section title="Transfer to">
              <ListGroup>
                {bankAccounts.map((account) => (
                  <ListItem
                    key={account.id}
                    leading={<Building2 size={20} color={color.primary} strokeWidth={1.75} />}
                    title={account.accountName}
                    meta={`${account.bankName} · ${account.accountNumber}`}
                    trailing={
                      <TouchableOpacity
                        onPress={() => {
                          Clipboard.setString(account.accountNumber);
                          toast.success('Account number copied');
                        }}
                        className="p-2"
                      >
                        <Copy size={16} color={color.textSecondary} strokeWidth={1.75} />
                      </TouchableOpacity>
                    }
                  />
                ))}
              </ListGroup>
            </Section>
          )}

          <Section title="Upload receipt">
            <View className="px-4 gap-3">
              <Text variant="body" tone="secondary">
                After transferring, attach your payment receipt (screenshot or bank debit alert).
              </Text>

              {attachedFile ? (
                <View className="rounded-xl bg-surface-raised p-4 flex-row items-center gap-3">
                  <Check size={20} color={color.success} strokeWidth={2} />
                  <View className="flex-1">
                    <Text variant="body-strong" numberOfLines={1}>{attachedFile.name}</Text>
                    <Text variant="caption" tone="secondary">Receipt attached</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAttachedFile(null)}>
                    <Text variant="caption" style={{ color: color.danger }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button variant="secondary" size="sm" onPress={handleAttachReceipt}>
                      Gallery / Camera
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button variant="secondary" size="sm" onPress={handleAttachDocument}>
                      Attach PDF
                    </Button>
                  </View>
                </View>
              )}

              <View className="gap-1">
                <Text variant="caption" tone="secondary">Notes (optional)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Transfer reference or teller number"
                  placeholderTextColor={color.textSecondary}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: color.surfaceSunken,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: color.border,
                    padding: 12,
                    color: color.text,
                    fontSize: 15,
                    minHeight: 72,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </View>
          </Section>
        </View>
      )}

    </Screen>
    {effectiveTab === 'bank' && (
      <StickyFooter>
        <View style={{ flex: 1 }}>
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            onPress={handleSubmitProof}
            disabled={proofMutation.isPending}
            loading={proofMutation.isPending}
          >
            Submit payment proof
          </Button>
        </View>
      </StickyFooter>
    )}
    </View>
  );
}
