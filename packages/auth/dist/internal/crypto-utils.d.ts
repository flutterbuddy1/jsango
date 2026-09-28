export declare class CryptoUtils {
    /**
     * Generates a cryptographically secure random token string.
     */
    static generateSecureToken(byteLength?: number): string;
    /**
     * Hashes a value with SHA-256 (used for API key hashing and token identification).
     */
    static sha256(data: string): string;
}
//# sourceMappingURL=crypto-utils.d.ts.map