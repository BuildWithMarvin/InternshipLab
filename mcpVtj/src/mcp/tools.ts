// MCP Tools Implementation for VTJ API Integration

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

// Server URL from environment (for login links in error responses)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

/**
 * Helper function to format remaining time
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
 * Creates a standardized error response with login instructions
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
 * Validates token and returns session data or error
 */
function validateTokenInput(token: string | undefined): {
  valid: boolean;
  sessionData?: any;
  error?: MCPErrorResponse
} {
  // Check if token exists
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

  // Check if token is expired
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

  // Validate and extract session data
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

// ==================== MCP TOOL SCHEMAS ====================

/**
 * Tool schemas for MCP HTTP transport
 */
export const MCP_TOOL_SCHEMAS: MCPToolSchema[] = [
  {
    name: 'authenticate',
    description: 'Validates and decrypts authentication token, returning session information. Use this to verify your token is valid before making other API calls.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Encrypted authentication token obtained from the web login interface'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'get_depot',
    description: 'Retrieves depot account data from VTJ API using your authentication token. Returns detailed information about your trading depot/account.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Encrypted authentication token obtained from the web login interface'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'get_session_status',
    description: 'Checks the current status of your authentication token, including validity, expiration time, and depot information.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Encrypted authentication token obtained from the web login interface'
        }
      },
      required: ['token']
    }
  }
];

// ==================== MCP TOOL IMPLEMENTATIONS ====================

/**
 * AUTHENTICATE TOOL
 * Validates and decrypts token, returns session information
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
      message: 'Token is valid and authentication successful',
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
 * GET_DEPOT TOOL
 * Retrieves depot data from VTJ API
 */
export async function getDepot(input: MCPToolInput): Promise<GetDepotResponse | MCPErrorResponse> {
  try {
    const validation = validateTokenInput(input.token);

    if (!validation.valid) {
      return validation.error!;
    }

    const sessionData = validation.sessionData!;
    const { vtjSessionId, depotId } = sessionData;

    // Call VTJ API to get depot data
    try {
      const depotData = await getDepotData(vtjSessionId, depotId);

      return {
        success: true,
        depotId: depotId,
        data: depotData
      };
    } catch (apiError) {
      // Handle VTJ API errors
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';

      return createErrorResponse(
        'vtj_api_error',
        `Failed to retrieve depot data from VTJ API: ${errorMessage}`,
        'The VTJ API returned an error. This could mean:\n1. Your VTJ session has expired on the server\n2. The depot ID is invalid\n3. The VTJ API is temporarily unavailable\n\nPlease try getting a new token from the login URL below.'
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
 * GET_SESSION_STATUS TOOL
 * Checks token status and validity
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

    // Check if token is expired
    if (isTokenExpired(input.token)) {
      // Try to get session data even if expired (for depot info)
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

    // Validate and extract session data
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

// ==================== TOOL DISPATCHER ====================

/**
 * Executes an MCP tool by name
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
        'Available tools: authenticate, get_depot, get_session_status'
      );
  }
}

/**
 * Returns list of available tools
 */
export function getAvailableTools(): MCPToolSchema[] {
  return MCP_TOOL_SCHEMAS;
}
