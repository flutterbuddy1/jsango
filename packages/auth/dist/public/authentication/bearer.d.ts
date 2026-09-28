import type { HttpRequest, RequestContext } from '@jsango/http';
import type { AuthenticationResult, IAuthenticationStrategy, Identity } from '../types.js';
import type { JwtService, JwtPayload } from './jwt.js';
export interface ITokenVerifier {
    verifyToken(token: string): Promise<Identity | undefined>;
}
export declare class JwtTokenVerifier implements ITokenVerifier {
    private readonly jwt;
    private readonly identityResolver?;
    constructor(options: {
        jwt: JwtService;
        identityResolver?: (payload: JwtPayload) => Promise<Identity> | Identity;
    });
    verifyToken(token: string): Promise<Identity | undefined>;
}
export interface BearerAuthStrategyOptions {
    readonly verifier: ITokenVerifier;
    readonly realm?: string | undefined;
}
export declare class BearerTokenAuthenticationStrategy implements IAuthenticationStrategy {
    readonly name = "bearer";
    readonly verifier: ITokenVerifier;
    readonly realm: string;
    constructor(options: BearerAuthStrategyOptions);
    authenticate(request: HttpRequest, _context: RequestContext): Promise<AuthenticationResult>;
}
//# sourceMappingURL=bearer.d.ts.map