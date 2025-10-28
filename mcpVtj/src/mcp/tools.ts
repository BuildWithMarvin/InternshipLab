// MCP-Tools-Implementierung für die VTJ-API-Integration

import { decryptToken } from '../auth/tokenManager.js';
import {
  extractSessionData,
  isTokenExpired,
  getTokenRemainingTime
} from '../auth/sessionStore.js';
import { getDepotData } from '../api/vtjClient.js';
import {
  MCPToolInput,
  MCPToolSchema,
  AuthenticateResponse,
  GetDepotResponse,
  GetSessionStatusResponse,
  MCPErrorResponse,
  MCPToolResult
} from './types.js';

// Server-URL aus der Umgebung (für Login-Links in Fehlermeldungen)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

/**
 * Hilfsfunktion zum Formatieren der verbleibenden Zeit
 */
function formatRemainingTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
}

/**
 * Erstellt eine standardisierte Fehlerantwort mit Login-Anleitung
 */
function createErrorResponse(
  errorType: string,
  message: string,
  instructions?: string
): MCPErrorResponse {
  return {
    error: errorType,
    message,
    login_url: SERVER_URL,
    instructions: instructions ||
      '1. Visit the login URL\n2. Enter your VTJ credentials\n3. Copy the token\n4. Use the token as parameter in this tool'
  };
}

/**
 * Validiert das Token und gibt Sitzungsdaten oder einen Fehler zurück
 */
function validateTokenInput(token: string | undefined): {
  valid: boolean;
  sessionData?: any;
  error?: MCPErrorResponse
} {
  // Prüfen, ob ein Token vorhanden ist
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return {
      valid: false,
      error: createErrorResponse(
        'missing_token',
        'Token parameter is required but was not provided.',
        '1. Visit the login URL below\n2. Enter your VTJ credentials\n3. Copy the token\n4. Provide the token as a parameter to this tool'
      )
    };
  }

  // Prüfen, ob das Token abgelaufen ist
  if (isTokenExpired(token)) {
    return {
      valid: false,
      error: createErrorResponse(
        'token_expired',
        'Your token has expired. Please get a new token from the web interface.',
        '1. Visit the login URL below\n2. Enter your VTJ credentials\n3. Copy the new token\n4. Use the new token as parameter in this tool'
      )
    };
  }

  // Sitzungsdaten validieren und extrahieren
  const sessionData = extractSessionData(token);
  if (!sessionData) {
    return {
      valid: false,
      error: createErrorResponse(
        'invalid_token',
        'Invalid or corrupted token. Please get a new token from the web interface.',
        '1. Visit the login URL below\n2. Enter your VTJ credentials\n3. Copy the token\n4. Use the token as parameter in this tool'
      )
    };
  }

  return {
    valid: true,
    sessionData
  };
}

// ==================== MCP-TOOL-SCHEMAS ====================

/**
 * Tool-Schemas für den MCP-HTTP-Transport
 */
export const MCP_TOOL_SCHEMAS: MCPToolSchema[] = [
  {
    name: 'authenticate',
    description: 'Validiert und entschlüsselt das Authentifizierungs-Token und liefert Sitzungsinformationen. Verwenden Sie dies, um Ihr Token vor weiteren API-Aufrufen zu prüfen.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Verschlüsseltes Authentifizierungs-Token aus der Web-Login-Oberfläche'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'get_depot',
    description: 'Ruft Depotkontodaten über die VTJ-API mit Ihrem Authentifizierungs-Token ab. Liefert detaillierte Informationen zu Ihrem Trading-Depot/Konto.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Verschlüsseltes Authentifizierungs-Token aus der Web-Login-Oberfläche'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'get_session_status',
    description: 'Prüft den aktuellen Status Ihres Authentifizierungs-Tokens, inkl. Gültigkeit, Ablaufzeit und Depotinformationen.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Verschlüsseltes Authentifizierungs-Token aus der Web-Login-Oberfläche'
        }
      },
      required: ['token']
    }
  }
];

// ==================== MCP-TOOL-IMPLEMENTIERUNGEN ====================

/**
 * AUTHENTICATE-TOOL
 * Validiert und entschlüsselt das Token, gibt Sitzungsinformationen zurück
 */
export async function authenticate(input: MCPToolInput): Promise<AuthenticateResponse | MCPErrorResponse> {
  try {
    const validation = validateTokenInput(input.token);

    if (!validation.valid) {
      return validation.error!;
    }

    const sessionData = validation.sessionData!;
    const remainingTime = getTokenRemainingTime(input.token);

    return {
      success: true,
      message: 'Token ist gültig, Authentifizierung erfolgreich',
      sessionInfo: {
        depotId: sessionData.depotId,
        expiresAt: sessionData.expiresAt,
        expiresIn: formatRemainingTime(remainingTime)
      }
    };
  } catch (error) {
    return createErrorResponse(
      'authentication_failed',
      `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * GET_DEPOT-TOOL
 * Ruft Depotdaten über die VTJ-API ab
 */
export async function getDepot(input: MCPToolInput): Promise<GetDepotResponse | MCPErrorResponse> {
  try {
    const validation = validateTokenInput(input.token);

    if (!validation.valid) {
      return validation.error!;
    }

    const sessionData = validation.sessionData!;
    const { vtjSessionId, depotId } = sessionData;

    // VTJ-API aufrufen, um Depotdaten zu erhalten
    try {
      const depotData = await getDepotData(vtjSessionId, depotId);

      return {
        success: true,
        depotId: depotId,
        data: depotData
      };
    } catch (apiError) {
      // VTJ-API-Fehler behandeln
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';

      return createErrorResponse(
        'vtj_api_error',
        `Abruf der Depotdaten von der VTJ-API fehlgeschlagen: ${errorMessage}`,
        'Die VTJ-API hat einen Fehler zurückgegeben. Mögliche Ursachen:\n1. Ihre VTJ-Sitzung ist auf dem Server abgelaufen\n2. Die Depot-ID ist ungültig\n3. Die VTJ-API ist vorübergehend nicht verfügbar\n\nBitte versuchen Sie, unten über die Login-URL ein neues Token zu beziehen.'
      );
    }
  } catch (error) {
    return createErrorResponse(
      'get_depot_failed',
      `Failed to retrieve depot data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * GET_SESSION_STATUS-TOOL
 * Prüft Token-Status und Gültigkeit
 */
export async function getSessionStatus(input: MCPToolInput): Promise<GetSessionStatusResponse | MCPErrorResponse> {
  try {
    // Check if token exists
    if (!input.token || typeof input.token !== 'string' || input.token.trim() === '') {
      return {
        success: true,
        status: 'invalid'
      };
    }

    // Prüfen, ob das Token abgelaufen ist
    if (isTokenExpired(input.token)) {
      // Sitzungsdaten auch bei Ablauf versuchen zu lesen (für Depotinfo)
      try {
        const payload = decryptToken(input.token);
        return {
          success: true,
          status: 'expired',
          depotId: payload.depotId,
          expiresAt: payload.expiresAt,
          expiresIn: 'Expired',
          remainingTime: 0
        };
      } catch {
        return {
          success: true,
          status: 'expired'
        };
      }
    }

    // Sitzungsdaten validieren und extrahieren
    const sessionData = extractSessionData(input.token);

    if (!sessionData) {
      return {
        success: true,
        status: 'invalid'
      };
    }

    const remainingTime = getTokenRemainingTime(input.token);

    return {
      success: true,
      status: 'valid',
      depotId: sessionData.depotId,
      expiresAt: sessionData.expiresAt,
      expiresIn: formatRemainingTime(remainingTime),
      remainingTime: remainingTime
    };
  } catch (error) {
    return {
      success: true,
      status: 'invalid'
    };
  }
}

// ==================== TOOL-DISPATCHER ====================

/**
 * Führt ein MCP-Tool anhand des Namens aus
 */
export async function executeTool(toolName: string, input: any): Promise<MCPToolResult> {
  switch (toolName) {
    case 'authenticate':
      return authenticate(input as MCPToolInput);

    case 'get_depot':
      return getDepot(input as MCPToolInput);

    case 'get_session_status':
      return getSessionStatus(input as MCPToolInput);

    default:
      return createErrorResponse(
        'unknown_tool',
        `Unknown tool: ${toolName}`,
        'Verfügbare Tools: authenticate, get_depot, get_session_status'
      );
  }
}

/**
 * Gibt die Liste der verfügbaren Tools zurück
 */
export function getAvailableTools(): MCPToolSchema[] {
  return MCP_TOOL_SCHEMAS;
}
