jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/lib/openrouter', () => ({ __esModule: true, default: { isConfigured: () => true, chat: jest.fn() } }));
jest.mock('../../src/modules/ai/tools/rate-limiter', () => ({ aiRateLimiter: { checkLimit: jest.fn() } }));
jest.mock('../../src/modules/ai/tools/safety-guards', () => ({ validateAIOutput: (s: string) => s }));

import { parseSuggestionJson } from '../../src/modules/support/ai-support.service';

describe('parseSuggestionJson', () => {
  it('reads clean JSON, including inside prose or fences', () => {
    expect(parseSuggestionJson('Here you go:\n```json\n{"suggestion":"Hello","tone":"friendly"}\n```')?.suggestion).toBe('Hello');
  });

  it('recovers the suggestion from JSON cut off at the token cap', () => {
    expect(parseSuggestionJson('{"suggestion": "Thanks for reaching out.\nWe will look into it', )?.suggestion).toBe(
      'Thanks for reaching out.\nWe will look into it'
    );
  });

  it('falls back to plain text, and rejects empty or broken-object output', () => {
    expect(parseSuggestionJson('Thanks, we are on it.')?.suggestion).toBe('Thanks, we are on it.');
    expect(parseSuggestionJson('')).toBeNull();
    expect(parseSuggestionJson('{ "confidence": 0.8')).toBeNull();
  });
});
