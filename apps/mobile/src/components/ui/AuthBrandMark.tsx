import { Image, View } from 'react-native';

import { AccentRule } from '@/components/ui/AccentRule';
import { Text } from '@/components/ui/Text';

/** ui-registry.md "Premium auth surface" — compact brand identity header for auth *form* screens
 * (association lookup, login, register, forgot/reset password). Screens with a hero icon use
 * `AuthHeroScreen` instead, which carries its own badge and wordmark. */
export function AuthBrandMark() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 18 }}>
      <Image
        source={require('../../../assets/images/logo-mark.png')}
        style={{ width: 64, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="SocietyLedger"
      />
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
