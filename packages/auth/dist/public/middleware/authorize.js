import { UnauthenticatedError, ForbiddenError } from '../errors.js';
import { AuthorizationManager } from '../authorization/manager.js';
import { getAuthContext, getIdentity } from '../context/auth-context.js';
export function authorize(action, optionsOrResolver) {
    let manager;
    let resourceOrResolver;
    let policyOverride;
    if (typeof optionsOrResolver === 'function') {
        resourceOrResolver = optionsOrResolver;
        manager = new AuthorizationManager();
    }
    else if (optionsOrResolver) {
        manager = optionsOrResolver.manager ?? new AuthorizationManager();
        resourceOrResolver = optionsOrResolver.resource;
        policyOverride = optionsOrResolver.policy;
    }
    else {
        manager = new AuthorizationManager();
    }
    return async (ctx, next) => {
        const identity = getIdentity(ctx);
        // If request has not been authenticated, must return 401 Unauthorized, NOT 403 Forbidden
        if (!identity.isAuthenticated) {
            throw new UnauthenticatedError('Authentication is required before accessing this protected resource.');
        }
        // Resolve resource if resolver function provided
        let resolvedResource = resourceOrResolver;
        if (typeof resourceOrResolver === 'function') {
            resolvedResource = await resourceOrResolver(ctx);
        }
        const authContext = getAuthContext(ctx);
        const decision = await manager.authorize(identity, action, resolvedResource, {
            context: authContext,
            policy: policyOverride,
        });
        if (!decision.allowed) {
            throw new ForbiddenError(decision.reason ?? `Access forbidden: not authorized for action "${action}".`);
        }
        return (await next());
    };
}
//# sourceMappingURL=authorize.js.map