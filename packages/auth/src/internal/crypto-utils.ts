import * as crypto from 'node:crypto';

export class CryptoUtils {
  /**
   * Generates a cryptographically secure random token string.
   */
  public static generateSecureToken(byteLength = 32): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Hashes a value with SHA-256 (used for API key hashing and token identification).
   */
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }
}
