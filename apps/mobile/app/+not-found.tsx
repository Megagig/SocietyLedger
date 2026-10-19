import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="font-bold text-h2 text-text">This screen doesn&apos;t exist.</Text>
        <Link href="/" className="font-semibold text-body text-primary">
          Go to home screen
        </Link>
      </View>
    </>
  );
}
