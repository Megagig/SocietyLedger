import { electionsManageApi } from './electionsManage';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const BASE = '/voting';

beforeEach(() => jest.clearAllMocks());

describe('elections', () => {
  it('creates, changes (PUT) and deletes an election', async () => {
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await electionsManageApi.createElection({ title: 'AGM', electionType: 'GENERAL', votingStartDate: 'a', votingEndDate: 'b', allowAbstention: true, isAnonymous: true, requiresQuorum: false });
    await electionsManageApi.updateElection(4, { title: 'AGM 2' });
    await electionsManageApi.deleteElection(4);
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/elections`, expect.objectContaining({ title: 'AGM' }));
    expect(mockPut).toHaveBeenCalledWith(`${BASE}/elections/4`, { title: 'AGM 2' });
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/elections/4`);
  });

  it('takes each step of the election on its own endpoint', async () => {
    mockPost.mockReturnValue(ok({}));
    await electionsManageApi.startNominations(4);
    await electionsManageApi.closeNominations(4);
    await electionsManageApi.startVoting(4);
    await electionsManageApi.closeVoting(4);
    await electionsManageApi.publishResults(4);
    expect(mockPost.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/elections/4/start-nominations`,
      `${BASE}/elections/4/close-nominations`,
      `${BASE}/elections/4/start-voting`,
      `${BASE}/elections/4/close-voting`,
      `${BASE}/elections/4/publish-results`,
    ]);
  });

  it('cancels with a reason, and reads the results', async () => {
    mockPost.mockReturnValue(ok({}));
    mockGet.mockReturnValue(ok({}));
    await electionsManageApi.cancelElection(4, 'Venue unavailable');
    await electionsManageApi.getResults(4);
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/elections/4/cancel`, { reason: 'Venue unavailable' });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/elections/4/results`);
  });
});

describe('positions and candidates', () => {
  it('adds, changes and removes a position', async () => {
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await electionsManageApi.addPosition(4, { title: 'President' });
    await electionsManageApi.updatePosition(9, { title: 'Chair' });
    await electionsManageApi.deletePosition(9);
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/elections/4/positions`, { title: 'President' });
    expect(mockPut).toHaveBeenCalledWith(`${BASE}/positions/9`, { title: 'Chair' });
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/positions/9`);
  });

  it('searches members through the voting module, registers a candidate and decides a nomination', async () => {
    mockGet.mockReturnValue(ok([]));
    mockPost.mockReturnValue(ok({}));
    await electionsManageApi.searchMembers('ada');
    await electionsManageApi.registerCandidate(4, { memberId: 3, positionId: 9 });
    await electionsManageApi.decideCandidate(7, { status: 'REJECTED', rejectionReason: 'Not a member for a year' });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/candidate-members`, { params: { search: 'ada', limit: 20 } });
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/elections/4/candidates`, { memberId: 3, positionId: 9 });
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/candidates/7/approve`, { status: 'REJECTED', rejectionReason: 'Not a member for a year' });
  });
});

describe('who can vote and who can stand', () => {
  it('asks whether I can vote or stand, and reads the rules and exceptions of an election', async () => {
    mockGet.mockReturnValue(ok({}));
    await electionsManageApi.getMyEligibility(4);
    await electionsManageApi.getElectionEligibility(4);
    expect(mockGet).toHaveBeenNthCalledWith(1, `${BASE}/elections/4/my-eligibility`);
    expect(mockGet).toHaveBeenNthCalledWith(2, `${BASE}/elections/4/eligibility`);
  });

  it('saves the rules of an election (null clears them), and adds and removes an exception', async () => {
    mockPut.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await electionsManageApi.setElectionEligibility(4, { voters: { minMembershipMonths: 6 } });
    await electionsManageApi.setElectionEligibility(4, null);
    await electionsManageApi.addEligibilityException(4, { memberId: 3, scope: 'VOTE', kind: 'ALLOW', reason: 'One day short' });
    await electionsManageApi.removeEligibilityException(9);
    expect(mockPut).toHaveBeenNthCalledWith(1, `${BASE}/elections/4/eligibility`, { rules: { voters: { minMembershipMonths: 6 } } });
    expect(mockPut).toHaveBeenNthCalledWith(2, `${BASE}/elections/4/eligibility`, { rules: null });
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/elections/4/eligibility/exceptions`, { memberId: 3, scope: 'VOTE', kind: 'ALLOW', reason: 'One day short' });
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/eligibility/exceptions/9`);
  });

  it("previews a rule, and reads and saves the association's template and the options", async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    await electionsManageApi.previewEligibility({ voters: { categories: ['regular'] } });
    await electionsManageApi.getEligibilityTemplate();
    await electionsManageApi.setEligibilityTemplate(null);
    await electionsManageApi.getEligibilityOptions();
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/eligibility/preview`, { rules: { voters: { categories: ['regular'] } } });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/eligibility/template`);
    expect(mockPut).toHaveBeenCalledWith(`${BASE}/eligibility/template`, { rules: null });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/eligibility/options`);
  });
});

describe('polls', () => {
  it('creates, changes and deletes a poll, and takes its steps', async () => {
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await electionsManageApi.createPoll({ title: 'Day?', pollType: 'SINGLE_CHOICE', startDate: 'a', endDate: 'b', allowMultipleVotes: false, isAnonymous: true, showResultsBeforeEnd: false, options: [{ optionText: 'Sat' }, { optionText: 'Sun' }] });
    await electionsManageApi.updatePoll(5, { title: 'Day to meet?' });
    await electionsManageApi.startPoll(5);
    await electionsManageApi.closePoll(5);
    await electionsManageApi.cancelPoll(5);
    await electionsManageApi.deletePoll(5);
    expect(mockPut).toHaveBeenCalledWith(`${BASE}/polls/5`, { title: 'Day to meet?' });
    expect(mockPost.mock.calls.map((c) => c[0])).toEqual([`${BASE}/polls`, `${BASE}/polls/5/start`, `${BASE}/polls/5/close`, `${BASE}/polls/5/cancel`]);
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/polls/5`);
  });

  it('adds and removes an answer, and reads the results', async () => {
    mockPost.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    mockGet.mockReturnValue(ok({}));
    await electionsManageApi.addPollOption(5, { optionText: 'Friday' });
    await electionsManageApi.deletePollOption(12);
    await electionsManageApi.getPollResults(5);
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/polls/5/options`, { optionText: 'Friday' });
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/options/12`);
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/polls/5/results`);
  });
});
