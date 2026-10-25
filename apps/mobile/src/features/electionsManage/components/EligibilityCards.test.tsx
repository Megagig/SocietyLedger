import { render, screen } from '@testing-library/react-native';

import type { MyEligibilityDTO } from '@/types/api/electionsManage';
import { IneligibleNote, RequirementsCard } from './EligibilityCards';

let mockData: MyEligibilityDTO | undefined;
jest.mock('../queries', () => ({ useMyEligibility: () => ({ data: mockData }) }));

const result = (eligible: boolean, reason: string | null = null) => ({ eligible, reason, code: eligible ? 'OK' : 'RULE_NOT_MET' });
const mine = (over: Partial<MyEligibilityDTO> = {}): MyEligibilityDTO => ({
  hasRules: true, vote: result(true), stand: result(true), requirements: { voters: ['Has no overdue charges'], candidates: ['Has been a member for at least 12 months'] }, ...over,
});

describe('with no rules set (the default)', () => {
  it('shows nothing at all, so a member sees what they always have', async () => {
    mockData = mine({ hasRules: false, requirements: { voters: [], candidates: [] } });
    await render(<RequirementsCard electionId={4} focus="vote" />);
    expect(screen.queryByTestId('requirements-4')).toBeNull();
    await render(<IneligibleNote electionId={4} />);
    expect(screen.queryByTestId('ineligible-4')).toBeNull();
  });

  it('and nothing while it loads', async () => {
    mockData = undefined;
    await render(<RequirementsCard electionId={4} focus="vote" />);
    expect(screen.queryByTestId('requirements-4')).toBeNull();
  });
});

describe('with rules set', () => {
  it('lists what the election asks, and tells an eligible member they can vote', async () => {
    mockData = mine();
    await render(<RequirementsCard electionId={4} focus="vote" />);
    expect(screen.getByText('• Has no overdue charges')).toBeTruthy();
    expect(screen.getByText('• Has been a member for at least 12 months')).toBeTruthy();
    expect(screen.getByText('You can vote in this election.')).toBeTruthy();
  });

  it("gives a member who can't the reason in plain words", async () => {
    mockData = mine({ vote: result(false, 'You have ₦5,000.00 overdue. Clear it to vote.') });
    await render(<RequirementsCard electionId={4} focus="vote" />);
    expect(screen.getByText('You have ₦5,000.00 overdue. Clear it to vote.')).toBeTruthy();
    await render(<IneligibleNote electionId={4} />);
    expect(screen.getAllByText('You have ₦5,000.00 overdue. Clear it to vote.').length).toBeGreaterThan(0);
  });

  it('speaks to standing while nominations are open', async () => {
    mockData = mine({ stand: result(false, 'You need to have been a member for at least 12 months to stand; you have been one for 4.') });
    await render(<RequirementsCard electionId={4} focus="stand" />);
    expect(screen.getByText(/to stand; you have been one for 4/)).toBeTruthy();
  });

  it('says nothing about me when the election is in neither stage', async () => {
    mockData = mine();
    await render(<RequirementsCard electionId={4} focus={null} />);
    expect(screen.queryByTestId('my-eligibility-4')).toBeNull();
    expect(screen.getByText('• Has no overdue charges')).toBeTruthy();
  });
});
