import type { RequestContext } from '@jsango/http';
import { AnonymousIdentity } from '../identity.js';
import { UnauthenticatedError } from '../errors.js';
import type { AuthContext, Identity } from '../types.js';

export const AUTH_CONTEXT_STATE_KEY = 'jsango:auth';

export function setAuthContext(ctx: RequestContext, authContext: AuthContext): void {
  ctx.state.set(AUTH_CONTEXT_STATE_KEY, authContext);
  if (ctx.container) {
    try {
      ctx.container.register('auth.identity', authContext.identity);
      ctx.container.register('auth.context', authContext);
    } catch {
      // Container may be locked or immutable in certain test scopes; state map is primary
    }
  }
}

export function getAuthContext(ctx: RequestContext): AuthContext | undefined {
  return ctx.state.get(AUTH_CONTEXT_STATE_KEY) as AuthContext | undefined;
}

export function getIdentity(ctx: RequestContext): Identity {
  const authCtx = getAuthContext(ctx);
  if (authCtx?.identity) {
    return authCtx.identity;
  }
  return new AnonymousIdentity();
}

export function requireIdentity(ctx: RequestContext): Identity {
  const identity = getIdentity(ctx);
  if (!identity.isAuthenticated) {
    throw new UnauthenticatedError('Authentication is required to access this resource.');
  }
  return identity;
}
