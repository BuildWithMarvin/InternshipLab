// src/routes/simpleMcpRoutes.ts - Simplified MCP Routes
import { Router } from "express";
import { mcpAuthMiddleware, mcpCorsMiddleware } from "../mcp/mcpAuth";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import type { Request, Response } from "express";

const router = Router();

// Apply CORS and auth middleware
router.use(mcpCorsMiddleware);
router.use(mcpAuthMiddleware);

// Simplified MCP endpoint that handles tools directly
router.post("/", async (req: Request, res: Response) => {
  try {
    const { jsonrpc, id, method, params } = req.body;
    
    console.log(`🔧 Simple MCP request: ${method}`);
    
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-12-19",
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: "financial-mcp-server",
            version: "1.0.0"
          }
        }
      });
    }
    
    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_account_balance",
              description: "Get your current account balance and financial information",
              inputSchema: {
                type: "object",
                properties: {}
              }
            },
            {
              name: "update_account_balance", 
              description: "Update your account balance",
              inputSchema: {
                type: "object",
                properties: {
                  amount: {
                    type: "number",
                    description: "New account balance amount"
                  }
                },
                required: ["amount"]
              }
            },
            {
              name: "get_kyc_status",
              description: "Get your KYC verification status",
              inputSchema: {
                type: "object", 
                properties: {}
              }
            },
            {
              name: "update_kyc_status",
              description: "Update your KYC verification status", 
              inputSchema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["pending", "approved", "rejected"],
                    description: "New KYC status"
                  }
                },
                required: ["status"]
              }
            }
          ]
        }
      });
    }
    
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs = {} } = params;
      
      // Check authentication
      if (!req.auth?.token) {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: "Authentication required. Please authenticate via /api/auth/login first."
          }
        });
      }
      
      // Validate session and get user
      const sessionData = await AuthService.validateSession(req.auth.token);
      if (!sessionData || !sessionData.realUser) {
        return res.json({
          jsonrpc: "2.0", 
          id,
          error: {
            code: -32000,
            message: "Invalid or expired authentication token"
          }
        });
      }
      
      const user = sessionData.realUser;
      console.log(`🔧 Tool call for user: ${user.email} (ID: ${user.user_id})`);
      
      try {
        let result;
        
        switch (toolName) {
          case "get_account_balance":
            // Fetch fresh user data from database
            const freshUser = await UserService.getUserById(user.user_id);
            if (!freshUser) {
              throw new Error(`User not found in database: ${user.user_id}`);
            }
            
            result = {
              content: [{
                type: "text",
                text: `Account Balance Information:
- User: ${freshUser.username} (${freshUser.email})
- Balance: ${freshUser.account_balance} ${freshUser.currency}
- KYC Status: ${freshUser.kyc_status}
- Last Updated: ${freshUser.updated_at}`
              }]
            };
            break;
            
          case "update_account_balance":
            const { amount } = toolArgs;
            if (typeof amount !== 'number') {
              throw new Error('Amount must be a number');
            }
            
            const updateSuccess = await UserService.updateAccountBalance(user.user_id, amount);
            if (!updateSuccess) {
              throw new Error('Failed to update account balance');
            }
            
            const updatedUser = await UserService.getUserById(user.user_id);
            result = {
              content: [{
                type: "text",
                text: `Account balance updated successfully:
- New Balance: ${updatedUser?.account_balance} ${updatedUser?.currency}
- Updated At: ${updatedUser?.updated_at}`
              }]
            };
            break;
            
          case "get_kyc_status":
            const kycUser = await UserService.getUserById(user.user_id);
            if (!kycUser) {
              throw new Error(`User not found in database: ${user.user_id}`);
            }
            
            result = {
              content: [{
                type: "text",
                text: `KYC Status Information:
- User: ${kycUser.username} (${kycUser.email})
- KYC Status: ${kycUser.kyc_status}
- Account Status: ${kycUser.kyc_status === 'approved' ? 'Fully Verified' : 'Pending Verification'}
- Last Updated: ${kycUser.updated_at}`
              }]
            };
            break;
            
          case "update_kyc_status":
            const { status } = toolArgs;
            if (!['pending', 'approved', 'rejected'].includes(status)) {
              throw new Error('Status must be one of: pending, approved, rejected');
            }
            
            const kycUpdateSuccess = await UserService.updateKycStatus(user.user_id, status);
            if (!kycUpdateSuccess) {
              throw new Error('Failed to update KYC status');
            }
            
            const updatedKycUser = await UserService.getUserById(user.user_id);
            result = {
              content: [{
                type: "text", 
                text: `KYC status updated successfully:
- New Status: ${updatedKycUser?.kyc_status}
- Updated At: ${updatedKycUser?.updated_at}`
              }]
            };
            break;
            
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        console.log(`✅ Tool ${toolName} executed successfully`);
        
        return res.json({
          jsonrpc: "2.0",
          id,
          result
        });
        
      } catch (toolError) {
        console.error(`❌ Tool ${toolName} failed:`, toolError);
        
        return res.json({
          jsonrpc: "2.0",
          id, 
          result: {
            content: [{
              type: "text",
              text: `Tool execution failed: ${toolError instanceof Error ? toolError.message : String(toolError)}`
            }]
          }
        });
      }
    }
    
    // Unknown method
    return res.status(400).json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });
    
  } catch (error) {
    console.error('❌ Error in simple MCP route:', error);
    
    return res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: "Internal server error"
      }
    });
  }
});

export default router;