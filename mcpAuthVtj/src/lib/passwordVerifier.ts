// src/lib/passwordVerifier.ts
import bcrypt from 'bcryptjs';

export class PasswordVerifier {
  /**
   * Verifiziert ein Klartext-Passwort gegen einen Hash
   * Unterstützt bcrypt Formate ($2a$, $2b$, $2x$, $2y$)
   */
  static async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      // bcrypt Hashes erkennen (alle Varianten)
      if (hashedPassword.startsWith('$2')) {
        const isValid = await bcrypt.compare(plainPassword, hashedPassword);
        console.log(`bcrypt verification result: ${isValid}`);
        return isValid;
      }
      
      console.warn('Unexpected password hash format:', hashedPassword.substring(0, 10) + '...');
      console.warn('Expected bcrypt format starting with $2a$, $2b$, $2x$, or $2y$');
      return false;
      
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
  
  /**
   * Erstellt einen bcrypt Hash für ein Klartext-Passwort
   * Verwendet cost factor 12 für optimale Sicherheit
   */
  static async hash(plainPassword: string): Promise<string> {
    try {
      const hashed = await bcrypt.hash(plainPassword, 12);
      console.log(`Password hashed successfully: ${hashed.substring(0, 10)}...`);
      return hashed;
    } catch (error) {
      console.error('Password hashing error:', error);
      throw error;
    }
  }
  
  /**
   * Prüft ob ein Hash im bcrypt Format vorliegt
   */
  static isBcryptHash(hash: string): boolean {
    return /^\$2[abxy]\$\d{2}\$.{53}$/.test(hash);
  }
  
  /**
   * Extrahiert den cost factor aus einem bcrypt Hash
   */
  static getBcryptCost(hash: string): number | null {
    const match = hash.match(/^\$2[abxy]\$(\d{2})\$/);
    return match ? parseInt(match[1]) : null;
  }
  
  /**
   * Debug-Funktion für Hash-Analyse
   */
  static analyzeHash(hash: string): object {
    return {
      format: this.isBcryptHash(hash) ? 'bcrypt' : 'unknown',
      cost: this.getBcryptCost(hash),
      length: hash.length,
      prefix: hash.substring(0, 7),
      isValid: this.isBcryptHash(hash)
    };
  }
}