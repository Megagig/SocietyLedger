import { router } from 'expo-router';

import { AccessState } from '@/components/feedback/AccessState';

export type NoPermissionProps = {
  /** Defaults to `router.replace('/')` — overridable so this stays a plain presentational component for tests/stories. */
  onGoHome?: () => void;
};

/** ui-rules.md §5.11 — only reachable via deep link. */
export function NoPermission({ onGoHome }: NoPermissionProps) {
  return <AccessState kind="permission" action={{ label: 'Go home', onPress: onGoHome ?? (() => router.replace('/')) }} />;
}
