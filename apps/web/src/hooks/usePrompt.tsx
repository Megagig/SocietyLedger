'use client';

import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Button, Group, Modal, Select, Textarea, TextInput } from '@mantine/core';

export type PromptOptions = {
  title: string;
  /** The label above the field. */
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  /** Show a long text box instead of a single line (for reasons). */
  multiline?: boolean;
  /** Pick from a fixed list instead of typing. */
  choices?: { value: string; label: string }[];
};

/**
 * An in-page replacement for the browser's `prompt()` popup. `await prompt({ title, label })` resolves to the trimmed text the
 * person entered, or null if they cancelled or left it empty. Render the returned `element` once in the page.
 */
export function usePrompt(): { prompt: (options: PromptOptions) => Promise<string | null>; element: ReactElement } {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const settle = useCallback((result: string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const prompt = useCallback(
    (next: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        // A second prompt while one is open cancels the first rather than leaving it hanging.
        resolver.current?.(null);
        resolver.current = resolve;
        setValue(next.initialValue ?? '');
        setOptions(next);
      }),
    [],
  );

  const submit = () => settle(value.trim() === '' ? null : value.trim());

  const field = options?.choices ? (
    <Select label={options.label} data={options.choices} value={value || null} onChange={(next) => setValue(next ?? '')} allowDeselect={false} data-autofocus />
  ) : options?.multiline ? (
    <Textarea label={options?.label} placeholder={options?.placeholder} value={value} onChange={(event) => setValue(event.currentTarget.value)} minRows={3} autosize data-autofocus />
  ) : (
    <TextInput
      label={options?.label}
      placeholder={options?.placeholder}
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') submit();
      }}
      data-autofocus
    />
  );

  const element = (
    <Modal opened={options !== null} onClose={() => settle(null)} title={options?.title} centered size="sm">
      {field}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => settle(null)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={value.trim() === ''}>
          {options?.confirmLabel ?? 'Save'}
        </Button>
      </Group>
    </Modal>
  );

  return { prompt, element };
}
