import { fireEvent, render, screen } from '@testing-library/react-native';

import { RequestCard, type RequestLike } from './RequestCard';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/ui/ImageViewerModal', () => ({ ImageViewerModal: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const request = (over: Partial<RequestLike> = {}): RequestLike => ({
  id: 5, memberId: 3, memberName: 'Ada Obi', memberNumber: 'M-003', amount: '25000', paymentDate: '2026-10-20T00:00:00.000Z',
  reference: 'TRF123', memberNote: 'Paid at the bank', hasReceipt: true, status: 'PENDING', rejectionReason: null, ...over,
});

const render_ = async (over: Partial<RequestLike> = {}, props: { ownMemberId?: number; canDecide?: boolean } = {}) => {
  const onApprove = jest.fn();
  const onReject = jest.fn();
  const loadReceipt = jest.fn(async () => ({ url: 'https://x/y.jpg', mimeType: 'image/jpeg' }));
  const utils = await render(
    <RequestCard
      request={request(over)}
      context="Account SAV-001"
      ownMemberId={props.ownMemberId}
      canDecide={props.canDecide ?? true}
      loadReceipt={loadReceipt}
      onApprove={onApprove}
      onReject={onReject}
    />,
  );
  return { ...utils, onApprove, onReject, loadReceipt };
};

describe('RequestCard', () => {
  it('shows who paid what, the reference and note, and lets another officer approve or reject', async () => {
    const { onApprove, onReject } = await render_();
    await screen.findByText('Ada Obi');
    expect(screen.getByText('M-003 · Account SAV-001')).toBeTruthy();
    expect(screen.getByText(/Ref TRF123/)).toBeTruthy();
    expect(screen.getByText("Member's note: Paid at the bank")).toBeTruthy();
    await fireEvent.press(screen.getByTestId('request-approve-5'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('request-reject-5'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('an officer\'s own request can\'t be decided by them: no buttons, and it says why', async () => {
    await render_({}, { ownMemberId: 3 });
    await screen.findByTestId('request-own-5');
    expect(screen.queryByTestId('request-approve-5')).toBeNull();
    expect(screen.queryByTestId('request-reject-5')).toBeNull();
    expect(screen.getByText('This is your own request, so another officer needs to decide it.')).toBeTruthy();
  });

  it('an officer who may not decide sees the request but no buttons', async () => {
    await render_({}, { canDecide: false });
    await screen.findByText('Ada Obi');
    expect(screen.queryByTestId('request-approve-5')).toBeNull();
  });

  it('a decided request has no buttons, and a rejected one shows the reason', async () => {
    await render_({ status: 'REJECTED', rejectionReason: 'Receipt unclear' });
    await screen.findByText('Reason: Receipt unclear');
    expect(screen.queryByTestId('request-approve-5')).toBeNull();
    expect(screen.getByText('Not approved')).toBeTruthy();
  });

  it('opens the receipt when asked, and only offers it when there is one', async () => {
    const { loadReceipt } = await render_();
    await fireEvent.press(screen.getByTestId('request-receipt-5'));
    expect(loadReceipt).toHaveBeenCalledWith(5);
  });

  it('with no receipt there is nothing to open', async () => {
    await render_({ hasReceipt: false });
    await screen.findByText('Ada Obi');
    expect(screen.queryByTestId('request-receipt-5')).toBeNull();
  });
});
