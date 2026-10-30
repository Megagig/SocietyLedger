import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import type { ReportCircle, ReportColumn, ReportTotals } from '@/types/api/ajoReports';
import { ReportFigures, ReportRowCard } from './ReportParts';

// BoardParts draws icons, which this test setup cannot render (see jest.config.js); the card around the figures is not what is tested here.
jest.mock('../board/BoardParts', () => {
  const { View: V, Text: T } = jest.requireActual('react-native');
  return { BoardCard: ({ title, children }: { title?: string; children: React.ReactNode }) => <V><T>{title}</T>{children}</V> };
});

const block = (groupId: number, name: string, model: ReportCircle['model']): ReportCircle => ({
  groupId, groupName: name, model, timezone: 'Africa/Lagos',
  metrics: [
    { key: 'expectedKobo', label: 'Expected', kind: 'money', value: '4500000', hint: 'Due in these dates' },
    { key: 'collectionBps', label: 'Collected', kind: 'percent', value: null },
    { key: 'instalments', label: 'Instalments', kind: 'int', value: 9 },
  ],
});

describe('ReportFigures', () => {
  it('shows each circle\'s figures in full, a dash where a figure does not apply, and the hint under a figure', async () => {
    await render(<ReportFigures blocks={[block(1, 'Market circle', 'ROTATING_POT')]} totals={[]} />);
    expect(screen.getByText('Market circle · Rotating pot')).toBeTruthy();
    expect(screen.getByText('₦45,000.00')).toBeTruthy();
    expect(screen.getByText('Due in these dates')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });

  it('shows a total for circles of the same kind and says how many it adds', async () => {
    const totals: ReportTotals[] = [{ label: 'All rotating pots', circles: 2, metrics: [{ key: 'expectedKobo', label: 'Expected', kind: 'money', value: '9000000' }] }];
    await render(<ReportFigures blocks={[block(1, 'A', 'ROTATING_POT'), block(2, 'B', 'ROTATING_POT')]} totals={totals} />);
    expect(screen.getByText('All rotating pots')).toBeTruthy();
    expect(screen.getByText('2 circles added together')).toBeTruthy();
    expect(screen.getByText('₦90,000.00')).toBeTruthy();
  });
});

describe('ReportRowCard', () => {
  const columns: ReportColumn[] = [
    { key: 'circle', label: 'Circle', kind: 'text' },
    { key: 'member', label: 'Member', kind: 'text' },
    { key: 'dueDate', label: 'Due date', kind: 'date' },
    { key: 'toPayKobo', label: 'Still to pay', kind: 'money' },
    { key: 'reason', label: 'Reason', kind: 'text' },
  ];
  const row = { circle: 'Market circle', member: 'Adaeze Okafor', dueDate: '2027-03-01', toPayKobo: '500000', reason: null };

  it('keeps every column that has something to say', async () => {
    await render(<View><ReportRowCard columns={columns} row={row} timeZone="Africa/Lagos" showCircle={false} /></View>);
    expect(screen.getByText('Adaeze Okafor')).toBeTruthy();
    expect(screen.getByText('Due date')).toBeTruthy();
    expect(screen.getByText('1 Mar 2027')).toBeTruthy();
    expect(screen.getByText('Still to pay')).toBeTruthy();
    expect(screen.getByText('₦5,000.00')).toBeTruthy();
    expect(screen.queryByText('Reason')).toBeNull(); // empty, so not drawn
  });

  it('names the circle only when more than one is shown', async () => {
    const { rerender } = await render(<ReportRowCard columns={columns} row={row} timeZone="Africa/Lagos" showCircle={false} />);
    expect(screen.queryByText('Market circle')).toBeNull();
    await rerender(<ReportRowCard columns={columns} row={row} timeZone="Africa/Lagos" showCircle />);
    expect(screen.getByText('Market circle')).toBeTruthy();
  });
});
