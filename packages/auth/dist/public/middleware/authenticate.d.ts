import type { MiddlewareHandler } from '@jsango/middleware';
import { AuthenticationManager } from '../authentication/manager.js';
import type { IAuthenticationStrategy } from '../types.js';
export interface AuthenticateOptions {
    readonly manager?: AuthenticationManager | undefined;
    readonly strategies?: readonly IAuthenticationStrategy[] | undefined;
    readonly required?: boolean | undefined;
}
export declare function authenticate(optionsOrManager?: AuthenticationManager | AuthenticateOptions): MiddlewareHandler;
//# sourceMappingURL=authenticate.d.ts.map