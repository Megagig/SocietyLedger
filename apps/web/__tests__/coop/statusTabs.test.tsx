/**
 * @jest-environment jsdom
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { StatusTabs } from '@/components/coop/StatusTabs';
import { CoopButton } from '@/components/coop/CoopButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });

const TABS = [
  { value: 'a', label: 'To review' },
  { value: 'b', label: 'To approve' },
  { value: 'c', label: 'Paid out' },
] as const;

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
  return (
    <StatusTabs
      label="Withdrawal status"
      tabs={[...TABS]}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      panelId="panel-x"
    />
  );
}

function mount(node: React.ReactNode): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(<MantineProvider>{node}</MantineProvider>));
  return el;
}

const tabs = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
const press = (button: HTMLElement, key: string) => act(() => void button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));

describe('StatusTabs', () => {
  it('names the strip, marks the chosen tab, and points every tab at its panel', () => {
    const el = mount(<Harness />);
    expect(el.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Withdrawal status');
    expect(tabs(el).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs(el).every((t) => t.getAttribute('aria-controls') === 'panel-x')).toBe(true);
    // Only the chosen tab is in the tab order; the arrow keys move between the others.
    expect(tabs(el).map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it('chooses a tab when it is pressed', () => {
    const changed = jest.fn();
    const el = mount(<Harness onChange={changed} />);
    act(() => tabs(el)[1].click());
    expect(changed).toHaveBeenCalledWith('b');
    expect(tabs(el)[1].getAttribute('aria-selected')).toBe('true');
  });

  it('moves with the arrow keys, wrapping at the ends, and with Home and End', () => {
    const el = mount(<Harness />);
    press(tabs(el)[0], 'ArrowLeft');
    expect(tabs(el)[2].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs(el)[2]);
    press(tabs(el)[2], 'ArrowRight');
    expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
    press(tabs(el)[0], 'End');
    expect(tabs(el)[2].getAttribute('aria-selected')).toBe('true');
    press(tabs(el)[2], 'Home');
    expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
  });
});

describe('CoopButton', () => {
  it('takes its colours from the design tokens, never a named colour', () => {
    const el = mount(
      <>
        <CoopButton>Approve</CoopButton>
        <CoopButton tone="danger-soft">Reject</CoopButton>
      </>,
    );
    const [approve, reject] = Array.from(el.querySelectorAll('button'));
    expect(approve.getAttribute('style')).toContain('var(--c-success-solid)');
    expect(reject.getAttribute('style')).toContain('var(--c-danger-soft)');
    expect(`${approve.getAttribute('style')}${reject.getAttribute('style')}`).not.toMatch(/#|rgb\(/);
  });
});
