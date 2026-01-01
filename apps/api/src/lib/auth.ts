import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PlatformRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Default token expiry
const DEFAULT_TOKEN_EXPIRY = '7d';

// Impersonation token expiry (configurable via env)
const IMPERSONATION_TOKEN_EXPIRY = process.env.IMPERSONATION_EXPIRY || '4h';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Token Payload Interface
 * 
 * Phase 22: Extended with impersonation tracking fields.
 * All new fields are optional for backward compatibility.
 */
export interface TokenPayload {
  id: number;
  email: string;
  role: string;
  associationId?: number | null;
  platformRole?: PlatformRole;
  memberId?: number;
  
  // ============================================
  // Phase 22: Impersonation tracking fields
  // ============================================
  
  /** Whether this token represents an impersonation session */
  isImpersonating?: boolean;
  
  /** Original association ID (home association) during impersonation */
  originalAssociationId?: number;
  
  /** Unix timestamp when impersonation started */
  impersonationTimestamp?: number;
}

/**
 * Generate a JWT token
 * 
 * @param payload - Token payload
 * @param options - Optional settings (e.g., for impersonation tokens)
 */
export function generateToken(
  payload: TokenPayload, 
  options?: { isImpersonation?: boolean }
): string {
  // Use shorter expiry for impersonation tokens
  const expiresIn = options?.isImpersonation 
    ? IMPERSONATION_TOKEN_EXPIRY 
    : DEFAULT_TOKEN_EXPIRY;
    
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a token payload indicates an impersonation session
 */
export function isImpersonationToken(payload: TokenPayload): boolean {
  return payload.isImpersonating === true && 
         payload.originalAssociationId !== undefined;
}
