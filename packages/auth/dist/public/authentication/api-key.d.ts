import type { HttpRequest, RequestContext } from '@jsango/http';
import type { AuthenticationResult, IAuthenticationStrategy, Identity } from '../types.js';
export interface IApiKeyVerifier {
    verifyApiKey(hashedKey: string, rawKey: string): Promise<Identity | undefined>;
}
export interface ApiKeyAuthStrategyOptions {
    readonly verifier: IApiKeyVerifier;
    readonly headerName?: string | undefined;
}
export declare class ApiKeyAuthenticationStrategy implements IAuthenticationStrategy {
    readonly name = "api_key";
    readonly verifier: IApiKeyVerifier;
    readonly headerName: string;
    constructor(options: ApiKeyAuthStrategyOptions);
    authenticate(request: HttpRequest, _context: RequestContext): Promise<AuthenticationResult>;
}
//# sourceMappingURL=api-key.d.ts.map