import type { Response } from 'express';
import { RuleError } from '../finance/rule-error';

/**
 * A rule the request broke answers with its own status, code and plain message. Anything else is logged and answered with a plain 500:
 * the old controllers sent whatever message the failure carried, which could be a database error.
 */
export function respondWithError(res: Response, error: unknown, fallback = 'Something went wrong. Try again.') {
  if (error instanceof RuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error('Accounting error:', error);
  return res.status(500).json({ success: false, message: fallback });
}
