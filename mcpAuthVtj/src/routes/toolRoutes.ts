// src/routes/toolRoutes.ts - MCP-style Tool Endpoints
import { Router } from "express";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";

const router = Router();

// Helper function to authenticate user for each request (legacy email/password)
async function authenticateUser(email: string, password: string) {
  try {
    const loginResult = await AuthService.login(email, password);
    if (loginResult.success && loginResult.realUser) {
      return { success: true, user: loginResult.realUser, sessionToken: loginResult.session.token };
    }
    return { success: false, error: "Invalid credentials" };
  } catch (error) {
    return { success: false, error: "Authentication failed" };
  }
}

// Helper function to authenticate using session token
async function authenticateByToken(sessionToken: string) {
  try {
    const sessionData = await AuthService.validateSession(sessionToken);
    if (sessionData && sessionData.realUser) {
      return { success: true, user: sessionData.realUser };
    }
    return { success: false, error: "Invalid or expired session token" };
  } catch (error) {
    return { success: false, error: "Session validation failed" };
  }
}

// Tool: Login (returns session info)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }

    const result = await authenticateUser(email, password);
    
    if (result.success && result.user && result.sessionToken) {
      res.json({
        success: true,
        message: "Login successful! Use the sessionToken for subsequent tool calls.",
        sessionToken: result.sessionToken,
        user: {
          id: result.user.user_id,
          email: result.user.email,
          username: result.user.username,
          accountBalance: result.user.account_balance,
          currency: result.user.currency,
          kycStatus: result.user.kyc_status
        },
        sessionInfo: {
          authenticated: true,
          loginTime: new Date().toISOString()
        }
      });
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Login failed"
    });
  }
});

// Tool: Logout (invalidates session)
router.post("/logout", async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: "Session token is required"
      });
    }

    const result = await AuthService.logout(sessionToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Logout failed"
    });
  }
});

// Tool: Get My Account Balance
router.post("/get_my_account_balance", async (req, res) => {
  try {
    const { email, password, sessionToken } = req.body;
    
    let authResult;
    
    // Support both session token and email/password authentication
    if (sessionToken) {
      authResult = await authenticateByToken(sessionToken);
    } else if (email && password) {
      authResult = await authenticateUser(email, password);
    } else {
      return res.status(400).json({
        success: false,
        error: "Either sessionToken or email and password are required"
      });
    }
    
    if (!authResult.success || !authResult.user) {
      return res.status(401).json(authResult);
    }

    const user = authResult.user;
    
   
    // Fetch fresh user data from financialApp database
    const freshUserData = await UserService.getUserById(user.user_id);
    
    if (!freshUserData) {
      return res.status(404).json({
        success: false,
        error: `User data not found in financialApp database for user ID: ${user.user_id}`
      });
    }
    
    res.json({
      success: true,
      userId: freshUserData.user_id,
      email: freshUserData.email,
      username: freshUserData.username,
      accountBalance: freshUserData.account_balance,
      currency: freshUserData.currency,
      kycStatus: freshUserData.kyc_status,
      lastUpdated: freshUserData.updated_at,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get account balance"
    });
  }
});

// Tool: Update My Account Balance
router.post("/update_my_account_balance", async (req, res) => {
  try {
    const { email, password, sessionToken, amount } = req.body;
    
    if (amount === undefined) {
      return res.status(400).json({
        success: false,
        error: "Amount is required"
      });
    }

    let authResult;
    
    // Support both session token and email/password authentication
    if (sessionToken) {
      authResult = await authenticateByToken(sessionToken);
    } else if (email && password) {
      authResult = await authenticateUser(email, password);
    } else {
      return res.status(400).json({
        success: false,
        error: "Either sessionToken or email and password are required"
      });
    }
    
    if (!authResult.success || !authResult.user) {
      return res.status(401).json(authResult);
    }

    const userId = authResult.user.user_id;
    const updateSuccess = await UserService.updateAccountBalance(userId, amount);
    
    if (!updateSuccess) {
      return res.status(500).json({
        success: false,
        error: "Failed to update account balance"
      });
    }

    const updatedUser = await UserService.getUserById(userId);
    
    res.json({
      success: true,
      message: "Account balance updated successfully",
      userId: updatedUser?.user_id,
      newBalance: updatedUser?.account_balance,
      currency: updatedUser?.currency,
      updatedAt: updatedUser?.updated_at,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update account balance"
    });
  }
});

// Tool: Get My KYC Status
router.post("/get_my_kyc_status", async (req, res) => {
  try {
    const { email, password, sessionToken } = req.body;
    
    let authResult;
    
    // Support both session token and email/password authentication
    if (sessionToken) {
      authResult = await authenticateByToken(sessionToken);
    } else if (email && password) {
      authResult = await authenticateUser(email, password);
    } else {
      return res.status(400).json({
        success: false,
        error: "Either sessionToken or email and password are required"
      });
    }
    
    if (!authResult.success || !authResult.user) {
      return res.status(401).json(authResult);
    }

    const user = authResult.user;
    
    res.json({
      success: true,
      userId: user.user_id,
      email: user.email,
      username: user.username,
      kycStatus: user.kyc_status,
      lastUpdated: user.updated_at,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get KYC status"
    });
  }
});

// Tool: Update My KYC Status
router.post("/update_my_kyc_status", async (req, res) => {
  try {
    const { email, password, sessionToken, status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required"
      });
    }

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'pending', 'approved', or 'rejected'"
      });
    }

    let authResult;
    
    // Support both session token and email/password authentication
    if (sessionToken) {
      authResult = await authenticateByToken(sessionToken);
    } else if (email && password) {
      authResult = await authenticateUser(email, password);
    } else {
      return res.status(400).json({
        success: false,
        error: "Either sessionToken or email and password are required"
      });
    }
    
    if (!authResult.success || !authResult.user) {
      return res.status(401).json(authResult);
    }

    const userId = authResult.user.user_id;
    const updateSuccess = await UserService.updateKycStatus(userId, status);
    
    if (!updateSuccess) {
      return res.status(500).json({
        success: false,
        error: "Failed to update KYC status"
      });
    }

    const updatedUser = await UserService.getUserById(userId);
    
    res.json({
      success: true,
      message: "KYC status updated successfully",
      userId: updatedUser?.user_id,
      newKycStatus: updatedUser?.kyc_status,
      updatedAt: updatedUser?.updated_at,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update KYC status"
    });
  }
});

// Tool Discovery Endpoint (MCP-style)
router.get("/list", (req, res) => {
  res.json({
    tools: [
      {
        name: "login",
        description: "Authenticate user and get session token. Session persists across tool calls.",
        endpoint: "/api/tools/login",
        method: "POST",
        parameters: ["email", "password"],
        returns: "sessionToken (use for subsequent calls)"
      },
      {
        name: "logout",
        description: "Invalidate session token and logout",
        endpoint: "/api/tools/logout",
        method: "POST",
        parameters: ["sessionToken"]
      },
      {
        name: "get_my_account_balance",
        description: "Get your account balance and financial information",
        endpoint: "/api/tools/get_my_account_balance",
        method: "POST",
        parameters: ["sessionToken OR (email + password)"],
        note: "Use sessionToken from login for better UX"
      },
      {
        name: "update_my_account_balance",
        description: "Update your account balance",
        endpoint: "/api/tools/update_my_account_balance",
        method: "POST",
        parameters: ["sessionToken OR (email + password)", "amount"],
        note: "Use sessionToken from login for better UX"
      },
      {
        name: "get_my_kyc_status",
        description: "Get your KYC verification status",
        endpoint: "/api/tools/get_my_kyc_status",
        method: "POST",
        parameters: ["sessionToken OR (email + password)"],
        note: "Use sessionToken from login for better UX"
      },
      {
        name: "update_my_kyc_status",
        description: "Update your KYC verification status",
        endpoint: "/api/tools/update_my_kyc_status",
        method: "POST",
        parameters: ["sessionToken OR (email + password)", "status"],
        note: "Use sessionToken from login for better UX"
      }
    ],
    authFlow: {
      step1: "Call /api/tools/login with email and password",
      step2: "Use returned sessionToken for all subsequent tool calls",
      step3: "Call /api/tools/logout when done (optional)"
    }
  });
});

export default router;