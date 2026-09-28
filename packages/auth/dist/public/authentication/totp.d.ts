export interface TotpSecretResult {
    readonly secret: string;
    readonly uri: string;
    readonly qrCodeUrl: string;
}
export interface TotpSetupOptions {
    readonly issuer: string;
    readonly accountName: string;
    readonly secretLength?: number | undefined;
}
export interface TotpVerifyOptions {
    readonly window?: number | undefined;
    readonly stepSeconds?: number | undefined;
    readonly digits?: number | undefined;
}
/**
 * Base32 encoder according to RFC 4648.
 */
export declare function base32Encode(buffer: Buffer): string;
/**
 * Base32 decoder according to RFC 4648.
 */
export declare function base32Decode(base32: string): Buffer;
/**
 * TOTP (Time-Based One-Time Password) Service implementing RFC 6238 and RFC 4226.
 */
export declare class TotpService {
    /**
     * Generates a new cryptographic TOTP secret and corresponding otpauth:// URI.
     */
    generateSecret(options: TotpSetupOptions): TotpSecretResult;
    /**
     * Generates a TOTP code for the given secret at a specific timestamp.
     */
    generateToken(secret: string, timestampMs?: number, options?: TotpVerifyOptions): string;
    /**
     * Verifies a user-provided 6-digit TOTP code against the secret, allowing clock drift.
     */
    verifyToken(token: string, secret: string, options?: TotpVerifyOptions): boolean;
    /**
     * Generates a set of cryptographically secure emergency backup recovery codes.
     */
    generateBackupCodes(count?: number): string[];
    /**
     * Verifies and burns a backup recovery code.
     */
    verifyAndConsumeBackupCode(providedCode: string, storedCodes: string[]): {
        valid: boolean;
        remainingCodes: string[];
    };
}
//# sourceMappingURL=totp.d.ts.map