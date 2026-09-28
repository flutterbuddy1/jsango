import { AuthenticationError, UnauthenticatedError, InvalidCredentialsError, TokenExpiredError, SessionExpiredError, } from '../errors.js';
import { AuthenticationManager } from '../authentication/manager.js';
import { setAuthContext } from '../context/auth-context.js';
export function authenticate(optionsOrManager) {
    let manager;
    let required = true;
    if (optionsOrManager instanceof AuthenticationManager) {
        manager = optionsOrManager;
    }
    else if (optionsOrManager) {
        if (optionsOrManager.manager) {
            manager = optionsOrManager.manager;
        }
        else {
            manager = new AuthenticationManager({
                strategies: optionsOrManager.strategies,
            });
        }
        if (optionsOrManager.required !== undefined) {
            required = optionsOrManager.required;
        }
    }
    else {
        manager = new AuthenticationManager();
    }
    return async (ctx, next) => {
        const result = await manager.authenticate(ctx.request, ctx);
        const authContext = {
            identity: result.identity,
            result,
            strategyUsed: result.strategy,
            tenantId: result.identity.tenantId,
            metadata: result.metadata ?? {},
        };
        setAuthContext(ctx, authContext);
        if (result.status === 'authenticated') {
            return (await next());
        }
        // If authentication is optional (required === false), allow anonymous request to proceed
        if (!required) {
            return (await next());
        }
        // Required authentication failed - throw appropriate structured 401 error
        switch (result.status) {
            case 'unauthenticated':
                throw new UnauthenticatedError('Authentication credentials were not provided.');
            case 'invalid_credentials':
                throw new InvalidCredentialsError(result.error?.message ?? 'Invalid authentication credentials provided.');
            case 'expired_credentials':
                if (result.strategy === 'session') {
                    throw new SessionExpiredError();
                }
                throw new TokenExpiredError();
            case 'malformed_credentials':
                throw new AuthenticationError({
                    code: 'ERR_AUTH_MALFORMED_CREDENTIALS',
                    message: 'Malformed or invalid authentication credentials format.',
                    statusCode: 401,
                });
            default:
                throw new UnauthenticatedError('Authentication failed.');
        }
    };
}
//# sourceMappingURL=authenticate.js.map