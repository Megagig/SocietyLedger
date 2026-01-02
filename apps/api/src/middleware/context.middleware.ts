/**
 * Context Detection Middleware
 * 
 * Phase 22: Hybrid Super Admin Architecture
 * 
 * This middleware detects and attaches execution context to requests.
 * 
 * IMPORTANT: This middleware is:
 * - ADDITIVE: Layers on top of existing middleware
 * - NON-BLOCKING: Errors don't stop the request
 * - READ-ONLY: Only attaches context, doesn't enforce rules
 * 
 * Enforcement is handled by existing RBAC middleware.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ContextService } from '../services/context.service';
import { ExecutionContext } from '../types/context.types';

/**
 * Extended request interface with execution context
 */
export interface ContextAwareRequest extends AuthRequest {
  /** Execution context determined by the context middleware */
  executionContext?: ExecutionContext;
}

/**
 * Context Detection Middleware
 * 
 * Attaches execution context information to the request for use by
 * downstream handlers. This enables context-aware logging, auditing,
 * and decision-making without modifying existing behavior.
 * 
 * @param req - The request object
 * @param res - The response object
 * @param next - The next middleware function
 */
export async function contextMiddleware(
  req: ContextAwareRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Only process if user is authenticated
    if (req.user) {
      // Determine and attach execution context
      req.executionContext = ContextService.determineContext(req);
      
      // Log context for debugging (controlled by environment variable)
      if (process.env.LOG_CONTEXT === 'true') {
        console.log(`[Context] ${ContextService.describeContext(req)}`);
      }
    }
    
    next();
  } catch (error) {
    // Non-blocking - log error but continue
    // This ensures context detection failures don't break the application
    console.error('[Context Middleware] Error determining context:', error);
    next();
  }
}

/**
 * Helper to get execution context from request
 * 
 * @param req - The request object
 * @returns ExecutionContext or undefined if not available
 */
export function getExecutionContext(req: ContextAwareRequest): ExecutionContext | undefined {
  return req.executionContext;
}

/**
 * Helper to check if request has execution context
 * 
 * @param req - The request object
 * @returns true if execution context is available
 */
export function hasExecutionContext(req: ContextAwareRequest): boolean {
  return req.executionContext !== undefined;
}
