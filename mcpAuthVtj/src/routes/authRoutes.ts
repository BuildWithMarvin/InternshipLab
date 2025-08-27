// src/routes/authRoutes.ts
import { Router, Request, Response } from "express";
import { AuthService } from "../services/authService";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    console.log(`🔐 Login attempt for: ${email}`);
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }
    
    const result = await AuthService.login(email, password);
    
    if (result.success) {
      console.log(`✅ Login successful for: ${email}`);
      
      // Set HTTP cookie for browser session management
      res.cookie('auth_token', result.session.token, {
        httpOnly: false, // Allow JavaScript access for cross-page navigation
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
      });
      
      res.json({
        success: true,
        message: "Login successful",
        user: result.user,
        session: result.session,
        token: result.session.token,
        profile: {
          user_id: result.realUser.user_id,
          username: result.realUser.username,
          account_balance: result.realUser.account_balance,
          currency: result.realUser.currency,
          kyc_status: result.realUser.kyc_status
        }
      });
    } else {
      console.log(`❌ Login failed for: ${email} - ${result.error}`);
      
      res.status(401).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Login route error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

// GET /api/auth/me  
router.get("/me", async (req: Request, res: Response) => {
  try {
    // Support both Bearer token and cookie authentication
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.replace('Bearer ', '');
    const cookieToken = req.cookies?.auth_token;
    const token = bearerToken || cookieToken;
    
    console.log(`👤 Session check for token: ${token?.substring(0, 10)}...`);
    console.log(`🍪 Cookie token present: ${!!cookieToken}, Bearer token present: ${!!bearerToken}`);
    console.log(`🍪 All cookies:`, req.cookies);
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: "No authorization token provided" 
      });
    }
    
    const sessionData = await AuthService.validateSession(token);
    
    if (!sessionData) {
      console.log(`❌ Invalid/expired token: ${token.substring(0, 10)}...`);
      
      return res.status(401).json({ 
        success: false,
        error: "Invalid or expired token" 
      });
    }
    
    console.log(`✅ Valid session for user: ${sessionData.user.email}`);
    
    res.json({
      success: true,
      user: sessionData.user,
      session: sessionData.session,
      profile: {
        user_id: sessionData.realUser.user_id,
        username: sessionData.realUser.username,
        email: sessionData.realUser.email,
        full_name: sessionData.realUser.full_name,
        phone_number: sessionData.realUser.phone_number,
        country: sessionData.realUser.country,
        account_balance: sessionData.realUser.account_balance,
        currency: sessionData.realUser.currency,
        kyc_status: sessionData.realUser.kyc_status,
        created_at: sessionData.realUser.created_at,
        updated_at: sessionData.realUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Me route error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password, full_name } = req.body;
    
    console.log(`📝 Registration attempt for: ${email}`);
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long"
      });
    }
    
    const result = await AuthService.register({
      username,
      email,
      password,
      full_name
    });
    
    if (result.success) {
      console.log(`✅ Registration successful for: ${email}`);
      
      res.status(201).json({
        success: true,
        message: "User registered successfully",
        userId: result.userId
      });
    } else {
      console.log(`❌ Registration failed for: ${email} - ${result.error}`);
      
      res.status(409).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Register route error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  try {
    // Support both Bearer token and cookie authentication
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.replace('Bearer ', '');
    const cookieToken = req.cookies?.auth_token;
    const token = bearerToken || cookieToken;
    
    console.log(`🚪 Logout attempt for token: ${token?.substring(0, 10)}...`);
    
    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: "No authorization token provided" 
      });
    }
    
    const result = await AuthService.logout(token);
    
    if (result.success) {
      console.log(`✅ Logout successful for token: ${token.substring(0, 10)}...`);
      
      // Clear the auth cookie
      res.clearCookie('auth_token');
      
      res.json({
        success: true,
        message: "Logged out successfully"
      });
    } else {
      console.log(`❌ Logout failed for token: ${token.substring(0, 10)}...`);
      
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Logout route error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

// GET /api/auth/debug (Debug OAuth/User mapping)
router.get("/debug", async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.json({ error: "Please provide ?email=test@example.com" });
    }

    // Check main database
    const mainUser = await (await import("../services/userService")).UserService.getUserByEmail(email as string);
    
    // Check OAuth database
    const { oauthDbPool } = await import("../lib/database");
    const [oauthRows] = await oauthDbPool.execute(
      'SELECT id, email, name, externalUserId FROM user WHERE email = ?',
      [email]
    );

    res.json({
      mainUser: mainUser || "NOT FOUND",
      oauthUser: (oauthRows as any[])[0] || "NOT FOUND",
      mapping: mainUser && (oauthRows as any[])[0] 
        ? `Main ID: ${mainUser.user_id}, OAuth externalUserId: ${(oauthRows as any[])[0].externalUserId}`
        : "MAPPING BROKEN"
    });
  } catch (error) {
    res.json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/auth/status (Session Status Check)
router.get("/status", async (req: Request, res: Response) => {
  try {
    // Support both Bearer token and cookie authentication
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.replace('Bearer ', '');
    const cookieToken = req.cookies?.auth_token;
    const token = bearerToken || cookieToken;

    let sessionInfo = null;
    if (token) {
      sessionInfo = await AuthService.validateSession(token);
    }

    res.json({
      success: true,
      message: sessionInfo 
        ? `Session valid for ${sessionInfo.user.email}` 
        : "No active session",
      service: "AuthService",
      status: "running",
      session: {
        authenticated: !!sessionInfo,
        user: sessionInfo ? sessionInfo.user.email : null,
        tokenPresent: !!token,
        tokenSource: bearerToken ? 'header' : cookieToken ? 'cookie' : 'none'
      },
      features: {
        login: "✅ bcrypt password verification",
        register: "✅ new user creation", 
        session: "✅ token-based sessions",
        logout: "✅ session invalidation"
      },
      database: {
        main: "users table (your existing DB)",
        oauth: "better_auth_oauth (OAuth sessions)"
      },
      endpoints: {
        "POST /login": "Login with email/password",
        "GET /me": "Get current user info", 
        "POST /register": "Register new user",
        "POST /logout": "Logout and invalidate session",
        "GET /status": "Session status and service info"
      }
    });
  } catch (error) {
    console.error('❌ Status route error:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

export default router;