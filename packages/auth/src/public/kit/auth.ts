import * as crypto from 'node:crypto';
import { HttpResponse, type RequestContext } from '@jsango/http';
import { JwtService, type JwtPayload } from '../authentication/jwt.js';
import { ScryptPasswordHasher, type IPasswordHasher } from '../authentication/password.js';
import { TotpService } from '../authentication/totp.js';
import { AnonymousIdentity, UserIdentity, ServiceAccountIdentity } from '../identity.js';
import { getIdentity, setAuthContext } from '../context/auth-context.js';
import {
  AuthenticationError,
  ForbiddenError,
  InvalidCredentialsError,
  SessionExpiredError,
  TokenExpiredError,
  UnauthenticatedError,
} from '../errors.js';
import type { AuthContext, AuthenticationResult, Identity } from '../types.js';
import { MemoryAuthStore, type AuthStore } from './store.js';
import { JwksVerifier, type JwksVerifierOptions } from './jwks.js';
import {
  OAUTH_COOKIE,
  OAuthError,
  buildAuthorizeRequest,
  completeAuthorization,
  type OAuthProfile,
  type OAuthProvider,
} from './oauth.js';
import { Base64Url } from '../../internal/base64url.js';

/** Identity fields derived from your user record. */
export interface IdentityFields {
  readonly id: string | number;
  readonly roles?: readonly string[] | undefined;
  readonly permissions?: readonly string[] | undefined;
  readonly tenantId?: string | undefined;
  readonly isSuperuser?: boolean | undefined;
}

/** Authentication methods accepted by `auth.required()`. */
export type AuthMethod = 'bearer' | 'session' | 'apiKey' | 'external';

export interface CreateAuthOptions<TUser> {
  /**
   * At least 32 random characters (e.g. `openssl rand -base64 48`). Used to sign tokens and
   * cookies; changing it signs everyone out.
   */
  readonly secret: string;

  /** How to load users. `findByLogin` is needed for password login. */
  readonly users: {
    findById(id: string): Promise<TUser | null | undefined> | TUser | null | undefined;
    findByLogin?(login: string): Promise<TUser | null | undefined> | TUser | null | undefined;
    /** Return false to block a user (disabled, unverified, banned...). Checked on every login and refresh. */
    isActive?(user: TUser): boolean | Promise<boolean>;
  };

  /**
   * Maps a user record to identity fields. Default: `id`, `roles` (or `role`), `permissions`,
   * `tenantId`, `isSuperuser`.
   */
  readonly identity?: ((user: TUser) => IdentityFields) | undefined;

  /** Role -> permissions. `auth.required({ permissions })` also accepts permissions granted by roles. */
  readonly roles?: Readonly<Record<string, readonly string[]>> | undefined;

  readonly password?: {
    /** Field on the user that holds the password hash. Default `passwordHash`. */
    readonly field?: string | undefined;
    /** Default 8. */
    readonly minLength?: number | undefined;
    readonly hasher?: IPasswordHasher | undefined;
    /** Called with a fresh hash when the stored one uses outdated parameters. Save it. */
    readonly onRehash?: ((user: TUser, hash: string) => Promise<void> | void) | undefined;
  };

  /** Where sessions, refresh tokens, revocations and lockouts live. Default: in memory. */
  readonly store?: AuthStore | undefined;

  readonly tokens?: {
    /** Access token lifetime in seconds. Default 900 (15 minutes). */
    readonly accessTtl?: number | undefined;
    /** Refresh token lifetime in seconds. Default 30 days. */
    readonly refreshTtl?: number | undefined;
    /** `iss` claim. Default `jsango`. */
    readonly issuer?: string | undefined;
    /** `aud` claim. */
    readonly audience?: string | undefined;
  };

  readonly session?: {
    /** Default `jsango_session`. */
    readonly cookieName?: string | undefined;
    /** Session lifetime in seconds (sliding). Default 7 days. */
    readonly ttl?: number | undefined;
    /** Secure cookies. Default: true when NODE_ENV=production. */
    readonly secure?: boolean | undefined;
    readonly sameSite?: 'Strict' | 'Lax' | 'None' | undefined;
    readonly domain?: string | undefined;
    /**
     * Origins allowed to send cookie-authenticated POST/PUT/PATCH/DELETE requests (CSRF defense).
     * Default: the request's own origin.
     */
    readonly trustedOrigins?: readonly string[] | undefined;
  };

  /** API keys: look up the owner by the key's SHA-256 hash (store only the hash). */
  readonly apiKeys?: {
    find(hash: string): Promise<TUser | null | undefined> | TUser | null | undefined;
    /** Header to read. Default `x-api-key` (also accepts `Authorization: ApiKey <key>`). */
    readonly header?: string | undefined;
  };

  /**
   * Accept tokens from an external identity provider (Auth0, Clerk, Cognito, Firebase, Azure AD...).
   * `identity` maps the verified claims; by default `sub` becomes the id.
   */
  readonly external?: (JwksVerifierOptions & { identity?: (claims: JwtPayload) => IdentityFields }) | undefined;

  /** Social login providers (`google()`, `github()`, `oauthProvider()`). */
  readonly oauth?: readonly OAuthProvider[] | undefined;

  /** Brute-force protection for password and MFA attempts. Default 5 failures per 15 minutes. */
  readonly bruteForce?: { readonly maxAttempts?: number; readonly windowSeconds?: number } | false | undefined;

  /** TOTP two-factor authentication: field holding the user's TOTP secret. Default `totpSecret`. */
  readonly mfa?: { readonly field?: string | undefined } | undefined;

  /** Custom fetch (tests, proxies). */
  readonly fetch?: typeof fetch | undefined;
}

export interface TokenPair<TUser> {
  /** The signed-in user. Not enumerable, so returning the pair as JSON never leaks the user record (password hash, MFA secret). */
  readonly user: TUser;
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  /** Seconds until the access token expires. */
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly mfaRequired?: false;
}

export interface MfaChallenge {
  readonly mfaRequired: true;
  /** Short-lived token to pass to `auth.verifyMfa()` together with the 6-digit code. */
  readonly mfaToken: string;
}

export class TooManyAttemptsError extends AuthenticationError {
  public readonly retryAfterSeconds: number;
  public constructor(retryAfterSeconds: number) {
    super({
      code: 'ERR_AUTH_TOO_MANY_ATTEMPTS',
      message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      statusCode: 429,
      metadata: { retryAfterSeconds },
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// A valid scrypt hash of a random string: verifying against it costs the same as a real check.
let dummyHash: Promise<string> | undefined;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function random(bytes = 32): string {
  return Base64Url.encode(crypto.randomBytes(bytes));
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Complete, secure-by-default authentication: password login with access/refresh tokens,
 * cookie sessions, API keys, external identity providers (JWKS), social login (OAuth2 + PKCE)
 * and TOTP two-factor authentication. See `createAuth()`.
 */
export class Auth<TUser = Record<string, unknown>> {
  public readonly jwt: JwtService;
  public readonly totp = new TotpService();
  public readonly store: AuthStore;
  private readonly options: CreateAuthOptions<TUser>;
  private readonly hasher: IPasswordHasher;
  private readonly cookieKey: Buffer;
  private readonly external: JwksVerifier | undefined;
  private readonly providers = new Map<string, OAuthProvider>();

  public constructor(options: CreateAuthOptions<TUser>) {
    if (!options?.secret || options.secret.length < 32) {
      throw new Error('createAuth() needs a `secret` of at least 32 characters (e.g. `openssl rand -base64 48`).');
    }
    if (!options.users || typeof options.users.findById !== 'function') {
      throw new Error('createAuth() needs `users.findById(id)` to load users.');
    }
    this.options = options;
    // Independent keys per purpose, derived from the one secret.
    const derive = (label: string) => crypto.createHmac('sha256', options.secret).update(label).digest();
    this.jwt = new JwtService({ secret: derive('jsango:jwt').toString('base64'), allowedAlgorithms: ['HS256'] });
    this.cookieKey = derive('jsango:cookie');
    this.hasher = options.password?.hasher ?? new ScryptPasswordHasher();
    this.store = options.store ?? new MemoryAuthStore();
    this.external = options.external ? new JwksVerifier({ fetch: options.fetch, ...options.external }) : undefined;
    for (const p of options.oauth ?? []) this.providers.set(p.name, p);
    if (!options.store && process.env['NODE_ENV'] === 'production') {
      // eslint-disable-next-line no-console -- one-time startup warning
      console.warn('[jsango auth] Using the in-memory auth store in production: sessions, refresh tokens and lockouts are lost on restart and not shared between instances. Pass `store: new DatabaseAuthStore({ connection: db })`.');
    }
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  private get accessTtl(): number {
    return this.options.tokens?.accessTtl ?? 900;
  }
  private get refreshTtl(): number {
    return this.options.tokens?.refreshTtl ?? 30 * 24 * 3600;
  }
  private get sessionTtl(): number {
    return this.options.session?.ttl ?? 7 * 24 * 3600;
  }
  private get issuer(): string {
    return this.options.tokens?.issuer ?? 'jsango';
  }
  private get passwordField(): string {
    return this.options.password?.field ?? 'passwordHash';
  }
  private get mfaField(): string {
    return this.options.mfa?.field ?? 'totpSecret';
  }
  public get cookieName(): string {
    return this.options.session?.cookieName ?? 'jsango_session';
  }

  // ---------------------------------------------------------------------------
  // Passwords
  // ---------------------------------------------------------------------------

  /** Hashes a new password (scrypt). Enforces a minimum length and a sane maximum. */
  public async hashPassword(password: string): Promise<string> {
    const min = this.options.password?.minLength ?? 8;
    if (typeof password !== 'string' || password.length < min) {
      throw new AuthenticationError({ code: 'ERR_AUTH_WEAK_PASSWORD', message: `Password must be at least ${min} characters.`, statusCode: 422 });
    }
    if (password.length > 1024) {
      throw new AuthenticationError({ code: 'ERR_AUTH_WEAK_PASSWORD', message: 'Password is too long.', statusCode: 422 });
    }
    return this.hasher.hash(password);
  }

  public verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.hasher.verify(password, hash);
  }

  // ---------------------------------------------------------------------------
  // Identity mapping
  // ---------------------------------------------------------------------------

  private fields(user: TUser): IdentityFields {
    if (this.options.identity) return this.options.identity(user);
    const u = user as Record<string, unknown>;
    const roles = Array.isArray(u['roles']) ? (u['roles'] as string[]) : typeof u['role'] === 'string' ? [u['role']] : [];
    return {
      id: u['id'] as string | number,
      roles,
      permissions: Array.isArray(u['permissions']) ? (u['permissions'] as string[]) : [],
      tenantId: typeof u['tenantId'] === 'string' ? u['tenantId'] : undefined,
      isSuperuser: u['isSuperuser'] === true,
    };
  }

  /** The identity (roles, permissions, ...) a user record maps to. */
  public identityOf(user: TUser): Identity {
    return this.toIdentity(this.fields(user));
  }

  private toIdentity(fields: IdentityFields, metadata: Record<string, unknown> = {}): Identity {
    const roles = [...(fields.roles ?? [])];
    const fromRoles = roles.flatMap((r) => this.options.roles?.[r] ?? []);
    return new UserIdentity({
      id: String(fields.id),
      roles,
      permissions: [...new Set([...(fields.permissions ?? []), ...fromRoles])],
      tenantId: fields.tenantId,
      isSuperuser: fields.isSuperuser ?? false,
      metadata,
    });
  }

  private async isActive(user: TUser): Promise<boolean> {
    return this.options.users.isActive ? await this.options.users.isActive(user) : true;
  }

  // ---------------------------------------------------------------------------
  // Brute-force protection
  // ---------------------------------------------------------------------------

  private async guard(keys: string[]): Promise<void> {
    const cfg = this.options.bruteForce;
    if (cfg === false) return;
    const max = cfg?.maxAttempts ?? 5;
    for (const key of keys) {
      const count = Number((await this.store.get(`bf:${key}`)) ?? 0);
      if (count >= (key.startsWith('ip:') ? max * 4 : max)) {
        throw new TooManyAttemptsError(cfg?.windowSeconds ?? 900);
      }
    }
  }

  private async fail(keys: string[]): Promise<void> {
    if (this.options.bruteForce === false) return;
    const window = this.options.bruteForce?.windowSeconds ?? 900;
    for (const key of keys) await this.store.increment(`bf:${key}`, window);
  }

  // ---------------------------------------------------------------------------
  // Password login, MFA, tokens
  // ---------------------------------------------------------------------------

  /**
   * Email/username + password login. Returns tokens, or an MFA challenge when the user has
   * two-factor authentication enabled. Throws a generic InvalidCredentialsError (401) on any
   * failure and TooManyAttemptsError (429) when locked out.
   */
  public async login(login: string, password: string, ctx?: RequestContext): Promise<TokenPair<TUser> | MfaChallenge> {
    if (!this.options.users.findByLogin) {
      throw new Error('Password login needs `users.findByLogin(login)` in createAuth().');
    }
    const normalized = String(login ?? '').trim().toLowerCase();
    const keys = [`login:${sha256(normalized)}`, ...(ctx?.request.ip ? [`ip:${ctx.request.ip}`] : [])];
    await this.guard(keys);

    const user = normalized ? await this.options.users.findByLogin(normalized) : undefined;
    const hash = user ? (user as Record<string, unknown>)[this.passwordField] : undefined;
    let ok = false;
    if (typeof hash === 'string' && hash) {
      ok = await this.hasher.verify(String(password ?? ''), hash);
    } else {
      // Same work as a real check, so response time does not reveal whether the account exists.
      dummyHash ??= new ScryptPasswordHasher().hash(random());
      await this.hasher.verify(String(password ?? ''), await dummyHash);
    }

    if (!ok || !user || !(await this.isActive(user))) {
      await this.fail(keys);
      throw new InvalidCredentialsError('Invalid login or password.');
    }
    await this.store.delete(`bf:${keys[0]}`);

    if (this.hasher.needsRehash(hash as string) && this.options.password?.onRehash) {
      await this.options.password.onRehash(user, await this.hasher.hash(String(password)));
    }

    if (this.mfaEnabled(user)) {
      const sub = String(this.fields(user).id);
      const mfaToken = this.jwt.sign({ sub, typ: 'mfa' }, { expiresInSeconds: 300, issuer: this.issuer, jwtId: random(12) });
      return { mfaRequired: true, mfaToken };
    }
    return this.issueTokens(user);
  }

  private mfaEnabled(user: TUser): boolean {
    const secret = (user as Record<string, unknown>)[this.mfaField];
    return typeof secret === 'string' && secret.length > 0;
  }

  /** Completes a login that returned `mfaRequired` with the user's 6-digit TOTP code. */
  public async verifyMfa(mfaToken: string, code: string): Promise<TokenPair<TUser>> {
    const claims = await this.jwt.verify(mfaToken, { issuer: this.issuer });
    if (claims['typ'] !== 'mfa' || !claims.sub) throw new InvalidCredentialsError('Invalid MFA token.');
    const keys = [`mfa:${claims.sub}`];
    await this.guard(keys);
    const user = await this.options.users.findById(claims.sub);
    const secret = user ? (user as Record<string, unknown>)[this.mfaField] : undefined;
    const valid = typeof secret === 'string' && this.totp.verifyToken(String(code ?? ''), secret, { window: 1 });
    // Each code works once (replay protection within its validity window).
    const usedKey = `mfa-used:${claims.sub}:${String(code)}`;
    if (!valid || !user || (await this.store.get(usedKey)) || !(await this.isActive(user))) {
      await this.fail(keys);
      throw new InvalidCredentialsError('Invalid authentication code.');
    }
    await this.store.set(usedKey, '1', 120);
    await this.store.delete(`bf:${keys[0]}`);
    return this.issueTokens(user);
  }

  /** Issues an access token and a rotating refresh token for a user (e.g. after sign-up or OAuth). */
  public async issueTokens(user: TUser): Promise<TokenPair<TUser>> {
    const fields = this.fields(user);
    const sub = String(fields.id);
    const family = random(18);
    const refreshToken = `${family}.${random(32)}`;
    await this.store.set(`rf:${family}`, JSON.stringify({ sub, hash: sha256(refreshToken), iat: Date.now() }), this.refreshTtl);
    return withHiddenUser(user, {
      tokenType: 'Bearer',
      accessToken: this.accessToken(fields, family),
      expiresIn: this.accessTtl,
      refreshToken,
    });
  }

  private accessToken(fields: IdentityFields, family: string): string {
    return this.jwt.sign(
      {
        sub: String(fields.id),
        typ: 'access',
        sid: family,
        iatMs: Date.now(), // millisecond precision for logoutAll() cutoffs
        roles: fields.roles ?? [],
        permissions: fields.permissions ?? [],
        ...(fields.tenantId ? { tenantId: fields.tenantId } : {}),
        ...(fields.isSuperuser ? { su: true } : {}),
      },
      {
        expiresInSeconds: this.accessTtl,
        issuer: this.issuer,
        audience: this.options.tokens?.audience,
        jwtId: random(12),
      }
    );
  }

  /**
   * Exchanges a refresh token for a new token pair. The refresh token rotates on every use;
   * presenting an already-used one (a stolen copy) revokes the whole login.
   */
  public async refresh(refreshToken: string): Promise<TokenPair<TUser>> {
    const family = String(refreshToken ?? '').split('.')[0] ?? '';
    const raw = family ? await this.store.get(`rf:${family}`) : undefined;
    if (!raw) throw new InvalidCredentialsError('Refresh token is invalid or expired.');
    const record = JSON.parse(raw) as { sub: string; hash: string; iat: number };
    if (!equal(record.hash, sha256(refreshToken))) {
      await this.store.delete(`rf:${family}`);
      throw new InvalidCredentialsError('Refresh token was already used. All sessions of this login were revoked; please sign in again.');
    }
    if (await this.revokedBefore(record.sub, record.iat)) {
      await this.store.delete(`rf:${family}`);
      throw new InvalidCredentialsError('This login was signed out.');
    }
    const user = await this.options.users.findById(record.sub);
    if (!user || !(await this.isActive(user))) {
      await this.store.delete(`rf:${family}`);
      throw new InvalidCredentialsError('User is no longer active.');
    }
    const next = `${family}.${random(32)}`;
    await this.store.set(`rf:${family}`, JSON.stringify({ sub: record.sub, hash: sha256(next), iat: record.iat }), this.refreshTtl);
    const fields = this.fields(user);
    return withHiddenUser(user, { tokenType: 'Bearer', accessToken: this.accessToken(fields, family), expiresIn: this.accessTtl, refreshToken: next });
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  /**
   * Signs out the current request: revokes its access token (immediately, not at expiry) and its
   * refresh token, or deletes its session. Pass the response to also clear the session cookie.
   */
  public async logout(ctx: RequestContext, response?: HttpResponse): Promise<void> {
    const meta = getIdentity(ctx).metadata;
    if (typeof meta['jti'] === 'string' && typeof meta['exp'] === 'number') {
      await this.store.set(`rv:${meta['jti']}`, '1', Math.max(1, meta['exp'] - Math.floor(Date.now() / 1000)));
    }
    if (typeof meta['sid'] === 'string') await this.store.delete(`rf:${meta['sid']}`);
    if (typeof meta['sessionId'] === 'string') await this.store.delete(`s:${meta['sessionId']}`);
    if (response) this.clearSessionCookie(response);
  }

  /** Revokes a refresh token (e.g. a mobile app signing out without an access token). */
  public async revokeRefreshToken(refreshToken: string): Promise<void> {
    const family = String(refreshToken ?? '').split('.')[0];
    if (family) await this.store.delete(`rf:${family}`);
  }

  /**
   * Signs a user out everywhere: every access token, refresh token and session issued before now
   * stops working. Use after a password change or when an account is compromised.
   */
  public async logoutAll(userId: string | number): Promise<void> {
    const ttl = Math.max(this.refreshTtl, this.sessionTtl, this.accessTtl);
    await this.store.set(`uv:${userId}`, String(Date.now()), ttl);
  }

  private async revokedBefore(sub: string, issuedAtMs: number): Promise<boolean> {
    const cutoff = await this.store.get(`uv:${sub}`);
    return cutoff !== undefined && issuedAtMs <= Number(cutoff);
  }

  // ---------------------------------------------------------------------------
  // Cookie sessions
  // ---------------------------------------------------------------------------

  /**
   * Creates a server-side session for the user and sets the session cookie on `response`
   * (HttpOnly, SameSite=Lax, Secure in production). The id is rotated on every login.
   */
  public async startSession<R extends HttpResponse>(response: R, user: TUser): Promise<R> {
    const id = random(32);
    const sub = String(this.fields(user).id);
    await this.store.set(`s:${id}`, JSON.stringify({ sub, iat: Date.now(), seen: Date.now() }), this.sessionTtl);
    response.setCookie(this.cookieName, this.signCookie(id), {
      httpOnly: true,
      secure: this.options.session?.secure ?? process.env['NODE_ENV'] === 'production',
      sameSite: this.options.session?.sameSite ?? 'Lax',
      path: '/',
      maxAge: this.sessionTtl,
      ...(this.options.session?.domain ? { domain: this.options.session.domain } : {}),
    });
    return response;
  }

  public clearSessionCookie<R extends HttpResponse>(response: R): R {
    response.deleteCookie(this.cookieName, { path: '/', ...(this.options.session?.domain ? { domain: this.options.session.domain } : {}) });
    return response;
  }

  private signCookie(value: string): string {
    const mac = Base64Url.encode(crypto.createHmac('sha256', this.cookieKey).update(value).digest());
    return `${value}.${mac}`;
  }

  private unsignCookie(signed: string | undefined): string | undefined {
    if (!signed) return undefined;
    const i = signed.lastIndexOf('.');
    if (i <= 0) return undefined;
    const value = signed.slice(0, i);
    return equal(this.signCookie(value), signed) ? value : undefined;
  }

  // ---------------------------------------------------------------------------
  // API keys
  // ---------------------------------------------------------------------------

  /**
   * Generates an API key. Show `key` to the user once; store only `hash` (and `prefix` / `last4`
   * to help users recognize it).
   */
  public createApiKey(prefix = 'jsk'): { key: string; hash: string; prefix: string; last4: string } {
    if (!/^[a-z0-9]{1,12}$/i.test(prefix)) throw new Error('API key prefix must be 1-12 letters or digits.');
    const key = `${prefix}_${random(32)}`;
    return { key, hash: sha256(key), prefix, last4: key.slice(-4) };
  }

  /** SHA-256 hash of an API key, as passed to `apiKeys.find()`. */
  public hashApiKey(key: string): string {
    return sha256(key);
  }

  // ---------------------------------------------------------------------------
  // Social login (OAuth2)
  // ---------------------------------------------------------------------------

  /** Social login: `auth.oauth.redirect('google')` and `auth.oauth.callback('google', ctx)`. */
  public readonly oauth = {
    /** Redirects the browser to the provider's consent screen. */
    redirect: (providerName: string): HttpResponse => {
      const provider = this.provider(providerName);
      const { url, state, verifier } = buildAuthorizeRequest(provider);
      const response = HttpResponse.redirect(url);
      response.setCookie(OAUTH_COOKIE, this.signCookie(Base64Url.encode(JSON.stringify({ p: provider.name, state, verifier }))), {
        httpOnly: true,
        secure: this.options.session?.secure ?? process.env['NODE_ENV'] === 'production',
        sameSite: 'Lax', // must survive the top-level redirect back from the provider
        path: '/',
        maxAge: 600,
      });
      return response;
    },

    /**
     * Handles the provider's redirect back: checks `state` (CSRF), exchanges the code with PKCE
     * and returns the user's profile. Then find or create your user and call issueTokens() or
     * startSession().
     */
    callback: async (providerName: string, ctx: RequestContext): Promise<OAuthProfile> => {
      const provider = this.provider(providerName);
      const error = ctx.request.query.get('error');
      if (error) throw new OAuthError(`${provider.name} sign-in was cancelled or failed: ${error}`);
      const code = ctx.request.query.get('code');
      const state = ctx.request.query.get('state');
      const cookie = this.unsignCookie(ctx.request.cookies[OAUTH_COOKIE]);
      if (!code || !state || !cookie) throw new OAuthError('Missing OAuth code or state; start the sign-in again.');
      const saved = JSON.parse(Base64Url.decode(cookie)) as { p: string; state: string; verifier: string };
      if (saved.p !== provider.name || !equal(saved.state, state)) {
        throw new OAuthError('OAuth state mismatch; start the sign-in again.');
      }
      return completeAuthorization(provider, code, saved.verifier, this.options.fetch ?? fetch);
    },
  };

  private provider(name: string): OAuthProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`OAuth provider '${name}' is not configured. Add it to createAuth({ oauth: [...] }).`);
    return provider;
  }

  // ---------------------------------------------------------------------------
  // Request authentication
  // ---------------------------------------------------------------------------

  /**
   * Authenticates a request with every configured method (bearer token, session cookie, API key,
   * external provider). Credentials that are present but wrong always fail; they never fall back
   * to anonymous access.
   */
  public async authenticate(ctx: RequestContext, methods?: readonly AuthMethod[]): Promise<AuthenticationResult> {
    const allow = (m: AuthMethod) => !methods || methods.includes(m);
    const anonymous = (): AuthenticationResult => ({ status: 'unauthenticated', identity: new AnonymousIdentity() });
    const failed = (status: AuthenticationResult['status'], strategy: string, message: string): AuthenticationResult => ({
      status,
      strategy,
      identity: new AnonymousIdentity(),
      error: new Error(message),
    });

    const authorization = ctx.request.headers.get('authorization') ?? '';
    const bearer = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];

    if (bearer && (allow('bearer') || allow('external'))) {
      const issuer = this.peekIssuer(bearer);
      if (this.external && issuer !== this.issuer && allow('external')) {
        try {
          const claims = await this.external.verify(bearer);
          const fields = this.options.external?.identity?.(claims) ?? {
            id: String(claims.sub),
            roles: Array.isArray(claims['roles']) ? (claims['roles'] as string[]) : [],
            permissions: Array.isArray(claims['permissions']) ? (claims['permissions'] as string[]) : [],
          };
          if (!fields.id) return failed('invalid_credentials', 'external', 'Token has no subject.');
          return { status: 'authenticated', strategy: 'external', identity: this.toIdentity(fields, { ...claims }) };
        } catch (err) {
          return failed(err instanceof TokenExpiredError ? 'expired_credentials' : 'invalid_credentials', 'external', err instanceof Error ? err.message : String(err));
        }
      }
      if (allow('bearer')) {
        try {
          const claims = await this.jwt.verify(bearer, { issuer: this.issuer, audience: this.options.tokens?.audience });
          if (claims['typ'] !== 'access' || !claims.sub || typeof claims.exp !== 'number') {
            return failed('invalid_credentials', 'bearer', 'Not an access token.');
          }
          if (claims.jti && (await this.store.get(`rv:${claims.jti}`))) {
            return failed('invalid_credentials', 'bearer', 'Token was revoked.');
          }
          const issuedAt = typeof claims['iatMs'] === 'number' ? claims['iatMs'] : (claims.iat ?? 0) * 1000;
          if (await this.revokedBefore(claims.sub, issuedAt)) {
            return failed('invalid_credentials', 'bearer', 'Token was revoked.');
          }
          return {
            status: 'authenticated',
            strategy: 'bearer',
            identity: this.toIdentity(
              {
                id: claims.sub,
                roles: claims['roles'] as string[] | undefined,
                permissions: claims['permissions'] as string[] | undefined,
                tenantId: claims['tenantId'] as string | undefined,
                isSuperuser: claims['su'] === true,
              },
              { ...claims }
            ),
          };
        } catch (err) {
          return failed(err instanceof TokenExpiredError ? 'expired_credentials' : 'invalid_credentials', 'bearer', err instanceof Error ? err.message : String(err));
        }
      }
    }

    if (this.options.apiKeys && allow('apiKey')) {
      const header = (this.options.apiKeys.header ?? 'x-api-key').toLowerCase();
      const key = ctx.request.headers.get(header) ?? /^ApiKey\s+(\S+)$/i.exec(authorization)?.[1];
      if (key) {
        const owner = await this.options.apiKeys.find(sha256(key));
        if (!owner) return failed('invalid_credentials', 'apiKey', 'Invalid API key.');
        const fields = this.fields(owner);
        const identity = new ServiceAccountIdentity({
          id: String(fields.id),
          roles: [...(fields.roles ?? [])],
          permissions: [...new Set([...(fields.permissions ?? []), ...(fields.roles ?? []).flatMap((r) => this.options.roles?.[r] ?? [])])],
          tenantId: fields.tenantId,
          metadata: { apiKeyHashPrefix: sha256(key).slice(0, 8) },
        });
        return { status: 'authenticated', strategy: 'apiKey', identity };
      }
    }

    const cookie = ctx.request.cookies[this.cookieName];
    if (cookie && allow('session')) {
      const id = this.unsignCookie(cookie);
      const raw = id ? await this.store.get(`s:${id}`) : undefined;
      if (!id || !raw) return failed('expired_credentials', 'session', 'Session expired.');
      const session = JSON.parse(raw) as { sub: string; iat: number; seen: number };
      if (await this.revokedBefore(session.sub, session.iat)) {
        await this.store.delete(`s:${id}`);
        return failed('expired_credentials', 'session', 'Session was signed out.');
      }
      if (UNSAFE_METHODS.has(ctx.request.method) && !this.trustedOrigin(ctx)) {
        return failed('invalid_credentials', 'session', 'Cross-site request blocked (untrusted Origin).');
      }
      const user = await this.options.users.findById(session.sub);
      if (!user || !(await this.isActive(user))) {
        await this.store.delete(`s:${id}`);
        return failed('expired_credentials', 'session', 'User is no longer active.');
      }
      // Sliding expiration, refreshed at most every few minutes.
      if (Date.now() - session.seen > 5 * 60_000) {
        await this.store.set(`s:${id}`, JSON.stringify({ ...session, seen: Date.now() }), this.sessionTtl);
      }
      ctx.state.set(USER_STATE_KEY, user);
      return { status: 'authenticated', strategy: 'session', identity: this.toIdentity(this.fields(user), { sessionId: id }) };
    }

    return anonymous();
  }

  private peekIssuer(token: string): string | undefined {
    try {
      return JSON.parse(Base64Url.decode(token.split('.')[1] ?? ''))['iss'];
    } catch {
      return undefined;
    }
  }

  private trustedOrigin(ctx: RequestContext): boolean {
    const origin = ctx.request.headers.get('origin') ?? (() => {
      const referer = ctx.request.headers.get('referer');
      try {
        return referer ? new URL(referer).origin : undefined;
      } catch {
        return undefined;
      }
    })();
    if (!origin) return false;
    const trusted = this.options.session?.trustedOrigins ?? [ctx.request.url.origin];
    return trusted.includes(origin);
  }

  /**
   * Middleware that requires an authenticated request, optionally with roles / permissions:
   * `app.get('/admin', auth.required({ roles: ['admin'] }), handler)`.
   * Responds 401 when not authenticated and 403 when lacking a role or permission.
   */
  public required(options?: {
    readonly roles?: readonly string[];
    readonly permissions?: readonly string[];
    readonly methods?: readonly AuthMethod[];
  }) {
    return async (ctx: RequestContext, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
      const result = await this.authenticate(ctx, options?.methods);
      this.store_(ctx, result);
      if (result.status !== 'authenticated') {
        if (result.status === 'expired_credentials') {
          throw result.strategy === 'session' ? new SessionExpiredError() : new TokenExpiredError();
        }
        if (result.status === 'unauthenticated') throw new UnauthenticatedError('Authentication required.');
        throw new InvalidCredentialsError(result.error?.message ?? 'Invalid credentials.');
      }
      const identity = result.identity;
      if (options?.roles?.length && !identity.isSuperuser && !options.roles.some((r) => identity.hasRole(r))) {
        throw new ForbiddenError(`Requires one of the roles: ${options.roles.join(', ')}.`);
      }
      if (options?.permissions?.length && !options.permissions.every((p) => identity.hasPermission(p))) {
        throw new ForbiddenError(`Missing permission: ${options.permissions.filter((p) => !identity.hasPermission(p)).join(', ')}.`);
      }
      return next();
    };
  }

  /** Middleware that authenticates when credentials are sent but also allows anonymous requests. Invalid credentials still fail. */
  public optional(options?: { readonly methods?: readonly AuthMethod[] }) {
    return async (ctx: RequestContext, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
      const result = await this.authenticate(ctx, options?.methods);
      this.store_(ctx, result);
      if (result.status !== 'authenticated' && result.status !== 'unauthenticated') {
        throw result.status === 'expired_credentials' ? new TokenExpiredError() : new InvalidCredentialsError(result.error?.message ?? 'Invalid credentials.');
      }
      return next();
    };
  }

  private store_(ctx: RequestContext, result: AuthenticationResult): void {
    const context: AuthContext = {
      identity: result.identity,
      result,
      strategyUsed: result.strategy,
      tenantId: result.identity.tenantId,
      metadata: result.metadata ?? {},
    };
    setAuthContext(ctx, context);
  }

  /** The authenticated identity of the request (anonymous when not signed in). */
  public identity(ctx: RequestContext): Identity {
    return getIdentity(ctx);
  }

  /** Loads the signed-in user's record (cached for the request); null when anonymous. */
  public async user(ctx: RequestContext): Promise<TUser | null> {
    if (ctx.state.has(USER_STATE_KEY)) return ctx.state.get(USER_STATE_KEY) as TUser;
    const identity = getIdentity(ctx);
    if (!identity.isAuthenticated || identity.type === 'service_account') return null;
    const user = (await this.options.users.findById(identity.id)) ?? null;
    ctx.state.set(USER_STATE_KEY, user);
    return user;
  }
}

const USER_STATE_KEY = 'jsango:auth:user';

function withHiddenUser<TUser>(user: TUser, pair: Omit<TokenPair<TUser>, 'user'>): TokenPair<TUser> {
  return Object.defineProperty(pair, 'user', { value: user, enumerable: false }) as TokenPair<TUser>;
}

/**
 * Creates the application's authentication system.
 *
 * ```ts
 * export const auth = createAuth({
 *   secret: process.env.AUTH_SECRET!,
 *   users: {
 *     findById: (id) => User.find(id),
 *     findByLogin: (email) => User.where('email', email).first(),
 *   },
 * });
 *
 * app.post('/auth/login', async (ctx) => {
 *   const { email, password } = await ctx.request.json<{ email: string; password: string }>();
 *   return auth.login(email, password, ctx);
 * });
 * app.get('/me', auth.required(), (ctx) => auth.user(ctx));
 * ```
 */
export function createAuth<TUser = Record<string, unknown>>(options: CreateAuthOptions<TUser>): Auth<TUser> {
  return new Auth<TUser>(options);
}
