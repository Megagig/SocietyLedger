'use client';

import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';

export type ConfirmOptions = {
  /** What is about to happen, in one sentence. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletes and other things that can't be undone. */
  danger?: boolean;
};

/**
 * An in-page replacement for the browser's `confirm()` popup. Call `await confirm({ message })` where you used to call
 * `confirm(message)`; it resolves to true if the person pressed the confirm button and false for anything else (Cancel, Escape,
 * clicking outside). Render the returned `element` once in the page.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; element: ReactElement } {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second confirm while one is open cancels the first rather than leaving it hanging.
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const element = (
    <Modal opened={options !== null} onClose={() => settle(false)} title={options?.title ?? 'Are you sure?'} centered size="sm">
      <Text size="sm">{options?.message}</Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => settle(false)}>
          {options?.cancelLabel ?? 'Cancel'}
        </Button>
        <Button color={options?.danger ? 'red' : undefined} onClick={() => settle(true)}>
          {options?.confirmLabel ?? 'Confirm'}
        </Button>
      </Group>
    </Modal>
  );

  return { confirm, element };
}
