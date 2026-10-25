import { useState } from 'react';
import { Image, ScrollView, View, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { CalendarCheck, Smartphone, Wallet, type LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { t } from '@/lib/i18n';

type Slide = { icon: LucideIcon; title: string; description: string };

const SLIDES: Slide[] = [
  { icon: Wallet, title: t('auth.welcome.slide1Title'), description: t('auth.welcome.slide1Description') },
  { icon: CalendarCheck, title: t('auth.welcome.slide2Title'), description: t('auth.welcome.slide2Description') },
  { icon: Smartphone, title: t('auth.welcome.slide3Title'), description: t('auth.welcome.slide3Description') },
];

/** A2 — 3-slide welcome carousel with a full-width illustrated header panel and text content
 * below. Each slide fills the full screen width; the `pagingEnabled` ScrollView handles snapping.
 * `topInset` is passed from the parent so the brand wordmark clears the status bar. */
export function WelcomeCarousel({ topInset = 0 }: { topInset?: number }) {
  const { width, height: windowHeight } = useWindowDimensions();
  const { color } = useThemeTokens();
  const [activeIndex, setActiveIndex] = useState(0);

  // Illustration area is ~48% of window height; the rest is content + dots.
  const illustrationHeight = Math.round(windowHeight * 0.48);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        testID="welcome-carousel"
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={{ width }}>
            {/* ── Illustration panel ───────────────────────────────────────── */}
            <View
              style={{
                height: illustrationHeight,
                backgroundColor: color.passbook,
                borderBottomLeftRadius: 36,
                borderBottomRightRadius: 36,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Decorative background circles — depth through layering */}
              <View
                style={{
                  position: 'absolute',
                  top: -100,
                  right: -100,
                  width: 320,
                  height: 320,
                  borderRadius: 160,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: -80,
                  left: -80,
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 60,
                  left: 40,
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 48,
                  right: 48,
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                }}
              />

              {/* Brand wordmark — top-left, below safe area */}
              <View
                style={{
                  position: 'absolute',
                  top: topInset + 20,
                  left: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Image
                  source={require('../../../../assets/images/app-tile.png')}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                  accessibilityLabel="SocietyLedger"
                />
                <Text variant="body-strong" tone="inverse">
                  Society Ledger
                </Text>
              </View>

              {/* Icon stage — double-ring treatment for depth */}
              <View
                style={{
                  width: 164,
                  height: 164,
                  borderRadius: 82,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 124,
                    height: 124,
                    borderRadius: 62,
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <slide.icon size={56} color="#FFFFFF" strokeWidth={1.25} />
                </View>
              </View>
            </View>

            {/* ── Text content ─────────────────────────────────────────────── */}
            <View
              style={{
                flex: 1,
                paddingHorizontal: 28,
                paddingTop: 36,
                alignItems: 'center',
              }}
            >
              <Text variant="h1" align="center" style={{ marginBottom: 14 }}>
                {slide.title}
              </Text>
              <Text variant="body-lg" tone="secondary" align="center">
                {slide.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 20,
        }}
      >
        {SLIDES.map((slide, index) => (
          <View
            key={slide.title}
            style={{
              height: 8,
              width: index === activeIndex ? 28 : 8,
              borderRadius: 4,
              backgroundColor: index === activeIndex ? color.primary : color.borderStrong,
            }}
          />
        ))}
      </View>
    </View>
  );
}
