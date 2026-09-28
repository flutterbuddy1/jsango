import type { MiddlewareHandler } from '@jsango/middleware';
import { AuthorizationManager } from '../authorization/manager.js';
import type { ResourceResolver, IPolicy } from '../types.js';
export interface AuthorizeMiddlewareOptions<TResource = unknown> {
    readonly action?: string | undefined;
    readonly resource?: TResource | ResourceResolver<TResource> | undefined;
    readonly policy?: string | IPolicy<TResource> | undefined;
    readonly manager?: AuthorizationManager | undefined;
}
export declare function authorize<TResource = unknown>(action: string, optionsOrResolver?: AuthorizeMiddlewareOptions<TResource> | ResourceResolver<TResource>): MiddlewareHandler;
//# sourceMappingURL=authorize.d.ts.map