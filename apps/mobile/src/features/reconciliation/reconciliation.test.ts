import type { SuggestionDTO } from '@/types/api/reconciliation';
import {
  choicesFromMapping,
  confidenceLabel,
  isStatementFile,
  mappingFromChoices,
  NO_COLUMN,
  recommendedKeys,
  statementMime,
  suggestionKey,
  toMatchRequest,
} from './labels';

const suggestion = (over: Partial<SuggestionDTO> = {}): SuggestionDTO => ({
  source: 'entry',
  statementEntryId: 21,
  bankTransferId: null,
  line: { amount: '10000.00', date: '2026-10-05T00:00:00Z', reference: 'S1', description: 'TRF ADA OBI' },
  transactionId: 8,
  charge: { referenceNumber: 'DUE-1', categoryName: 'Dues', memberId: 1, memberNumber: 'M-1', memberName: 'Ada Obi', amount: '10000.00', available: '10000.00', dueDate: null },
  confidence: 100,
  matchType: 'AUTO_REFERENCE',
  reasons: ['Its reference is in the narration'],
  recommended: true,
  ...over,
});

describe('suggestions', () => {
  it('only the confident ones are ticked when the screen opens', () => {
    const list = [suggestion(), suggestion({ statementEntryId: 22, transactionId: 9, confidence: 40, recommended: false })];
    expect(recommendedKeys(list)).toEqual(['entry:21:8']);
  });

  it('a suggestion becomes a match request that carries the line or the declared transfer, never an amount', () => {
    expect(toMatchRequest(suggestion())).toEqual({ transactionId: 8, statementEntryId: 21, confidence: 100, matchType: 'AUTO_REFERENCE' });
    const transfer = suggestion({ source: 'transfer', statementEntryId: null, bankTransferId: 5, matchType: 'AUTO_AMOUNT', confidence: 90 });
    expect(toMatchRequest(transfer)).toEqual({ transactionId: 8, bankTransferId: 5, confidence: 90, matchType: 'AUTO_AMOUNT' });
    expect(suggestionKey(transfer)).toBe('transfer:5:8');
  });

  it('says how sure it is in words', () => {
    expect(confidenceLabel(100)).toBe('Very likely');
    expect(confidenceLabel(60)).toBe('Likely');
    expect(confidenceLabel(40)).toBe('Possible');
  });
});

describe('column choices', () => {
  it('turns the dropdown values back into column positions, leaving out "not in this file"', () => {
    expect(mappingFromChoices({ date: '0', description: '2', credit: '4', debit: NO_COLUMN, reference: '' })).toEqual({ date: 0, description: 2, credit: 4 });
  });

  it('shows a mapping as dropdown values, with "not in this file" for what is missing', () => {
    const choices = choicesFromMapping({ date: 1, credit: 3 });
    expect(choices.date).toBe('1');
    expect(choices.credit).toBe('3');
    expect(choices.debit).toBe(NO_COLUMN);
  });
});

describe('statement files', () => {
  it('accepts CSV and Excel by name, and refuses everything else', () => {
    expect(isStatementFile('GTB-oct.csv')).toBe(true);
    expect(isStatementFile('statement.XLSX')).toBe(true);
    expect(isStatementFile('statement.pdf')).toBe(false);
    expect(isStatementFile('statement.xls')).toBe(false);
  });

  it('sends the right type whatever the phone reported', () => {
    expect(statementMime('a.xlsx')).toContain('spreadsheetml');
    expect(statementMime('a.csv')).toBe('text/csv');
  });
});
