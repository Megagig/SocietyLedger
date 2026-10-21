import { View } from 'react-native';
import { Users } from 'lucide-react-native';

import { AccentRule } from '@/components/ui/AccentRule';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** ui-registry.md "Premium auth surface" — compact brand identity header for auth *form* screens
 * (association lookup, login, register, forgot/reset password). Screens with a hero icon use
 * `AuthHeroScreen` instead, which carries its own badge and wordmark. */
export function AuthBrandMark() {
  const { color } = useThemeTokens();

  return (
    <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 18 }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          backgroundColor: color.ctaGradientFrom,
          borderWidth: 1.5,
          borderColor: color.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Users size={26} color={color.accent} strokeWidth={1.6} />
      </View>
      <Text
        variant="body"
        tone="secondary"
        style={{ letterSpacing: 2, marginTop: 12, fontWeight: '500' }}
      >
        SOCIETY LEDGER
      </Text>
      <View style={{ marginTop: 10 }}>
        <AccentRule width={48} />
      </View>
    </View>
  );
}
