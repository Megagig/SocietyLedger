import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({
    color: { primary: '#0B5C53', textInverse: '#FFFFFF', textSecondary: '#5E706C', textTertiary: '#8A9A96', danger: '#B42318' },
  }),
}));

const refusal = (init: Partial<ConstructorParameters<typeof ApiError>[0]>) => new ApiError({ status: 403, message: 'raw', ...init });

describe('ErrorState: a refusal is not a failure to load', () => {
  it('says a module is not part of the plan, by name, instead of "We couldn\'t load this"', async () => {
    await render(<ErrorState error={refusal({ accessKind: 'plan', module: 'meetings' })} onRetry={() => {}} />);
    expect(screen.getByText("Meetings isn't part of your association's plan")).toBeTruthy();
    expect(screen.getByText(/administrator can add it from the Subscription page on the website/)).toBeTruthy();
    expect(screen.queryByText("We couldn't load this.")).toBeNull();
  });

  it('says the role does not include it, and names who to ask', async () => {
    await render(<ErrorState error={refusal({ accessKind: 'permission' })} onRetry={() => {}} />);
    expect(screen.getByText("You don't have access to this")).toBeTruthy();
    expect(screen.getByText(/ask your association administrator/)).toBeTruthy();
    // trying again cannot change someone's role, so no button is offered
    expect(screen.queryByText('Try again')).toBeNull();
    expect(screen.queryByText('Check again')).toBeNull();
  });

  it('offers "Check again" (never a purchase) where an administrator can fix it', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState error={refusal({ accessKind: 'subscription' })} onRetry={onRetry} />);
    expect(screen.getByText("Your association's subscription has ended")).toBeTruthy();
    fireEvent.press(screen.getByText('Check again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/₦|\$|pay now|buy|upgrade now/i)).toBeNull();
  });

  it('ignores the screen\'s own "could not load" title when the real reason is access', async () => {
    await render(<ErrorState title="We couldn't load the receipt." error={refusal({ accessKind: 'permission' })} />);
    expect(screen.getByText("You don't have access to this")).toBeTruthy();
    expect(screen.queryByText("We couldn't load the receipt.")).toBeNull();
  });
});

describe('ErrorState: everything else is unchanged', () => {
  it('keeps the generic message for an ordinary server failure', async () => {
    await render(<ErrorState error={new ApiError({ status: 500, message: 'boom' })} onRetry={() => {}} />);
    expect(screen.getByText("We couldn't load this.")).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('keeps the offline message when there is no connection', async () => {
    await render(<ErrorState error={new ApiError({ status: 0, message: 'offline', isNetwork: true })} />);
    expect(screen.getByText("Can't reach the server.")).toBeTruthy();
  });

  it('keeps a business rule\'s own words: a 403 that is not an access problem is not turned into one', async () => {
    await render(<ErrorState title="This is your own loan." error={refusal({ code: 'OWN_REQUEST', message: 'This is your own request' })} />);
    expect(screen.getByText('This is your own loan.')).toBeTruthy();
  });
});
