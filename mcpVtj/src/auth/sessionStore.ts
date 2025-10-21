import { decryptToken, isTokenValid } from './tokenManager.js';
import { SessionData, SessionDataSchema } from './types.js';

/**
 * Validates a token and checks if it's still valid
 * @param token - Encrypted token string
 * @returns true if token is valid, false otherwise
 */
export function validateToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  return isTokenValid(token);
}

/**
 * Extracts session data from an encrypted token
 * @param token - Encrypted token string
 * @returns Session data or null if token is invalid
 */
export function extractSessionData(token: string): SessionData | null {
  try {
    // Validate token first
    if (!validateToken(token)) {
      return null;
    }

    // Decrypt token (already validated by decryptToken using Zod)
    const payload = decryptToken(token);

    // Additional validation using SessionDataSchema to ensure data integrity
    const sessionData: SessionData = {
      vtjSessionId: payload.vtjSessionId,
      depotId: payload.depotId,
      expiresAt: payload.expiresAt
    };

    // Validate extracted session data
    const validationResult = SessionDataSchema.safeParse(sessionData);
    if (!validationResult.success) {
      console.error('[Session Store] Session data validation failed:', validationResult.error);
      return null;
    }

    return validationResult.data;
  } catch (error) {
    // Token is invalid or decryption failed
    console.error('[Session Store] Failed to extract session data:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Extracts VTJ session ID from token
 * Helper function for quick session ID extraction
 * @param token - Encrypted token string
 * @returns VTJ session ID or null if token is invalid
 */
export function getVtjSessionId(token: string): string | null {
  const sessionData = extractSessionData(token);
  return sessionData ? sessionData.vtjSessionId : null;
}

/**
 * Extracts depot ID from token
 * Helper function for quick depot ID extraction
 * @param token - Encrypted token string
 * @returns Depot ID or null if token is invalid
 */
export function getDepotId(token: string): string | null {
  const sessionData = extractSessionData(token);
  return sessionData ? sessionData.depotId : null;
}

/**
 * Checks if token is expired
 * @param token - Encrypted token string
 * @returns true if token is expired, false otherwise or if token is invalid
 */
export function isTokenExpired(token: string): boolean {
  try {
    const sessionData = extractSessionData(token);
    if (!sessionData) {
      return true; // Invalid token is considered expired
    }

    const now = Date.now();
    return sessionData.expiresAt <= now;
  } catch (error) {
    return true;
  }
}

/**
 * Gets remaining time until token expires
 * @param token - Encrypted token string
 * @returns Remaining time in milliseconds, or 0 if expired/invalid
 */
export function getTokenRemainingTime(token: string): number {
  try {
    const sessionData = extractSessionData(token);
    if (!sessionData) {
      return 0;
    }

    const now = Date.now();
    const remaining = sessionData.expiresAt - now;

    return remaining > 0 ? remaining : 0;
  } catch (error) {
    return 0;
  }
}
