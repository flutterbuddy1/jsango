export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';
export interface JwtHeader {
    readonly alg: JwtAlgorithm;
    readonly typ: 'JWT';
    readonly kid?: string | undefined;
}
export interface JwtPayload {
    readonly sub?: string | undefined;
    readonly iss?: string | undefined;
    readonly aud?: string | readonly string[] | undefined;
    readonly exp?: number | undefined;
    readonly nbf?: number | undefined;
    readonly iat?: number | undefined;
    readonly jti?: string | undefined;
    readonly [key: string]: unknown;
}
export interface JwtSignOptions {
    readonly algorithm?: JwtAlgorithm | undefined;
    readonly expiresInSeconds?: number | undefined;
    readonly notBeforeSeconds?: number | undefined;
    readonly issuer?: string | undefined;
    readonly audience?: string | readonly string[] | undefined;
    readonly jwtId?: string | undefined;
}
export interface JwtVerifyOptions {
    readonly allowedAlgorithms?: readonly JwtAlgorithm[] | undefined;
    readonly issuer?: string | undefined;
    readonly audience?: string | readonly string[] | undefined;
    readonly clockToleranceSeconds?: number | undefined;
}
export interface ITokenRevocationStore {
    isRevoked(tokenId: string): Promise<boolean>;
    revoke(tokenId: string, expiresAt: number): Promise<void>;
}
export declare class JwtService {
    private readonly secret;
    private readonly defaultAlgorithm;
    private readonly allowedAlgorithms;
    private readonly revocationStore?;
    constructor(secretOrOptions: string | {
        secret: string;
        defaultAlgorithm?: JwtAlgorithm | undefined;
        allowedAlgorithms?: readonly JwtAlgorithm[] | undefined;
        revocationStore?: ITokenRevocationStore | undefined;
    }, additionalOptions?: {
        defaultAlgorithm?: JwtAlgorithm | undefined;
        allowedAlgorithms?: readonly JwtAlgorithm[] | undefined;
        revocationStore?: ITokenRevocationStore | undefined;
    });
    sign(payload: Record<string, unknown>, options?: JwtSignOptions): string;
    verify<T extends JwtPayload = JwtPayload>(token: string, options?: JwtVerifyOptions): Promise<T>;
    private createSignature;
}
export declare class MemoryTokenRevocationStore implements ITokenRevocationStore {
    private readonly revoked;
    isRevoked(tokenId: string): Promise<boolean>;
    revoke(tokenId: string, expiresAt: number): Promise<void>;
    clear(): void;
}
//# sourceMappingURL=jwt.d.ts.map