import crypto from 'crypto';
import { TokenPayload, TokenPayloadSchema, SessionDataSchema } from './types.js';
import { z } from 'zod';

// AES-256-GCM Encryption Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Token validity duration (24 hours in milliseconds, configurable)
const TOKEN_VALIDITY_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Derives encryption key from secret using PBKDF2
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a token payload using AES-256-GCM
 * @param payload - Token payload to encrypt
 * @returns Encrypted token as base64 string
 * @throws {Error} If payload validation fails or encryption fails
 */
export function encryptToken(payload: TokenPayload): string {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
  }

  try {
    // Validate payload using Zod schema (prevents JSON injection)
    const validatedPayload = TokenPayloadSchema.parse(payload);

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key
    const key = deriveKey(secret, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt validated payload
    const payloadString = JSON.stringify(validatedPayload);
    let encrypted = cipher.update(payloadString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    // Return as base64 string
    return combined.toString('base64');
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Token payload validation failed: ${validationErrors}`);
    }

    throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts an encrypted token string
 * @param encryptedToken - Encrypted token as base64 string
 * @returns Decrypted and validated token payload
 * @throws {Error} If decryption fails or payload validation fails
 */
export function decryptToken(encryptedToken: string): TokenPayload {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
  }

  try {
    // Decode base64 token
    const combined = Buffer.from(encryptedToken, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive decryption key
    const key = deriveKey(secret, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse JSON
    const parsedPayload = JSON.parse(decrypted);

    // Validate using Zod schema with relaxed validation (allow expired tokens for info retrieval)
    // Use safeParse to allow expired timestamps during decryption
    const validationResult = TokenPayloadSchema.safeParse(parsedPayload);

    if (!validationResult.success) {
      // If timestamp is the only issue, try SessionDataSchema which allows expired timestamps
      const sessionValidation = SessionDataSchema.safeParse(parsedPayload);

      if (sessionValidation.success) {
        // Valid structure but may be expired - return as-is for expiration check
        return parsedPayload as TokenPayload;
      }

      // Invalid payload structure
      const validationErrors = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Invalid token payload structure: ${validationErrors}`);
    }

    return validationResult.data;
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Token payload validation failed: ${validationErrors}`);
    }

    throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : 'Invalid or corrupted token'}`);
  }
}

/**
 * Validates if a token is still valid (not expired)
 * @param token - Encrypted token string
 * @returns true if token is valid, false otherwise
 */
export function isTokenValid(token: string): boolean {
  try {
    const payload = decryptToken(token);

    // Check if token has expired
    const now = Date.now();
    if (payload.expiresAt <= now) {
      return false;
    }

    // Validate required fields
    if (!payload.vtjSessionId || !payload.depotId) {
      return false;
    }

    return true;
  } catch (error) {
    // Token decryption failed or invalid format
    return false;
  }
}

/**
 * Creates a new token payload with expiration time
 * @param vtjSessionId - VTJ session ID
 * @param depotId - Depot ID
 * @param validityDuration - Token validity duration in milliseconds (default: 24h)
 * @returns Token payload
 */
export function createTokenPayload(
  vtjSessionId: string,
  depotId: string,
  validityDuration: number = TOKEN_VALIDITY_DURATION
): TokenPayload {
  const expiresAt = Date.now() + validityDuration;

  return {
    vtjSessionId,
    depotId,
    expiresAt
  };
}
