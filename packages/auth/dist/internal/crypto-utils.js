import * as crypto from 'node:crypto';
export class CryptoUtils {
    /**
     * Generates a cryptographically secure random token string.
     */
    static generateSecureToken(byteLength = 32) {
        return crypto.randomBytes(byteLength).toString('hex');
    }
    /**
     * Hashes a value with SHA-256 (used for API key hashing and token identification).
     */
    static sha256(data) {
        return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
    }
}
//# sourceMappingURL=crypto-utils.js.map