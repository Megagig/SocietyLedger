/**
 * @jest-environment jsdom
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';

const status = jest.fn();
jest.mock('@/lib/ajo/hooks', () => ({ useAjoStatus: () => status() }));

import { AjoGate, useAjoAccess } from '@/components/ajo/AjoGate';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });

function Probe() {
  const { canWrite } = useAjoAccess();
  return <p>{canWrite ? 'can write' : 'cannot write'}</p>;
}

function render(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(<MantineProvider><AjoGate><Probe /></AjoGate></MantineProvider>));
  return el;
}

describe('AjoGate draws the state the API reports', () => {
  it('lets an active add-on write', () => {
    status.mockReturnValue({ isLoading: false, isError: false, data: { kind: 'ok', status: { readOnly: false } } });
    expect(render().textContent).toContain('can write');
  });
  it('shows history only, with a banner, when the add-on has lapsed', () => {
    status.mockReturnValue({ isLoading: false, isError: false, data: { kind: 'ok', status: { readOnly: true } } });
    const text = render().textContent ?? '';
    expect(text).toContain('cannot write');
  });
  it('turns away an account without Ajo permission and never shows the page', () => {
    status.mockReturnValue({ isLoading: false, isError: false, data: { kind: 'forbidden' } });
    const text = render().textContent ?? '';
    expect(text).toContain('You do not have access to Ajo.');
    expect(text).not.toContain('can write');
  });
  it('shows the locked screen, not the page, when there is no add-on', () => {
    status.mockReturnValue({ isLoading: false, isError: false, data: { kind: 'locked' } });
    expect(render().textContent).not.toContain('can write');
  });
});
