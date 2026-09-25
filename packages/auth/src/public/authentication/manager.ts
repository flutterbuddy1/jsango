import type { HttpRequest, RequestContext } from '@django-js/http';
import { AnonymousIdentity } from '../identity.js';
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

export class AuthenticationManager {
  private readonly strategies: IAuthenticationStrategy[] = [];
  private readonly failOnError: boolean;

  public constructor(options: AuthenticationManagerOptions = {}) {
    if (options.strategies) {
      this.strategies.push(...options.strategies);
    }
    this.failOnError = options.failOnError ?? true;
  }

  public registerStrategy(strategy: IAuthenticationStrategy): this {
    if (!this.strategies.some((s) => s.name === strategy.name)) {
      this.strategies.push(strategy);
    }
    return this;
  }

  public getStrategies(): readonly IAuthenticationStrategy[] {
    return Object.freeze([...this.strategies]);
  }

  public async authenticate(
    request: HttpRequest,
    context: RequestContext
  ): Promise<AuthenticationResult> {
    if (this.strategies.length === 0) {
      return {
        status: 'unauthenticated',
        identity: new AnonymousIdentity(),
      };
    }

    let lastFailure: AuthenticationResult | undefined;

    for (const strategy of this.strategies) {
      try {
        const result = await strategy.authenticate(request, context);

        if (result.status === 'authenticated') {
          return result;
        }

        if (result.status !== 'unauthenticated') {
          // A strategy found credentials intended for it but they failed (invalid, expired, malformed)
          lastFailure = result;
          if (this.failOnError) {
            return result;
          }
        }
      } catch (error) {
        const failureResult: AuthenticationResult = {
          status: 'invalid_credentials',
          identity: new AnonymousIdentity(),
          strategy: strategy.name,
          error: error instanceof Error ? error : new Error(String(error)),
        };

        if (this.failOnError) {
          return failureResult;
        }
        lastFailure = failureResult;
      }
    }

    if (lastFailure) {
      return lastFailure;
    }

    return {
      status: 'unauthenticated',
      identity: new AnonymousIdentity(),
    };
  }
}
