import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { PlatformRole } from '@prisma/client';
import type { StringValue } from 'ms';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Default token expiry
const DEFAULT_TOKEN_EXPIRY: StringValue = '7d';

// F0.3 — short-lived access token issued only when the client sends
// X-Client: mobile; paired with a long-lived refresh token (see
// services/refresh-token.service.ts). Web keeps the 7-day token above.
const MOBILE_ACCESS_TOKEN_EXPIRY: StringValue = (process.env.MOBILE_ACCESS_TOKEN_EXPIRY || '15m') as StringValue;

// Impersonation token expiry (configurable via env)
const IMPERSONATION_TOKEN_EXPIRY: StringValue = (process.env.IMPERSONATION_EXPIRY || '4h') as StringValue;

// Platform admin token expiry — shorter than tenant tokens, configurable
const PLATFORM_TOKEN_EXPIRY: StringValue = (process.env.PLATFORM_TOKEN_EXPIRY || '8h') as StringValue;

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
  options?: { isImpersonation?: boolean; isMobile?: boolean }
): string {
  // Use shorter expiry for impersonation tokens, or for mobile's
  // refresh-token-backed access tokens (F0.3)
  const expiresIn: StringValue = options?.isImpersonation
    ? IMPERSONATION_TOKEN_EXPIRY
    : options?.isMobile
    ? MOBILE_ACCESS_TOKEN_EXPIRY
    : DEFAULT_TOKEN_EXPIRY;

  const signOptions: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

/** F0.3 — the Date a mobile access token issued right now will expire at. */
export function mobileAccessTokenExpiresAt(): Date {
  return new Date(Date.now() + parseExpiryToMs(MOBILE_ACCESS_TOKEN_EXPIRY));
}

function parseExpiryToMs(expiry: StringValue): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiry);
  if (!match) return 15 * 60 * 1000; // fallback: 15 minutes
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unitMs;
}

/** F0.3 — a new opaque 256-bit refresh token (plaintext, given to the client once; never stored). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/** F0.3 — the sha256 of a refresh token, which is what's actually stored/looked up. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generatePlatformToken(payload: TokenPayload): string {
  const signOptions: SignOptions = { expiresIn: PLATFORM_TOKEN_EXPIRY };
  return jwt.sign(payload, JWT_SECRET, signOptions);
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
