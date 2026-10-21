import { View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ShieldAlert } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { AuthHeroScreen } from '@/components/layout/AuthHeroScreen';
import { t } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

const ADMIN_DOMAIN = 'admin.societyledger.com.ng';

/** A12 — shown on `PLATFORM_LOGIN_REQUIRED`. Deliberately plain text + copy, no link button
 * (ui-rules.md/project-overview.md §6.1 — "avoid steering staff credentials through a phone
 * flow"). */
export default function PlatformStaffScreen() {
  async function copyDomain() {
    await Clipboard.setStringAsync(ADMIN_DOMAIN);
    toast.success(t('auth.webOnly.copied'));
  }

  function signOut() {
    useTenantStore.getState().clearCurrent();
    router.replace('/(auth)/welcome');
  }

  return (
    <AuthHeroScreen
      icon={ShieldAlert}
      title={t('auth.webOnly.title')}
      description={t('auth.webOnly.description')}
      actions={
        <Button variant="accent-ghost" size="lg" fullWidth onPress={signOut} testID="web-only-sign-out">
          {t('auth.webOnly.signOut')}
        </Button>
      }
    >
      <View style={{ marginTop: 26 }}>
        <Card>
          <View className="flex-row items-center justify-between gap-3">
            <Text variant="body-strong">{ADMIN_DOMAIN}</Text>
            <Button variant="secondary" size="sm" onPress={copyDomain} testID="web-only-copy">
              {t('common.copy')}
            </Button>
          </View>
        </Card>
      </View>
    </AuthHeroScreen>
  );
}
