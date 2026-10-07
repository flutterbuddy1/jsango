import type { HttpRequest, RequestContext } from '@jsango/http';
import { AnonymousIdentity, UserIdentity } from '../identity.js';
import type { AuthenticationResult, IAuthenticationStrategy, Identity } from '../types.js';
import type { JwtService, JwtPayload } from './jwt.js';
import { InvalidCredentialsError, TokenExpiredError } from '../errors.js';

export interface ITokenVerifier {
  verifyToken(token: string): Promise<Identity | undefined>;
}

export class JwtTokenVerifier implements ITokenVerifier {
  private readonly jwt: JwtService;
  private readonly identityResolver?:
    ((payload: JwtPayload) => Promise<Identity> | Identity) | undefined;

  private readonly allowNonExpiring: boolean;

  public constructor(options: {
    jwt: JwtService;
    identityResolver?: (payload: JwtPayload) => Promise<Identity> | Identity;
    /** Accept tokens without an `exp` claim. Default false. */
    allowNonExpiring?: boolean;
  }) {
    this.jwt = options.jwt;
    this.identityResolver = options.identityResolver;
    this.allowNonExpiring = options.allowNonExpiring ?? false;
  }

  public async verifyToken(token: string): Promise<Identity | undefined> {
    const payload = await this.jwt.verify(token);

    // Tokens that never expire cannot be revoked by time; refuse them unless explicitly allowed.
    if (typeof payload.exp !== 'number' && !this.allowNonExpiring) {
      throw new InvalidCredentialsError('JWT has no expiry (exp).');
    }

    if (this.identityResolver) {
      return this.identityResolver(payload);
    }

    const sub = payload.sub ?? (payload['id'] as string | undefined);
    if (!sub) {
      // Never authenticate a token that does not say who it is.
      return undefined;
    }
    const roles = Array.isArray(payload['roles']) ? (payload['roles'] as string[]) : [];
    const permissions = Array.isArray(payload['permissions'])
      ? (payload['permissions'] as string[])
      : [];
    const tenantId = typeof payload['tenantId'] === 'string' ? payload['tenantId'] : undefined;

    return new UserIdentity({
      id: sub,
      roles,
      permissions,
      tenantId,
      metadata: payload,
    });
  }
}

export interface BearerAuthStrategyOptions {
  readonly verifier: ITokenVerifier;
  readonly realm?: string | undefined;
}

export class BearerTokenAuthenticationStrategy implements IAuthenticationStrategy {
  public readonly name = 'bearer';
  public readonly verifier: ITokenVerifier;
  public readonly realm: string;

  public constructor(options: BearerAuthStrategyOptions) {
    this.verifier = options.verifier;
    this.realm = options.realm ?? 'Application';
  }

  public async authenticate(
    request: HttpRequest,
    _context: RequestContext
  ): Promise<AuthenticationResult> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        status: 'unauthenticated',
        identity: new AnonymousIdentity(),
        strategy: this.name,
      };
    }

    const parts = authHeader.trim().split(/\s+/);
    const scheme = parts[0]?.toLowerCase();
    if (scheme !== 'bearer') {
      return {
        status: 'unauthenticated',
        identity: new AnonymousIdentity(),
        strategy: this.name,
      };
    }

    if (parts.length < 2 || !parts[1] || parts[1].trim().length === 0) {
      return {
        status: 'malformed_credentials',
        identity: new AnonymousIdentity(),
        strategy: this.name,
      };
    }

    const token = parts[1].trim();

    try {
      const identity = await this.verifier.verifyToken(token);
      if (!identity) {
        return {
          status: 'invalid_credentials',
          identity: new AnonymousIdentity(),
          strategy: this.name,
        };
      }

      return {
        status: 'authenticated',
        identity,
        strategy: this.name,
      };
    } catch (err: unknown) {
      if (err instanceof TokenExpiredError) {
        return {
          status: 'expired_credentials',
          identity: new AnonymousIdentity(),
          strategy: this.name,
          error: err,
        };
      }

      return {
        status: 'invalid_credentials',
        identity: new AnonymousIdentity(),
        strategy: this.name,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}
