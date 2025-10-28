// TypeScript-Schnittstellen für MCP-Tools

/**
 * Standard-MCP-Tool-Eingabe mit Token-Parameter
 */
export interface MCPToolInput {
  token: string;
}

/**
 * MCP-Tool-Schemadefinition für den HTTP-Transport
 */
export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Antwort des Authentifizierungs-Tools
 */
export interface AuthenticateResponse {
  success: boolean;
  message: string;
  sessionInfo: {
    depotId: string;
    expiresAt: number;
    expiresIn: string;
  };
}

/**
 * Antwort des Get-Depot-Tools
 */
export interface GetDepotResponse {
  success: boolean;
  depotId: string;
  data: any;
}

/**
 * Antwort des Get-Session-Status-Tools
 */
export interface GetSessionStatusResponse {
  success: boolean;
  status: 'valid' | 'expired' | 'invalid';
  depotId?: string;
  expiresAt?: number;
  expiresIn?: string;
  remainingTime?: number;
}

/**
 * Fehlerantwort für MCP-Tools
 */
export interface MCPErrorResponse {
  error: string;
  message: string;
  login_url: string;
  instructions: string;
}

/**
 * MCP-Tool-Ausführungsergebnis
 */
export type MCPToolResult =
  | AuthenticateResponse
  | GetDepotResponse
  | GetSessionStatusResponse
  | MCPErrorResponse;
