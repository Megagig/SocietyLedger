// ============================================
// PHASE 17: AI SAFETY GUARDS
// Validate all AI outputs before returning to users
// ============================================

import { SafetyCheckResult } from '../ai.types';

// ============================================
// FORBIDDEN PATTERNS
// ============================================

/**
 * Patterns that indicate unsafe AI output
 */
const FORBIDDEN_PATTERNS = [
  // SQL injection attempts
  /\$queryRaw/i,
  /\$executeRaw/i,
  /prisma\.\$query/i,
  
  // Database modification keywords
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bDROP\s+(TABLE|DATABASE|INDEX)\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+(TABLE|DATABASE|INDEX)\b/i,
  
  // Dangerous operations
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /require\s*\(\s*['"`]/i,
  /import\s*\(\s*['"`]/i,
  
  // File system operations
  /fs\.(write|unlink|rm|mkdir)/i,
  /child_process/i,
  
  // Environment/secrets access
  /process\.env\./i,
  /\.env\b/i,
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /password\s*[:=]/i,
];

/**
 * Patterns that suggest AI is trying to calculate money
 * (AI should only explain pre-calculated data)
 */
const CALCULATION_PATTERNS = [
  // Direct calculation suggestions
  /let me calculate/i,
  /I('ll| will) calculate/i,
  /calculating the/i,
  /the calculation (is|shows|gives)/i,
  
  // Mathematical operations on money
  /\d+\s*[\+\-\*\/]\s*\d+\s*=\s*₦?\d/i,
  /sum of.*equals/i,
  /total.*comes to/i,
  
  // Balance modifications
  /new balance.*will be/i,
  /balance.*after.*is/i,
  /updating.*balance/i,
  /modify.*amount/i,
];

/**
 * Patterns that suggest cross-tenant data access
 */
const CROSS_TENANT_PATTERNS = [
  /all associations/i,
  /other (associations?|tenants?|organizations?)/i,
  /across (all )?(associations?|tenants?)/i,
  /different association/i,
  /another organization/i,
];

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export interface AIContext {
  type: string;
  associationId: number;
}

/**
 * Validate AI output for safety
 * @throws Error if output is unsafe
 */
export function validateAIOutput(output: string, context: AIContext): string {
  const result = checkAIOutputSafety(output, context);
  
  if (!result.isSafe) {
    console.error('AI Safety Violation:', {
      context,
      violations: result.violations,
      outputPreview: output.substring(0, 200),
    });
    
    // Return sanitized output or throw error
    if (result.sanitizedOutput) {
      return result.sanitizedOutput;
    }
    
    throw new AISecurityError(
      `AI output failed safety check: ${result.violations.join(', ')}`,
      result.violations
    );
  }
  
  return output;
}

/**
 * Check AI output for safety violations
 */
export function checkAIOutputSafety(output: string, context: AIContext): SafetyCheckResult {
  const violations: string[] = [];
  
  // Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`Forbidden pattern detected: ${pattern.source}`);
    }
  }
  
  // Check for calculation patterns (AI should not calculate money)
  for (const pattern of CALCULATION_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`Calculation pattern detected: ${pattern.source}`);
    }
  }
  
  // Check for cross-tenant access patterns
  for (const pattern of CROSS_TENANT_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`Cross-tenant pattern detected: ${pattern.source}`);
    }
  }
  
  // Check for suspicious code blocks
  if (containsSuspiciousCode(output)) {
    violations.push('Suspicious code block detected');
  }
  
  // If violations found, try to sanitize
  if (violations.length > 0) {
    const sanitized = sanitizeOutput(output);
    
    // Re-check sanitized output
    const sanitizedViolations: string[] = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitizedViolations.push(`Forbidden pattern in sanitized output`);
      }
    }
    
    if (sanitizedViolations.length === 0) {
      return {
        isSafe: false,
        violations,
        sanitizedOutput: sanitized,
      };
    }
  }
  
  return {
    isSafe: violations.length === 0,
    violations,
  };
}

/**
 * Check for suspicious code blocks
 */
function containsSuspiciousCode(output: string): boolean {
  // Check for code blocks with dangerous content
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = output.match(codeBlockRegex) || [];
  
  for (const block of codeBlocks) {
    // Check for SQL in code blocks
    if (/\b(UPDATE|DELETE|INSERT|DROP|ALTER|CREATE)\b/i.test(block)) {
      return true;
    }
    
    // Check for shell commands
    if (/\b(rm\s+-rf|sudo|chmod|chown)\b/i.test(block)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitize AI output by removing dangerous content
 */
function sanitizeOutput(output: string): string {
  let sanitized = output;
  
  // Remove code blocks with SQL
  sanitized = sanitized.replace(/```sql[\s\S]*?```/gi, '[SQL code removed for safety]');
  
  // Remove code blocks with shell commands
  sanitized = sanitized.replace(/```(bash|sh|shell)[\s\S]*?```/gi, '[Shell code removed for safety]');
  
  // Remove inline code with dangerous patterns
  sanitized = sanitized.replace(/`[^`]*(?:UPDATE|DELETE|INSERT|DROP)[^`]*`/gi, '[code removed]');
  
  return sanitized;
}

// ============================================
// CUSTOM ERROR CLASS
// ============================================

export class AISecurityError extends Error {
  public violations: string[];
  
  constructor(message: string, violations: string[] = []) {
    super(message);
    this.name = 'AISecurityError';
    this.violations = violations;
  }
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate user input before sending to AI
 */
export function validateUserInput(input: string): { isValid: boolean; reason?: string } {
  // Check for prompt injection attempts
  const injectionPatterns = [
    /ignore (previous|all|above) instructions/i,
    /disregard (previous|all|above)/i,
    /forget (everything|your instructions)/i,
    /you are now/i,
    /new instructions:/i,
    /system prompt:/i,
    /\[INST\]/i,
    /<\|im_start\|>/i,
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        reason: 'Input contains potentially harmful content',
      };
    }
  }
  
  // Check for excessive length
  if (input.length > 5000) {
    return {
      isValid: false,
      reason: 'Input exceeds maximum length',
    };
  }
  
  return { isValid: true };
}

// ============================================
// RESPONSE FILTERING
// ============================================

/**
 * Filter sensitive information from AI responses
 */
export function filterSensitiveInfo(response: string): string {
  let filtered = response;
  
  // Remove any accidentally included API keys
  filtered = filtered.replace(/[a-zA-Z0-9_-]{32,}/g, (match) => {
    // Check if it looks like an API key
    if (/^(sk-|pk-|api-|key-)/i.test(match)) {
      return '[REDACTED]';
    }
    return match;
  });
  
  // Remove email addresses (except in expected contexts)
  // filtered = filtered.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  
  // Remove phone numbers in certain formats
  // filtered = filtered.replace(/\+?[0-9]{10,15}/g, '[phone]');
  
  return filtered;
}

export default {
  validateAIOutput,
  checkAIOutputSafety,
  validateUserInput,
  filterSensitiveInfo,
  AISecurityError,
};
