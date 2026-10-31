/**
 * @jest-environment jsdom
 *
 * The Ajo report screens (T10): money in full, a figure that does not apply shown as a dash, the filters turned into a query the API
 * understands, and what the report page draws for an open report, a locked one and an empty one. The figures themselves come from the API;
 * nothing here works one out.
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import type { ReportListItem, ReportResult } from '@/lib/ajo/reportTypes';

const mockList = jest.fn();
const mockReport = jest.fn();
const mockDownload = jest.fn();
const mockPeople = jest.fn((_id: number) => ({ data: [] }));
const mockCollectors = jest.fn((_enabled?: boolean) => ({ data: [] }));
const mockCan = jest.fn(() => ({ manage: true, anyOfficer: true }));
jest.mock('next/navigation', () => ({ useParams: () => ({ name: 'contributions' }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
jest.mock('@/lib/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/ajo/staffHooks', () => ({
  useGroups: () => ({ data: [{ id: 4, name: 'Market circle' }] }),
  usePeople: (id: number) => mockPeople(id),
  useCollectorCandidates: (enabled?: boolean) => mockCollectors(enabled),
}));
jest.mock('@/lib/ajo/useAjoCan', () => ({ useAjoCan: () => mockCan() }));
jest.mock('@/lib/ajo/reportHooks', () => ({
  ...jest.requireActual('@/lib/ajo/reportHooks'),
  useReportList: () => mockList(),
  useReport: (...a: unknown[]) => mockReport(...a),
  downloadReport: (...a: unknown[]) => mockDownload(...a),
}));

import { formatCell, formatMetric } from '@/components/ajo/reports/ReportParts';
import { readBlobError, reportQuery } from '@/lib/ajo/reportHooks';
import AjoReportPage from '@/app/dashboard/ajo/reports/[name]/page';
import AjoReportsPage from '@/app/dashboard/ajo/reports/page';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
// Mantine's select measures itself; jsdom has no ResizeObserver.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const item = (over: Partial<ReportListItem> = {}): ReportListItem => ({
  name: 'contributions', title: 'Contributions', description: 'What was expected and paid.', rule: 'Paid counts confirmed money only.', tier: 'BASIC', tierLabel: 'Basic reports',
  filters: { member: true, collector: true }, lock: null, ...over,
});
const result = (over: Partial<ReportResult> = {}): ReportResult => ({
  name: 'contributions', title: 'Contributions', rule: 'Paid counts confirmed money only.',
  filters: { groupId: null, from: '2027-03-01', to: '2027-03-31', membershipId: null, collectorUserId: null },
  generatedAt: '2027-03-10T10:00:00.000Z', notes: [],
  blocks: [{ groupId: 4, groupName: 'Market circle', model: 'ROTATING_POT', timezone: 'Africa/Lagos', metrics: [
    { key: 'expectedKobo', label: 'Expected', kind: 'money', value: '4500000' },
    { key: 'collectionBps', label: 'Collected', kind: 'percent', value: 1111 },
    { key: 'instalments', label: 'Instalments', kind: 'int', value: 9 },
    { key: 'none', label: 'Not applicable', kind: 'percent', value: null },
  ] }],
  totals: [],
  columns: [{ key: 'member', label: 'Member', kind: 'text' }, { key: 'dueDate', label: 'Due date', kind: 'date' }, { key: 'toPayKobo', label: 'Still to pay', kind: 'money' }],
  rows: [{ member: 'Adaeze Okafor', dueDate: '2027-03-01', toPayKobo: '500000' }],
  page: { page: 1, pageSize: 25, total: 1 },
  ...over,
});

const roots: Array<ReturnType<typeof createRoot>> = [];
function render(node: React.ReactNode): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  roots.push(root);
  act(() => root.render(<MantineProvider>{node}</MantineProvider>));
  return el;
}
const ok = <T,>(data: T) => ({ isLoading: false, isError: false, isFetching: false, data, refetch: jest.fn() });

// Mantine's popover finishes some positioning work a moment later; let it, then take the page down, so nothing runs after the test.
afterEach(async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  act(() => { roots.splice(0).forEach((root) => root.unmount()); });
  document.body.innerHTML = '';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockReturnValue(ok([item()]));
  mockReport.mockReturnValue(ok(result()));
  mockCan.mockReturnValue({ manage: true, anyOfficer: true });
});

describe('how a figure is written', () => {
  it('writes money in full, never abbreviated, and a percentage from basis points', () => {
    expect(formatMetric({ key: 'a', label: 'A', kind: 'money', value: '4500000' })).toBe('₦45,000.00');
    expect(formatMetric({ key: 'a', label: 'A', kind: 'percent', value: 1111 })).toBe('11.1%');
    expect(formatMetric({ key: 'a', label: 'A', kind: 'int', value: 1234 })).toBe('1,234');
    expect(formatMetric({ key: 'a', label: 'A', kind: 'money', value: '4500000' })).not.toMatch(/\dk\b|\dm\b/i);
  });
  it('shows a dash for a figure that does not apply, never a zero', () => {
    expect(formatMetric({ key: 'a', label: 'A', kind: 'percent', value: null })).toBe('—');
  });
  it('writes each kind of table cell, and leaves an empty one empty', () => {
    expect(formatCell({ key: 'k', label: 'K', kind: 'money' }, '1000000')).toBe('₦10,000.00');
    expect(formatCell({ key: 'k', label: 'K', kind: 'date' }, '2027-03-01')).toBe('1 Mar 2027');
    expect(formatCell({ key: 'k', label: 'K', kind: 'int' }, 12)).toBe('12');
    expect(formatCell({ key: 'k', label: 'K', kind: 'text' }, 'Ada')).toBe('Ada');
    expect(formatCell({ key: 'k', label: 'K', kind: 'text' }, null)).toBe('');
  });
});

describe('the query the API receives', () => {
  it('leaves out every empty filter so the API\'s own default (the running month, every circle) applies', () => {
    expect(reportQuery({})).toBe('');
    expect(reportQuery({ groupId: null, from: '', membershipId: null })).toBe('');
  });
  it('sends what was chosen, and any extras such as the page', () => {
    const q = new URLSearchParams(reportQuery({ groupId: 4, from: '2027-03-01', to: '2027-03-31', membershipId: 9, collectorUserId: 7 }, { page: 2, pageSize: 25 }));
    expect(Object.fromEntries(q)).toEqual({ groupId: '4', from: '2027-03-01', to: '2027-03-31', membershipId: '9', collectorUserId: '7', page: '2', pageSize: '25' });
  });
});

describe('the reports hub', () => {
  it('lists every report, and explains a locked one instead of hiding it or linking to it', () => {
    mockList.mockReturnValue(ok([item(), item({ name: 'audit', title: 'Audit and activity', tier: 'AUDIT', tierLabel: 'Audit reports', lock: { kind: 'TIER', message: 'Audit reports are not part of your Ajo tier. Upgrade the tier to use this report.' } })]));
    const el = render(<AjoReportsPage />);
    expect(el.textContent).toContain('Contributions');
    expect(el.textContent).toContain('Audit and activity');
    expect(el.textContent).toContain('Upgrade the tier to use this report.');
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/dashboard/ajo/reports/contributions');
    expect(links).not.toContain('/dashboard/ajo/reports/audit');
  });
});

describe('the report page', () => {
  it('prints the counting rule under the title, then the figures in full, and the rows', () => {
    const text = render(<AjoReportPage />).textContent ?? '';
    expect(text).toContain('How this is counted.');
    expect(text).toContain('Paid counts confirmed money only.');
    expect(text).toContain('Market circle');
    expect(text).toContain('₦45,000.00');
    expect(text).toContain('11.1%');
    expect(text).toContain('—'); // the figure that does not apply
    expect(text).toContain('Adaeze Okafor');
    expect(text).toContain('1 Mar 2027');
    expect(text).toContain('₦5,000.00');
    expect(text).toContain('Rows 1 to 1 of 1');
  });

  it('asks for the running month by default, and for page one', () => {
    render(<AjoReportPage />);
    expect(mockReport).toHaveBeenCalledWith('contributions', {}, 1, true);
  });

  it('downloads the file the API makes, with the filters in force', async () => {
    mockDownload.mockResolvedValue(undefined);
    const el = render(<AjoReportPage />);
    const csv = [...el.querySelectorAll('button')].find((b) => b.textContent === 'CSV')!;
    await act(async () => { csv.click(); });
    expect(mockDownload).toHaveBeenCalledWith('contributions', {}, 'csv');
    const pdf = [...el.querySelectorAll('button')].find((b) => b.textContent === 'PDF')!;
    await act(async () => { pdf.click(); });
    expect(mockDownload).toHaveBeenCalledWith('contributions', {}, 'pdf');
  });

  it('adds nothing together across circles of different kinds, and says how many circles a total adds', () => {
    mockReport.mockReturnValue(ok(result({ totals: [{ label: 'All rotating pots', circles: 2, metrics: [{ key: 'expectedKobo', label: 'Expected', kind: 'money', value: '9000000' }] }] })));
    const text = render(<AjoReportPage />).textContent ?? '';
    expect(text).toContain('All rotating pots');
    expect(text).toContain('2 circles added together');
    expect(text).toContain('₦90,000.00');
  });

  it('shows why a locked report is locked, with no filters, no figures and no download', () => {
    mockList.mockReturnValue(ok([item({ lock: { kind: 'TIER', message: 'Advanced reports are not part of your Ajo tier. Upgrade the tier to use this report.' } })]));
    const el = render(<AjoReportPage />);
    expect(el.textContent).toContain('Upgrade the tier to use this report.');
    expect(el.textContent).not.toContain('How this is counted.');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent === 'CSV')).toBe(false);
    expect(mockReport.mock.calls.every((c) => c[3] === false)).toBe(true); // it never asked the API for the report
  });

  it('says so plainly when there is nothing to show, and still lets the figures stand', () => {
    mockReport.mockReturnValue(ok(result({ rows: [], page: { page: 1, pageSize: 25, total: 0 } })));
    const text = render(<AjoReportPage />).textContent ?? '';
    expect(text).toContain('Nothing to show for these dates.');
    expect(text).toContain('₦45,000.00');
  });

  it('tells the person when the API refuses, with a way to try again', () => {
    mockReport.mockReturnValue({ isLoading: false, isError: true, isFetching: false, data: undefined, error: { response: { status: 400, data: { message: 'Pick a range of 12 months or less.' } } }, refetch: jest.fn() });
    const el = render(<AjoReportPage />);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Pick a range of 12 months or less.');
  });
});

describe('what the page asks for', () => {
  it('asks for the people and collector lists only when the person may see them, so a collector is not sent a refused request', () => {
    mockCan.mockReturnValue({ manage: false, anyOfficer: false });
    render(<AjoReportPage />);
    expect(mockCollectors).toHaveBeenCalledWith(false);
    expect(mockPeople.mock.calls.every((c) => c[0] === 0)).toBe(true);
  });
  it('asks for the collector list for someone who manages', () => {
    render(<AjoReportPage />);
    expect(mockCollectors).toHaveBeenCalledWith(true);
  });
  it('says so, and dims the figures, while the new choice is loading, so old numbers are not read as the new ones', () => {
    mockReport.mockReturnValue({ ...ok(result()), isPlaceholderData: true, isFetching: true });
    const el = render(<AjoReportPage />);
    expect(el.textContent).toContain('Updating for your new choice');
    expect(el.querySelector('.opacity-50')).not.toBeNull();
  });
  it('shows no such notice once the figures are the ones asked for', () => {
    const el = render(<AjoReportPage />);
    expect(el.textContent).not.toContain('Updating for your new choice');
    expect(el.querySelector('.opacity-50')).toBeNull();
  });
});

describe('a refused download', () => {
  it('puts the explanation from the API, which arrived as a blob, back into the error so the screen can show it', async () => {
    const body = JSON.stringify({ success: false, code: 'REPORT_TOO_LARGE_FOR_PDF', message: 'A PDF holds up to 5,000 rows. Download the CSV instead.' });
    const error = { response: { status: 400, data: new Blob([body], { type: 'application/json' }) } };
    await readBlobError(error);
    expect((error.response.data as unknown as { message: string }).message).toBe('A PDF holds up to 5,000 rows. Download the CSV instead.');
  });
  it('leaves an error alone when its body is not a blob or not JSON', async () => {
    const plain = { response: { data: { message: 'x' } } };
    await readBlobError(plain);
    expect(plain.response.data).toEqual({ message: 'x' });
    const html = { response: { data: new Blob(['<html>'], { type: 'text/html' }) } };
    await readBlobError(html);
    expect(html.response.data).toBeInstanceOf(Blob);
    await expect(readBlobError(null)).resolves.toBeNull();
  });
});
