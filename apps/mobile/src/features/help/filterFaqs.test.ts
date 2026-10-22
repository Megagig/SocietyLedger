import type { FaqCategoryGroupDTO } from '@/types/api/help';
import { filterFaqs } from './filterFaqs';

const faq = (id: number, question: string, answer: string) => ({ id, question, answer, category: 'payments', sortOrder: id });

const groups: FaqCategoryGroupDTO[] = [
  { category: 'payments', items: [faq(1, 'How do I pay my dues?', 'Use the Pay screen.'), faq(2, 'Can I get a receipt?', 'Receipts appear under Payment History.')] },
  { category: 'account', items: [faq(3, 'How do I reset my password?', 'Use Forgot password on the login screen.')] },
];

describe('filterFaqs', () => {
  it('returns everything for an empty or blank search', () => {
    expect(filterFaqs(groups, '')).toBe(groups);
    expect(filterFaqs(groups, '   ')).toBe(groups);
  });

  it('matches the question or the answer, case-insensitively', () => {
    expect(filterFaqs(groups, 'RECEIPT')[0]!.items.map((i) => i.id)).toEqual([2]);
    expect(filterFaqs(groups, 'forgot')[0]!.items.map((i) => i.id)).toEqual([3]);
  });

  it('needs every typed word to match, in any order', () => {
    expect(filterFaqs(groups, 'password reset')[0]!.items.map((i) => i.id)).toEqual([3]);
    expect(filterFaqs(groups, 'password receipt')).toEqual([]);
  });

  it('drops categories that end up empty', () => {
    expect(filterFaqs(groups, 'dues').map((g) => g.category)).toEqual(['payments']);
  });
});
