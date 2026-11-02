/**
 * @jest-environment jsdom
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { ChargeName } from '@/components/finance/ChargeName';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: JSX.Element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => createRoot(host).render(node));
  return host;
}

describe('ChargeName', () => {
  it('shows the category with the real campaign, due or cause under it', () => {
    const host = render(<ChargeName name="wedding Levy" purpose="Levy For Emma Wedding" />);
    expect(host.textContent).toBe('wedding LevyLevy For Emma Wedding');
    expect(host.querySelector('[data-testid="charge-purpose"]')?.textContent).toBe('Levy For Emma Wedding');
  });

  it('shows only the category when there is nothing more specific, with no empty line', () => {
    const host = render(<ChargeName name="Annual dues" purpose={null} />);
    expect(host.textContent).toBe('Annual dues');
    expect(host.querySelector('[data-testid="charge-purpose"]')).toBeNull();
  });
});
