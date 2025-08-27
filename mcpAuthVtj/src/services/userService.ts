import { mainDbPool } from '../lib/database';
import { UserProfile } from '../types';
import { RowDataPacket } from 'mysql2/promise';

export class UserService {
  static async getUserById(userId: number): Promise<UserProfile | null> {
    try {
      const [rows] = await mainDbPool.execute(
        'SELECT * FROM users WHERE user_id = ? LIMIT 1',
        [userId]
      );
      
      const users = rows as any[];
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }
  
  static async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const [rows] = await mainDbPool.execute(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      
      const users = rows as any[];
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  
  static async updateUserProfile(userId: number, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const fields = [];
      const values = [];
      
      if (updates.full_name !== undefined) {
        fields.push('full_name = ?');
        values.push(updates.full_name);
      }
      if (updates.phone_number !== undefined) {
        fields.push('phone_number = ?');
        values.push(updates.phone_number);
      }
      if (updates.country !== undefined) {
        fields.push('country = ?');
        values.push(updates.country);
      }
      
      if (fields.length === 0) {
        return this.getUserById(userId);
      }
      
      values.push(userId);
      
      await mainDbPool.execute(
        `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
        values
      );
      
      return this.getUserById(userId);
    } catch (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
  }

  static async updateAccountBalance(userId: number, amount: number): Promise<boolean> {
    try {
      await mainDbPool.execute(
        'UPDATE users SET account_balance = ?, updated_at = NOW() WHERE user_id = ?',
        [amount, userId]
      );
      return true;
    } catch (error) {
      console.error('Error updating account balance:', error);
      return false;
    }
  }

  static async updateKycStatus(userId: number, status: 'pending' | 'approved' | 'rejected'): Promise<boolean> {
    try {
      await mainDbPool.execute(
        'UPDATE users SET kyc_status = ?, updated_at = NOW() WHERE user_id = ?',
        [status, userId]
      );
      return true;
    } catch (error) {
      console.error('Error updating KYC status:', error);
      return false;
    }
  }

  static async listUsers(limit: number = 10, offset: number = 0): Promise<UserProfile[]> {
    try {
      const [rows] = await mainDbPool.execute(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      
      return rows as UserProfile[];
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  static async getAllUsers(page: number = 1, limit: number = 10): Promise<UserProfile[]> {
    const offset = (page - 1) * limit;
    return this.listUsers(limit, offset);
  }
}