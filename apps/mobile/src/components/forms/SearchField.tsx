import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

import { IconButton } from '@/components/ui/IconButton';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  testID?: string;
};

/**
 * ui-rules.md §5.6 — leading search icon, clear button, 300ms debounce.
 * Deliberately a plain controlled component (value/onChangeText), not RHF-bound — every real
 * use (MG1 member search, etc.) is a live list filter, never a value submitted as part of a
 * validated form schema, unlike the rest of this folder.
 */
export function SearchField({ value, onChangeText, placeholder = 'Search', debounceMs = 300, testID }: SearchFieldProps) {
  const { color } = useThemeTokens();
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync an externally-changed `value` (e.g. a cleared filter) during render, not in an effect —
  // the react-hooks/set-state-in-effect rule flags the effect form of this pattern.
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  const handleChangeText = (text: string) => {
    setDraft(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChangeText(text), debounceMs);
  };

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setDraft('');
    onChangeText('');
  };

  return (
    <View className="h-11 flex-row items-center gap-2 rounded-md bg-surface-sunken px-3">
      <Search size={18} color={color.textTertiary} strokeWidth={1.75} />
      <TextInput
        testID={testID}
        value={draft}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textTertiary}
        returnKeyType="search"
        className="flex-1 font-regular text-body text-text"
      />
      {draft ? <IconButton icon={X} accessibilityLabel="Clear search" onPress={clear} /> : null}
    </View>
  );
}
