import { decryptToken, isTokenValid } from './tokenManager.js';
import { SessionData, SessionDataSchema } from './types.js';

/**
 * Validiert ein Token und prüft, ob es noch gültig ist
 * @param token - Verschlüsselter Token-String
 * @returns true, wenn das Token gültig ist, sonst false
 */
export function validateToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  return isTokenValid(token);
}

/**
 * Extrahiert Sitzungsdaten aus einem verschlüsselten Token
 * @param token - Verschlüsselter Token-String
 * @returns Sitzungsdaten oder null, wenn das Token ungültig ist
 */
export function extractSessionData(token: string): SessionData | null {
  try {
    // Zuerst Token validieren
    if (!validateToken(token)) {
      return null;
    }

    // Token entschlüsseln (wurde bereits durch decryptToken mit Zod geprüft)
    const payload = decryptToken(token);

    // Zusätzliche Validierung mittels SessionDataSchema zur Sicherstellung der Datenintegrität
    const sessionData: SessionData = {
      vtjSessionId: payload.vtjSessionId,
      depotId: payload.depotId,
      expiresAt: payload.expiresAt
    };

    // Extrahierte Sitzungsdaten validieren
    const validationResult = SessionDataSchema.safeParse(sessionData);
    if (!validationResult.success) {
      console.error('[Session Store] Session data validation failed:', validationResult.error);
      return null;
    }

    return validationResult.data;
  } catch (error) {
    // Token ist ungültig oder Entschlüsselung fehlgeschlagen
    console.error('[Session Store] Failed to extract session data:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Extrahiert die VTJ-Sitzungs-ID aus dem Token
 * Hilfsfunktion zur schnellen Extraktion der Sitzungs-ID
 * @param token - Verschlüsselter Token-String
 * @returns VTJ-Sitzungs-ID oder null, wenn das Token ungültig ist
 */
export function getVtjSessionId(token: string): string | null {
  const sessionData = extractSessionData(token);
  return sessionData ? sessionData.vtjSessionId : null;
}

/**
 * Extrahiert die Depot-ID aus dem Token
 * Hilfsfunktion zur schnellen Extraktion der Depot-ID
 * @param token - Verschlüsselter Token-String
 * @returns Depot-ID oder null, wenn das Token ungültig ist
 */
export function getDepotId(token: string): string | null {
  const sessionData = extractSessionData(token);
  return sessionData ? sessionData.depotId : null;
}

/**
 * Prüft, ob das Token abgelaufen ist
 * @param token - Verschlüsselter Token-String
 * @returns true, wenn das Token abgelaufen ist, sonst false bzw. bei Ungültigkeit
 */
export function isTokenExpired(token: string): boolean {
  try {
    const sessionData = extractSessionData(token);
    if (!sessionData) {
      return true; // Ungültiges Token gilt als abgelaufen
    }

    const now = Date.now();
    return sessionData.expiresAt <= now;
  } catch (error) {
    return true;
  }
}

/**
 * Ermittelt die verbleibende Zeit bis zum Ablauf des Tokens
 * @param token - Verschlüsselter Token-String
 * @returns Verbleibende Zeit in Millisekunden, oder 0 bei Ablauf/Ungültigkeit
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
