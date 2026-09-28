import type { HttpRequest, RequestContext } from '@jsango/http';
import type { AuthenticationResult, IAuthenticationStrategy } from '../types.js';
export interface AuthenticationManagerOptions {
    /**
     * Deterministic list of strategies to evaluate in order.
     */
    readonly strategies?: readonly IAuthenticationStrategy[] | undefined;
    /**
     * If true (default), when a strategy detects credentials intended for it but they are
     * invalid, expired, or malformed, the manager immediately halts and returns that failure,
     * preventing silent fall-through to weaker strategies.
     */
    readonly failOnError?: boolean | undefined;
}
export declare class AuthenticationManager {
    private readonly strategies;
    private readonly failOnError;
    constructor(options?: AuthenticationManagerOptions);
    registerStrategy(strategy: IAuthenticationStrategy): this;
    getStrategies(): readonly IAuthenticationStrategy[];
    authenticate(request: HttpRequest, context: RequestContext): Promise<AuthenticationResult>;
}
//# sourceMappingURL=manager.d.ts.map