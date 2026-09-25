import type { MiddlewareHandler } from '@jsango/middleware';
import type { RequestContext, HttpResponse } from '@jsango/http';
import {
  AuthenticationError,
  UnauthenticatedError,
  InvalidCredentialsError,
  TokenExpiredError,
  SessionExpiredError,
} from '../errors.js';
import { AuthenticationManager } from '../authentication/manager.js';
import { setAuthContext } from '../context/auth-context.js';
import type { IAuthenticationStrategy, AuthContext } from '../types.js';

export interface AuthenticateOptions {
  readonly manager?: AuthenticationManager | undefined;
  readonly strategies?: readonly IAuthenticationStrategy[] | undefined;
  readonly required?: boolean | undefined;
}

export function authenticate(
  optionsOrManager?: AuthenticationManager | AuthenticateOptions
): MiddlewareHandler {
  let manager: AuthenticationManager;
  let required = true;

  if (optionsOrManager instanceof AuthenticationManager) {
    manager = optionsOrManager;
  } else if (optionsOrManager) {
    if (optionsOrManager.manager) {
      manager = optionsOrManager.manager;
    } else {
      manager = new AuthenticationManager({
        strategies: optionsOrManager.strategies,
      });
    }
    if (optionsOrManager.required !== undefined) {
      required = optionsOrManager.required;
    }
  } else {
    manager = new AuthenticationManager();
  }

  return async (ctx: RequestContext, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const result = await manager.authenticate(ctx.request, ctx);

    const authContext: AuthContext = {
      identity: result.identity,
      result,
      strategyUsed: result.strategy,
      tenantId: result.identity.tenantId,
      metadata: result.metadata ?? {},
    };

    setAuthContext(ctx, authContext);

    if (result.status === 'authenticated') {
      return (await next()) as HttpResponse;
    }

    // If authentication is optional (required === false), allow anonymous request to proceed
    if (!required) {
      return (await next()) as HttpResponse;
    }

    // Required authentication failed - throw appropriate structured 401 error
    switch (result.status) {
      case 'unauthenticated':
        throw new UnauthenticatedError('Authentication credentials were not provided.');
      case 'invalid_credentials':
        throw new InvalidCredentialsError(
          result.error?.message ?? 'Invalid authentication credentials provided.'
        );
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
