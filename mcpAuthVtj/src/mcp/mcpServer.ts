// src/mcp/mcpServer.ts - Real MCP Server Implementation
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
// JSON Schema types for MCP tools
type JSONSchema = {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  enum?: any[];
  default?: any;
  description?: string;
};
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import type { UserProfile } from "../types";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Extended AuthInfo interface for our MCP implementation
interface MCPAuthInfo extends AuthInfo {
  user?: {
    id: string;
    email: string;
    username: string;
  };
  metadata?: {
    accountBalance: number;
    currency: string;
    kycStatus: string;
    authenticatedAt: string;
  };
}

// In-memory event store for resumability
class InMemoryEventStore {
  private events: Map<string, Array<{ eventId: string; message: any }>> = new Map();
  private eventIdCounter = 0;

  async storeEvent(streamId: string, message: any): Promise<string> {
    const eventId = `event-${++this.eventIdCounter}`;
    
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    
    this.events.get(streamId)!.push({ eventId, message });
    return eventId;
  }

  async replayEventsAfter(lastEventId: string, { send }: { send: (eventId: string, message: any) => Promise<void> }): Promise<string> {
    // Simple implementation - in production you'd want more sophisticated event replay
    for (const [streamId, events] of this.events) {
      const lastEventIndex = events.findIndex(e => e.eventId === lastEventId);
      if (lastEventIndex !== -1) {
        const eventsToReplay = events.slice(lastEventIndex + 1);
        for (const event of eventsToReplay) {
          await send(event.eventId, event.message);
        }
        return streamId;
      }
    }
    return randomUUID(); // Return new stream if no events found
  }
}

// Map to store transports by session ID
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

// Map to store auth contexts by session ID  
const sessionAuthContexts: Map<string, MCPAuthInfo> = new Map();

// Create the MCP server with financial tools
export function createMCPServer(authContext?: MCPAuthInfo): McpServer {
  const server = new McpServer({
    name: 'financial-mcp-server',
    version: '1.0.0'
  }, { 
    capabilities: { 
      logging: {},
      tools: {},
    }
  });

  // Helper function to authenticate using session token from MCP auth or context
  async function authenticateFromMCPRequest(auth?: MCPAuthInfo, context?: any): Promise<{ success: boolean; user?: any; error?: string }> {
    // Try to get auth from multiple sources
    let authToUse = auth || authContext;
    
    // If not found, try to get from session context based on transport
    if (!authToUse && context && (context as any)._sessionId) {
      const sessionId = (context as any)._sessionId;
      authToUse = sessionAuthContexts.get(sessionId);
      console.log(`🔍 Retrieved auth context for session ${sessionId}:`, authToUse ? 'found' : 'not found');
    }
    
    if (!authToUse?.token) {
      console.log('❌ No authentication token found in any source');
      return { success: false, error: "No authentication token provided" };
    }

    try {
      console.log(`🔐 Authenticating with token: ${authToUse.token.substring(0, 10)}...`);
      
      // If we already have user data from middleware, use it directly
      if (authToUse.user && authToUse.metadata) {
        console.log(`✅ Using cached user data for: ${authToUse.user.email}`);
        // Reconstruct user object from auth context
        const user = {
          user_id: parseInt(authToUse.user.id),
          email: authToUse.user.email,
          username: authToUse.user.username,
          account_balance: authToUse.metadata.accountBalance,
          currency: authToUse.metadata.currency,
          kyc_status: authToUse.metadata.kycStatus,
          updated_at: authToUse.metadata.authenticatedAt
        };
        return { success: true, user: user };
      }

      // Fallback: Validate session using Better Auth
      console.log('🔄 Validating session with Better Auth...');
      const sessionData = await AuthService.validateSession(authToUse.token);
      if (sessionData && sessionData.realUser) {
        console.log(`✅ Session validated for user: ${sessionData.realUser.email}`);
        return { success: true, user: sessionData.realUser };
      }
      return { success: false, error: "Invalid or expired session token" };
    } catch (error) {
      console.error('❌ Authentication error in MCP tool:', error);
      return { success: false, error: `Session validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  // Tool: Get Account Balance
  server.registerTool('get_account_balance', {
    title: 'Get Account Balance',
    description: 'Get your current account balance and financial information',
    inputSchema: {}
  }, async (params, context) => {
    try {
      console.log('🔧 get_account_balance: Starting tool execution');
      console.log('🔧 Context:', JSON.stringify((context as any), null, 2));
      
      const authResult = await authenticateFromMCPRequest((context as any).auth, context);
      console.log('🔧 Auth result:', JSON.stringify(authResult, null, 2));
      
      if (!authResult.success || !authResult.user) {
        console.log('❌ Authentication failed:', authResult.error);
        return {
          content: [{
            type: 'text',
            text: `Authentication failed: ${authResult.error}`
          }]
        };
      }

      // Get the user ID from auth result
      const userId = authResult.user.user_id;
      console.log('🔧 User ID from auth:', userId);
      
      // Fetch fresh user data from financialApp database
      console.log('🔧 Fetching user data from database...');
      const user = await UserService.getUserById(userId);
      console.log('🔧 User data from DB:', user);
      
      if (!user) {
        console.log('❌ User not found in database');
        return {
          content: [{
            type: 'text',
            text: `User data not found in financialApp database for user ID: ${userId}`
          }]
        };
      }
      
      console.log('✅ Returning account balance information');
      return {
        content: [{
          type: 'text',
          text: `Account Balance Information:
- User: ${user.username} (${user.email})
- Balance: ${user.account_balance} ${user.currency}
- KYC Status: ${user.kyc_status}
- Last Updated: ${user.updated_at}`
        }]
      };
    } catch (error) {
      console.error('❌ Error in get_account_balance tool:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error toString:', String(error));
      
      return {
        content: [{
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`
        }]
      };
    }
  });

  // Tool: Update Account Balance
  server.registerTool('update_account_balance', {
    title: 'Update Account Balance',
    description: 'Update your account balance',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'New account balance amount'
        }
      },
      required: ['amount']
    } as any
  }, async (params, context) => {
    const { amount } = params;
    try {
      const authResult = await authenticateFromMCPRequest((context as any).auth, context);
      
      if (!authResult.success || !authResult.user) {
        return {
          content: [{
            type: 'text',
            text: `Authentication failed: ${authResult.error}`
          }]
        };
      }

      const userId = authResult.user.user_id;
      const updateSuccess = await UserService.updateAccountBalance(userId, amount);
      
      if (!updateSuccess) {
        return {
          content: [{
            type: 'text',
            text: 'Failed to update account balance'
          }]
        };
      }

      const updatedUser = await UserService.getUserById(userId);
      
      return {
        content: [{
          type: 'text',
          text: `Account balance updated successfully:
- New Balance: ${updatedUser?.account_balance} ${updatedUser?.currency}
- Updated At: ${updatedUser?.updated_at}`
        }]
      };
    } catch (error) {
      console.error('❌ Error in update_account_balance tool:', error);
      return {
        content: [{
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  });

  // Tool: Get KYC Status
  server.registerTool('get_kyc_status', {
    title: 'Get KYC Status',
    description: 'Get your KYC verification status',
    inputSchema: {}
  }, async (params, context) => {
    try {
      const authResult = await authenticateFromMCPRequest((context as any).auth, context);
      
      if (!authResult.success || !authResult.user) {
        return {
          content: [{
            type: 'text',
            text: `Authentication failed: ${authResult.error}`
          }]
        };
      }

      // Get the user ID from auth result
      const userId = authResult.user.user_id;
      
      // Fetch fresh user data from financialApp database
      const user = await UserService.getUserById(userId);
      
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: `User data not found in financialApp database for user ID: ${userId}`
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: `KYC Status Information:
- User: ${user.username} (${user.email})
- KYC Status: ${user.kyc_status}
- Account Status: ${user.kyc_status === 'approved' ? 'Fully Verified' : 'Pending Verification'}
- Last Updated: ${user.updated_at}`
        }]
      };
    } catch (error) {
      console.error('❌ Error in get_kyc_status tool:', error);
      return {
        content: [{
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  });

  // Tool: Update KYC Status
  server.registerTool('update_kyc_status', {
    title: 'Update KYC Status',
    description: 'Update your KYC verification status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected'],
          description: 'New KYC status'
        }
      },
      required: ['status']
    } as any
  }, async (params, context) => {
    const { status } = params;
    try {
      const authResult = await authenticateFromMCPRequest((context as any).auth, context);
      
      if (!authResult.success || !authResult.user) {
        return {
          content: [{
            type: 'text',
            text: `Authentication failed: ${authResult.error}`
          }]
        };
      }

      const userId = authResult.user.user_id;
      const updateSuccess = await UserService.updateKycStatus(userId, status);
      
      if (!updateSuccess) {
        return {
          content: [{
            type: 'text',
            text: 'Failed to update KYC status'
          }]
        };
      }

      const updatedUser = await UserService.getUserById(userId);
      
      return {
        content: [{
          type: 'text',
          text: `KYC status updated successfully:
- New Status: ${updatedUser?.kyc_status}
- Updated At: ${updatedUser?.updated_at}`
        }]
      };
    } catch (error) {
      console.error('❌ Error in update_kyc_status tool:', error);
      return {
        content: [{
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  });

  // Tool: List Users (Admin function - could add admin check)
  server.registerTool('list_users', {
    title: 'List Users',
    description: 'List all financial users with pagination',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
          default: 1
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 10)',
          default: 10
        }
      }
    } as any
  }, async (params, context) => {
    try {
      const { page = 1, limit = 10 } = params;
      const authResult = await authenticateFromMCPRequest((context as any).auth, context);
      
      if (!authResult.success || !authResult.user) {
        return {
          content: [{
            type: 'text',
            text: `Authentication failed: ${authResult.error}`
          }]
        };
      }

      const users = await UserService.getAllUsers(page, limit);
      
      const userList = users.map((user: UserProfile) => 
        `- ${user.username} (${user.email}): ${user.account_balance} ${user.currency}, KYC: ${user.kyc_status}`
      ).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `Users (Page ${page}, Limit ${limit}):\n${userList}`
        }]
      };
    } catch (error) {
      console.error('❌ Error in list_users tool:', error);
      return {
        content: [{
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  });

  return server;
}

// MCP Request handlers for Express integration
export async function handleMCPPost(req: IncomingMessage & { auth?: MCPAuthInfo }, res: ServerResponse, body: any) {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  if (sessionId) {
    console.log(`🔄 MCP request for session: ${sessionId}`);
  }

  try {
    let transport: StreamableHTTPServerTransport;
    
    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else if (!sessionId && body?.method === 'initialize') {
      // New initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId: string) => {
          console.log(`✅ MCP session initialized: ${sessionId}`);
          transports.set(sessionId, transport);
          
          // Store auth context if available
          if (req.auth) {
            sessionAuthContexts.set(sessionId, req.auth);
            console.log(`🔐 Auth context stored for session: ${sessionId}`);
          }
        },
        onsessionclosed: (sessionId: string) => {
          console.log(`🔴 MCP session closed: ${sessionId}`);
          transports.delete(sessionId);
          sessionAuthContexts.delete(sessionId);
        }
      });

      // Connect transport to MCP server with auth context
      const server = createMCPServer(req.auth);
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    } else {
      // Invalid request
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided or not an initialization request',
        },
        id: null,
      }));
      return;
    }

    // Handle request with existing transport - pass auth for tool calls
    if (body?.method === 'tools/call') {
      // Update auth context for this session if we have it
      if (req.auth && sessionId) {
        sessionAuthContexts.set(sessionId, req.auth);
        console.log(`🔐 Updated auth context for session: ${sessionId}`);
      }
      
      // Add session ID to transport context for tool execution
      (transport as any)._sessionId = sessionId;
    }
    
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      }));
    }
  }
}

export async function handleMCPGet(req: IncomingMessage & { auth?: MCPAuthInfo }, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid or missing session ID');
    return;
  }

  const lastEventId = req.headers['last-event-id'] as string;
  if (lastEventId) {
    console.log(`🔄 MCP client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`📡 Establishing new SSE stream for session ${sessionId}`);
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

export async function handleMCPDelete(req: IncomingMessage & { auth?: MCPAuthInfo }, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid or missing session ID');
    return;
  }

  console.log(`🗑️ MCP session termination request for session ${sessionId}`);
  
  try {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('❌ Error handling session termination:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error processing session termination');
    }
  }
}

// Cleanup function for graceful shutdown
export async function cleanupMCPTransports() {
  console.log('🧹 Cleaning up MCP transports...');
  for (const [sessionId, transport] of transports) {
    try {
      console.log(`🔴 Closing transport for session ${sessionId}`);
      await transport.close();
      transports.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log('✅ MCP cleanup complete');
}