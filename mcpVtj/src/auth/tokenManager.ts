import crypto from 'crypto';
import { TokenPayload, TokenPayloadSchema, SessionDataSchema } from './types.js';
import { z } from 'zod';

// AES-256-GCM Verschlüsselungskonfiguration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Gültigkeitsdauer des Tokens (24 Stunden in Millisekunden, konfigurierbar)
const TOKEN_VALIDITY_DURATION = 24 * 60 * 60 * 1000; // 24 Stunden

/**
 * Leitet den Verschlüsselungsschlüssel mittels PBKDF2 aus dem Secret ab
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Verschlüsselt einen Token-Payload mit AES-256-GCM
 * @param payload - Zu verschlüsselnder Token-Payload
 * @returns Verschlüsseltes Token als Base64-String
 * @throws {Error} Wenn die Payload-Validierung oder die Verschlüsselung fehlschlägt
 */
export function encryptToken(payload: TokenPayload): string {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
  }

  try {
    // Payload mit Zod-Schema validieren (verhindert JSON-Injektion)
    const validatedPayload = TokenPayloadSchema.parse(payload);

    // Zufälliges Salt und IV erzeugen
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Schlüssel ableiten
    const key = deriveKey(secret, salt);

    // Cipher erzeugen
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Validierten Payload verschlüsseln
    const payloadString = JSON.stringify(validatedPayload);
    let encrypted = cipher.update(payloadString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Authentifizierungs-Tag ermitteln
    const authTag = cipher.getAuthTag();

    // Salt + IV + AuthTag + verschlüsselte Daten kombinieren
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    // Als Base64-String zurückgeben
    return combined.toString('base64');
  } catch (error) {
    // Zod-Validierungsfehler behandeln
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Token payload validation failed: ${validationErrors}`);
    }

    throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Entschlüsselt einen verschlüsselten Token-String
 * @param encryptedToken - Verschlüsseltes Token als Base64-String
 * @returns Entschlüsselter und validierter Token-Payload
 * @throws {Error} Wenn die Entschlüsselung oder die Payload-Validierung fehlschlägt
 */
export function decryptToken(encryptedToken: string): TokenPayload {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
  }

  try {
    // Base64-Token dekodieren
    const combined = Buffer.from(encryptedToken, 'base64');

    // Komponenten extrahieren
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Schlüssel zum Entschlüsseln ableiten
    const key = deriveKey(secret, salt);

    // Decipher erzeugen
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Daten entschlüsseln
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // JSON parsen
    const parsedPayload = JSON.parse(decrypted);

    // Mit Zod-Schema validieren (entspannter), abgelaufene Zeitstempel zulassen
    // safeParse verwenden, um abgelaufene Zeitstempel zuzulassen
    const validationResult = TokenPayloadSchema.safeParse(parsedPayload);

    if (!validationResult.success) {
      // Wenn nur der Zeitstempel problematisch ist, SessionDataSchema versuchen, das abgelaufene Zeitstempel zulässt
      const sessionValidation = SessionDataSchema.safeParse(parsedPayload);

      if (sessionValidation.success) {
        // Gültige Struktur, aber evtl. abgelaufen – für Ablaufprüfung zurückgeben
        return parsedPayload as TokenPayload;
      }

      // Ungültige Payload-Struktur
      const validationErrors = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Invalid token payload structure: ${validationErrors}`);
    }

    return validationResult.data;
  } catch (error) {
    // Zod-Validierungsfehler behandeln
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Token payload validation failed: ${validationErrors}`);
    }

    throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : 'Invalid or corrupted token'}`);
  }
}

/**
 * Prüft, ob ein Token noch gültig ist (nicht abgelaufen)
 * @param token - Verschlüsselter Token-String
 * @returns true, wenn das Token gültig ist, sonst false
 */
export function isTokenValid(token: string): boolean {
  try {
    const payload = decryptToken(token);

    // Prüfen, ob das Token abgelaufen ist
    const now = Date.now();
    if (payload.expiresAt <= now) {
      return false;
    }

    // Erforderliche Felder prüfen
    if (!payload.vtjSessionId || !payload.depotId) {
      return false;
    }

    return true;
  } catch (error) {
    // Token-Entschlüsselung fehlgeschlagen oder ungültiges Format
    return false;
  }
}

/**
 * Erstellt einen neuen Token-Payload mit Ablaufzeit
 * @param vtjSessionId - VTJ-Sitzungs-ID
 * @param depotId - Depot-ID
 * @param validityDuration - Token-Gültigkeitsdauer in Millisekunden (Standard: 24h)
 * @returns Token-Payload
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
