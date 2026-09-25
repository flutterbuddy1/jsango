import type { MiddlewareHandler } from '@jsango/middleware';
import type { RequestContext, HttpResponse } from '@jsango/http';
import { UnauthenticatedError, ForbiddenError } from '../errors.js';
import { AuthorizationManager } from '../authorization/manager.js';
import { getAuthContext, getIdentity } from '../context/auth-context.js';
import type { ResourceResolver, IPolicy } from '../types.js';

export interface AuthorizeMiddlewareOptions<TResource = unknown> {
  readonly action?: string | undefined;
  readonly resource?: TResource | ResourceResolver<TResource> | undefined;
  readonly policy?: string | IPolicy<TResource> | undefined;
  readonly manager?: AuthorizationManager | undefined;
}

export function authorize<TResource = unknown>(
  action: string,
  optionsOrResolver?: AuthorizeMiddlewareOptions<TResource> | ResourceResolver<TResource>
): MiddlewareHandler {
  let manager: AuthorizationManager;
  let resourceOrResolver: TResource | ResourceResolver<TResource> | undefined;
  let policyOverride: string | IPolicy<TResource> | undefined;

  if (typeof optionsOrResolver === 'function') {
    resourceOrResolver = optionsOrResolver as ResourceResolver<TResource>;
    manager = new AuthorizationManager();
  } else if (optionsOrResolver) {
    manager = optionsOrResolver.manager ?? new AuthorizationManager();
    resourceOrResolver = optionsOrResolver.resource;
    policyOverride = optionsOrResolver.policy;
  } else {
    manager = new AuthorizationManager();
  }

  return async (ctx: RequestContext, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const identity = getIdentity(ctx);

    // If request has not been authenticated, must return 401 Unauthorized, NOT 403 Forbidden
    if (!identity.isAuthenticated) {
      throw new UnauthenticatedError(
        'Authentication is required before accessing this protected resource.'
      );
    }

    // Resolve resource if resolver function provided
    let resolvedResource: unknown = resourceOrResolver;
    if (typeof resourceOrResolver === 'function') {
      resolvedResource = await (resourceOrResolver as ResourceResolver<TResource>)(ctx);
    }

    const authContext = getAuthContext(ctx);
    const decision = await manager.authorize(identity, action, resolvedResource, {
      context: authContext,
      policy: policyOverride as IPolicy | string | undefined,
    });

    if (!decision.allowed) {
      throw new ForbiddenError(
        decision.reason ?? `Access forbidden: not authorized for action "${action}".`
      );
    }

    return (await next()) as HttpResponse;
  };
}
