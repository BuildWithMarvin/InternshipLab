// src/services/authService.ts
import { oauthDbPool, mainDbPool } from "../lib/database";
import { PasswordVerifier } from "../lib/passwordVerifier";
import { UserService } from "./userService";
import { User, Session, UserProfile } from "../lib/auth";
import crypto from "crypto";

export class AuthService {
  
  /**
   * Login mit deiner users Tabelle und bcrypt Verification
   */
  static async login(email: string, password: string): Promise<
    | { success: true; user: User; session: Session; realUser: UserProfile }
    | { success: false; error: string }
  > {
    try {
      console.log(`🔐 AuthService.login: Attempting login for ${email}`);
      
      // 1. Hole User aus deiner users Tabelle
      const realUser = await UserService.getUserByEmail(email);
      if (!realUser) {
        console.log(`❌ User not found in users table: ${email}`);
        return { success: false, error: 'User not found' };
      }
      
      console.log(`👤 Found user: ${realUser.username} (ID: ${realUser.user_id})`);
      
      // 2. Verifiziere bcrypt Passwort
      const isValid = await PasswordVerifier.verify(password, realUser.password_hash);
      if (!isValid) {
        console.log(`❌ Invalid password for user: ${email}`);
        return { success: false, error: 'Invalid password' };
      }
      
      console.log(`✅ Password verified for: ${email}`);
      
      // 3. Erstelle oder finde OAuth User in better_auth_oauth DB
      const oauthUser = await this.findOrCreateOAuthUser(realUser);
      console.log(`📝 OAuth user ready: ${oauthUser.id}`);
      
      // 4. Erstelle neue Session
      const session = await this.createSession(oauthUser.id);
      console.log(`🎫 Session created: ${session.id}`);
      
      return {
        success: true,
        user: oauthUser,
        session: session,
        realUser: realUser
      };
      
    } catch (error) {
      console.error('❌ AuthService.login error:', error);
      return { success: false, error: 'Login failed - internal error' };
    }
  }
  
  /**
   * Validiere Session Token und hole User-Daten
   */
  static async validateSession(token: string) {
    try {
      console.log(`🔍 Validating session token: ${token.substring(0, 10)}...`);
      
      const [rows] = await oauthDbPool.execute(`
        SELECT 
          s.id as session_id,
          s.userId, 
          s.token,
          s.expiresAt,
          s.ipAddress,
          s.userAgent,
          u.email, 
          u.name, 
          u.emailVerified,
          u.externalUserId
        FROM session s
        JOIN user u ON s.userId = u.id
        WHERE s.token = ? AND s.expiresAt > NOW()
        LIMIT 1
      `, [token]);
      
      const sessions = rows as any[];
      if (sessions.length === 0) {
        console.log(`❌ Session not found or expired: ${token.substring(0, 10)}...`);
        return null;
      }
      
      const sessionData = sessions[0];
      console.log(`✅ Valid session found for user: ${sessionData.email}`);
      
      // Hole echte User-Daten aus deiner users Tabelle
      const realUser = await UserService.getUserById(sessionData.externalUserId);
      if (!realUser) {
        console.log(`❌ Real user not found for externalUserId: ${sessionData.externalUserId}`);
        return null;
      }
      
      return {
        session: {
          id: sessionData.session_id,
          userId: sessionData.userId,
          token: sessionData.token,
          expiresAt: sessionData.expiresAt,
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent
        },
        user: {
          id: sessionData.userId,
          email: sessionData.email,
          name: sessionData.name,
          emailVerified: sessionData.emailVerified
        },
        realUser: realUser
      };
      
    } catch (error) {
      console.error('❌ AuthService.validateSession error:', error);
      return null;
    }
  }
  
  /**
   * Logout - lösche Session aus OAuth DB
   */
  static async logout(token: string) {
    try {
      console.log(`🚪 AuthService.logout: ${token.substring(0, 10)}...`);
      
      const [result] = await oauthDbPool.execute(
        'DELETE FROM session WHERE token = ?',
        [token]
      );
      
      const deleteResult = result as any;
      console.log(`✅ Sessions deleted: ${deleteResult.affectedRows}`);
      
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('❌ AuthService.logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }
  
  /**
   * Registriere neuen User in deiner users Tabelle
   */
  static async register(userData: {
    username?: string;
    email: string;
    password: string;
    full_name?: string;
  }) {
    try {
      console.log(`📝 AuthService.register: ${userData.email}`);
      
      // 1. Prüfe ob User bereits existiert
      const existingUser = await UserService.getUserByEmail(userData.email);
      if (existingUser) {
        console.log(`❌ User already exists: ${userData.email}`);
        return { success: false, error: 'User already exists' };
      }
      
      // 2. Hash Passwort mit bcrypt
      console.log(`🔐 Hashing password for: ${userData.email}`);
      const hashedPassword = await PasswordVerifier.hash(userData.password);
      
      // 3. Erstelle User in deiner users Tabelle (angepasst an dein Schema)
      const [result] = await mainDbPool.execute(`
        INSERT INTO users (
          username, email, password_hash, full_name,
          phone_number, country, account_balance, currency, kyc_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userData.username || userData.email.split('@')[0], // Username fallback
        userData.email,
        hashedPassword,
        userData.full_name || null,        // NULL wenn leer
        null,                              // phone_number = NULL
        null,                              // country = NULL  
        0.00,                              // account_balance = 0.00 (Default)
        'USD',                             // currency = 'USD' (Default)
        'pending'                          // kyc_status = 'pending' (Default)
      ]);
      
      const insertResult = result as any;
      console.log(`✅ User registered successfully: ${userData.email} (ID: ${insertResult.insertId})`);
      
      return { 
        success: true, 
        userId: insertResult.insertId,
        message: 'User registered successfully'
      };
      
    } catch (error) {
      console.error('❌ AuthService.register error:', error);
      
      // MySQL spezifische Fehler behandeln
      if (error && typeof error === 'object' && 'code' in error) {
        const mysqlError = error as any;
        
        if (mysqlError.code === 'ER_DUP_ENTRY') {
          return { success: false, error: 'Email or username already exists' };
        }
        
        console.error('MySQL Error Code:', mysqlError.code);
        console.error('MySQL Error Message:', mysqlError.message);
      }
      
      return { success: false, error: 'Registration failed - internal error' };
    }
  }
  
  /**
   * PRIVATE: Finde oder erstelle OAuth User in better_auth_oauth DB
   */
  private static async findOrCreateOAuthUser(realUser: UserProfile): Promise<User> {
    try {
      console.log(`🔍 Looking for OAuth user: ${realUser.email}`);
      
      // Prüfe ob OAuth User bereits existiert
      const [rows] = await oauthDbPool.execute(
        'SELECT * FROM user WHERE email = ? LIMIT 1',
        [realUser.email]
      );
      
      const users = rows as any[];
      if (users.length > 0) {
        console.log(`✅ OAuth user already exists: ${realUser.email}`);
        return {
          id: users[0].id,
          email: users[0].email,
          name: users[0].name,
          emailVerified: users[0].emailVerified
        };
      }
      
      // Erstelle neuen OAuth User
      console.log(`📝 Creating new OAuth user: ${realUser.email}`);
      const userId = crypto.randomUUID();
      
      await oauthDbPool.execute(`
        INSERT INTO user (
          id, email, emailVerified, name, image,
          createdAt, updatedAt, externalUserId
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)
      `, [
        userId,
        realUser.email,
        realUser.kyc_status === 'verified', // KYC Status als emailVerified
        realUser.full_name || realUser.username,
        null, // Kein Avatar in deiner users Tabelle
        realUser.user_id // Mapping zu deiner echten users Tabelle
      ]);
      
      console.log(`✅ OAuth user created: ${userId}`);
      
      return {
        id: userId,
        email: realUser.email,
        name: realUser.full_name || realUser.username,
        emailVerified: realUser.kyc_status === 'verified'
      };
      
    } catch (error) {
      console.error('❌ Error finding/creating OAuth user:', error);
      throw error;
    }
  }
  
  /**
   * PRIVATE: Erstelle neue Session in OAuth DB
   */
  private static async createSession(userId: string): Promise<Session> {
    try {
      const sessionId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 Tage
      
      console.log(`🎫 Creating session for user: ${userId}`);
      
      await oauthDbPool.execute(`
        INSERT INTO session (
          id, userId, expiresAt, token,
          ipAddress, userAgent, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        sessionId,
        userId,
        expiresAt,
        token,
        null, // IP wird später gesetzt wenn verfügbar
        null  // UserAgent wird später gesetzt wenn verfügbar
      ]);
      
      console.log(`✅ Session created: ${sessionId}`);
      
      return {
        id: sessionId,
        userId: userId,
        expiresAt: expiresAt,
        token: token
      };
      
    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw error;
    }
  }
  
  /**
   * Hole Session mit vollständigen User-Daten (für MCP später)
   */
  static async getSessionWithFullUserData(token: string) {
    const sessionData = await this.validateSession(token);
    if (!sessionData) {
      return null;
    }
    
    return {
      session: sessionData.session,
      user: sessionData.user,
      realUser: sessionData.realUser, // Alle Daten aus deiner users Tabelle
      // Zusätzliche berechnete Felder
      computed: {
        isVerified: sessionData.realUser.kyc_status === 'verified',
        accountBalanceFormatted: `${sessionData.realUser.account_balance} ${sessionData.realUser.currency}`,
        daysSinceRegistration: Math.floor(
          (Date.now() - new Date(sessionData.realUser.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    };
  }
  
  /**
   * Debug: Teste Database Connections
   */
  static async testConnections() {
    try {
      console.log('🧪 Testing database connections...');
      
      // Test main DB
      const [mainResult] = await mainDbPool.execute('SELECT COUNT(*) as userCount FROM users');
      console.log('✅ Main DB (users):', mainResult);
      
      // Test OAuth DB
      const [oauthResult] = await oauthDbPool.execute('SELECT COUNT(*) as sessionCount FROM session');
      console.log('✅ OAuth DB (sessions):', oauthResult);
      
      return { success: true, connections: 'healthy' };
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return { success: false, error: 'Database connection failed' };
    }
  }
}