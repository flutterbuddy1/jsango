import { AnonymousIdentity } from '../identity.js';
import { UnauthenticatedError } from '../errors.js';
export const AUTH_CONTEXT_STATE_KEY = 'jsango:auth';
export function setAuthContext(ctx, authContext) {
    ctx.state.set(AUTH_CONTEXT_STATE_KEY, authContext);
    if (ctx.container) {
        try {
            ctx.container.register('auth.identity', authContext.identity);
            ctx.container.register('auth.context', authContext);
        }
        catch {
            // Container may be locked or immutable in certain test scopes; state map is primary
        }
    }
}
export function getAuthContext(ctx) {
    return ctx.state.get(AUTH_CONTEXT_STATE_KEY);
}
export function getIdentity(ctx) {
    const authCtx = getAuthContext(ctx);
    if (authCtx?.identity) {
        return authCtx.identity;
    }
    return new AnonymousIdentity();
}
export function requireIdentity(ctx) {
    const identity = getIdentity(ctx);
    if (!identity.isAuthenticated) {
        throw new UnauthenticatedError('Authentication is required to access this resource.');
    }
    return identity;
}
//# sourceMappingURL=auth-context.js.map