import type { RequestContext } from '@jsango/http';
import type { AuthContext, Identity } from '../types.js';
export declare const AUTH_CONTEXT_STATE_KEY = "jsango:auth";
export declare function setAuthContext(ctx: RequestContext, authContext: AuthContext): void;
export declare function getAuthContext(ctx: RequestContext): AuthContext | undefined;
export declare function getIdentity(ctx: RequestContext): Identity;
export declare function requireIdentity(ctx: RequestContext): Identity;
//# sourceMappingURL=auth-context.d.ts.map