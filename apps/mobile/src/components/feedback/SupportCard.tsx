import { View, Linking, Pressable } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';

const SUPPORT_WHATSAPP_NUMBER = '2348060374755';

/** WhatsApp's brand green — a third-party brand mark, not a theme colour, so it is intentionally
 * literal (same rationale as `on-passbook` being literal white). */
const WHATSAPP_GREEN = '#25D366';

const WHATSAPP_GLYPH =
  'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.05s.87 2.37.99 2.54c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z';

/** Opens the WhatsApp support chat with `message` already drafted. */
export function openSupportChat(message: string) {
  Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
}

export type SupportCardProps = {
  /** Prefills the WhatsApp draft so support lands on an identifiable account. */
  message: string;
  /** Renders the lead-in row ("Taking longer than expected?") above the card. */
  nudge?: boolean;
  /** Lead-in copy. Defaults to the pending-approval wording. */
  nudgeLabel?: string;
};

/** ui-registry.md "Premium auth surface" — WhatsApp support block. Opens the chat with `message`
 * already drafted via `wa.me`'s `text` param, so nobody has to explain their situation twice. */
export function SupportCard({ message, nudge = true, nudgeLabel }: SupportCardProps) {
  const { color } = useThemeTokens();

  function open() {
    openSupportChat(message);
  }

  return (
    <>
      {nudge ? (
        <Pressable
          onPress={open}
          testID="support-nudge"
          accessibilityRole="link"
          accessibilityLabel={`${nudgeLabel ?? t('auth.pending.supportPrompt')} ${t('auth.pending.contactSupport')}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: color.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageCircle size={19} color={color.primary} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body-strong">{nudgeLabel ?? t('auth.pending.supportPrompt')}</Text>
              <Text variant="caption" tone="accentText" style={{ fontWeight: '600', marginTop: 2 }}>
                {t('auth.pending.contactSupport')}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <Pressable
        onPress={open}
        testID="support-card"
        accessibilityRole="link"
        accessibilityLabel={`${t('auth.pending.contactSupport')} ${t('auth.pending.supportNumber')}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginTop: nudge ? 14 : 26,
            padding: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: color.border,
            backgroundColor: color.surfaceRaised,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: WHATSAPP_GREEN,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={27} height={27} viewBox="0 0 24 24">
              <Path d={WHATSAPP_GLYPH} fill="#FFFFFF" />
            </Svg>
          </View>

          <View style={{ flex: 1 }}>
            <Text variant="body-strong">{t('auth.pending.needHelp')}</Text>
            <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
              {t('auth.pending.supportNumber')}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingVertical: 6,
                paddingHorizontal: 11,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: color.surfaceSunken,
              }}
            >
              <Text variant="caption" style={{ color: WHATSAPP_GREEN, fontWeight: '700' }}>
                {t('auth.pending.contactSupport')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </>
  );
}
