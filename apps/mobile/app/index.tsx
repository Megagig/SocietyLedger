import { Pressable, ScrollView, Text, View } from 'react-native';

import { useThemeMode, useThemeTokens } from '@/providers/ThemeProvider';

type Swatch = { label: string; className: string; tokenKey: keyof ReturnType<typeof useThemeTokens>['color'] };

const COLOR_SWATCHES: Swatch[] = [
  { label: 'bg', className: 'bg-bg', tokenKey: 'bg' },
  { label: 'surface', className: 'bg-surface', tokenKey: 'surface' },
  { label: 'surface-raised', className: 'bg-surface-raised', tokenKey: 'surfaceRaised' },
  { label: 'surface-sunken', className: 'bg-surface-sunken', tokenKey: 'surfaceSunken' },
  { label: 'border', className: 'bg-border', tokenKey: 'border' },
  { label: 'border-strong', className: 'bg-border-strong', tokenKey: 'borderStrong' },
  { label: 'primary', className: 'bg-primary', tokenKey: 'primary' },
  { label: 'primary-pressed', className: 'bg-primary-pressed', tokenKey: 'primaryPressed' },
  { label: 'primary-soft', className: 'bg-primary-soft', tokenKey: 'primarySoft' },
  { label: 'accent', className: 'bg-accent', tokenKey: 'accent' },
  { label: 'accent-soft', className: 'bg-accent-soft', tokenKey: 'accentSoft' },
  { label: 'success', className: 'bg-success', tokenKey: 'success' },
  { label: 'success-soft', className: 'bg-success-soft', tokenKey: 'successSoft' },
  { label: 'warning', className: 'bg-warning', tokenKey: 'warning' },
  { label: 'warning-soft', className: 'bg-warning-soft', tokenKey: 'warningSoft' },
  { label: 'danger', className: 'bg-danger', tokenKey: 'danger' },
  { label: 'danger-soft', className: 'bg-danger-soft', tokenKey: 'dangerSoft' },
  { label: 'info', className: 'bg-info', tokenKey: 'info' },
  { label: 'info-soft', className: 'bg-info-soft', tokenKey: 'infoSoft' },
  { label: 'focus', className: 'bg-focus', tokenKey: 'focus' },
  { label: 'passbook', className: 'bg-passbook', tokenKey: 'passbook' },
  { label: 'passbook-stamp', className: 'bg-passbook-stamp', tokenKey: 'passbookStamp' },
];

const TEXT_SAMPLES: { label: string; className: string }[] = [
  { label: 'display', className: 'font-extrabold text-display text-text' },
  { label: 'h1', className: 'font-bold text-h1 text-text' },
  { label: 'h2', className: 'font-bold text-h2 text-text' },
  { label: 'h3', className: 'font-semibold text-h3 text-text' },
  { label: 'body-lg', className: 'font-sans text-body-lg text-text' },
  { label: 'body', className: 'font-regular text-body text-text' },
  { label: 'label', className: 'font-semibold text-label text-text-secondary' },
  { label: 'caption', className: 'font-sans text-caption text-text-secondary' },
  { label: 'micro', className: 'font-semibold text-micro text-text-tertiary' },
  { label: 'num-lg', className: 'font-bold text-num-lg text-text' },
];

const SPACING_STEPS: { label: string; className: string }[] = [
  { label: '0.5 (2dp)', className: 'h-3 w-0.5' },
  { label: '1 (4dp)', className: 'h-3 w-1' },
  { label: '2 (8dp)', className: 'h-3 w-2' },
  { label: '3 (12dp)', className: 'h-3 w-3' },
  { label: '4 (16dp)', className: 'h-3 w-4' },
  { label: '5 (20dp)', className: 'h-3 w-5' },
  { label: '6 (24dp)', className: 'h-3 w-6' },
  { label: '8 (32dp)', className: 'h-3 w-8' },
  { label: '10 (40dp)', className: 'h-3 w-10' },
  { label: '12 (48dp)', className: 'h-3 w-12' },
  { label: '16 (64dp)', className: 'h-3 w-16' },
];

const RADIUS_STEPS: { label: string; className: string }[] = [
  { label: 'xs', className: 'rounded-xs' },
  { label: 'sm', className: 'rounded-sm' },
  { label: 'md', className: 'rounded-md' },
  { label: 'lg', className: 'rounded-lg' },
  { label: 'xl', className: 'rounded-xl' },
  { label: 'full', className: 'rounded-full' },
];

function SectionTitle({ children }: { children: string }) {
  return <Text className="mb-3 mt-6 font-bold text-h3 text-text">{children}</Text>;
}

export default function DesignTokensScreen() {
  const { preference, setPreference } = useThemeMode();
  const themeTokens = useThemeTokens();

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="px-4 pb-16 pt-16">
      <Text className="font-extrabold text-h1 text-text">Design tokens</Text>
      <Text className="mt-1 font-regular text-body text-text-secondary">
        F1.2 proof screen — every color, type, spacing and radius token in both themes.
      </Text>

      <View className="mt-4 flex-row gap-2">
        {(['system', 'light', 'dark'] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setPreference(mode)}
            className={
              preference === mode
                ? 'rounded-md bg-primary px-4 py-2'
                : 'rounded-md border border-border-strong bg-surface px-4 py-2'
            }
          >
            <Text className={preference === mode ? 'font-semibold text-body text-text-inverse' : 'font-semibold text-body text-text'}>
              {mode}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Colors</SectionTitle>
      <View className="flex-row flex-wrap gap-3">
        {COLOR_SWATCHES.map((swatch) => (
          <View key={swatch.label} className="w-28 items-start">
            <View className={`h-12 w-full rounded-md border border-border ${swatch.className}`} />
            <Text className="mt-1 font-sans text-caption text-text-secondary">{swatch.label}</Text>
            <Text className="font-sans text-micro text-text-tertiary">{themeTokens.color[swatch.tokenKey]}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Typography (Manrope)</SectionTitle>
      <View className="gap-2">
        {TEXT_SAMPLES.map((sample) => (
          <View key={sample.label} className="flex-row items-baseline gap-3">
            <Text className="w-20 font-sans text-caption text-text-tertiary">{sample.label}</Text>
            <Text className={sample.className}>Aa 0123456789</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Spacing (4dp grid)</SectionTitle>
      <View className="gap-2">
        {SPACING_STEPS.map((step) => (
          <View key={step.label} className="flex-row items-center gap-3">
            <Text className="w-20 font-sans text-caption text-text-tertiary">{step.label}</Text>
            <View className={`${step.className} bg-primary`} />
          </View>
        ))}
      </View>

      <SectionTitle>Radius</SectionTitle>
      <View className="flex-row flex-wrap gap-3">
        {RADIUS_STEPS.map((step) => (
          <View key={step.label} className="items-center">
            <View className={`h-12 w-12 bg-primary-soft border border-border-strong ${step.className}`} />
            <Text className="mt-1 font-sans text-caption text-text-secondary">{step.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
