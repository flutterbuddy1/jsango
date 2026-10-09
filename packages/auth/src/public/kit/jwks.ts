import * as crypto from 'node:crypto';
import { Base64Url } from '../../internal/base64url.js';
import { InvalidCredentialsError, TokenExpiredError } from '../errors.js';
import type { JwtPayload } from '../authentication/jwt.js';

export interface JwksVerifierOptions {
  /** e.g. `https://YOUR_TENANT.auth0.com/.well-known/jwks.json` */
  readonly jwksUrl: string;
  /** Expected `iss` claim (required: tokens from other issuers are rejected). */
  readonly issuer: string | readonly string[];
  /**
   * Expected `aud` claim (your API identifier / client id). Required: without it, tokens the same
   * provider issued for other apps (e.g. any Google sign-in) would be accepted. Pass `false` only
   * if your provider really issues no audience.
   */
  readonly audience: string | readonly string[] | false;
  readonly clockToleranceSeconds?: number | undefined;
  /** How long fetched keys are cached. Default 10 minutes. */
  readonly cacheSeconds?: number | undefined;
  readonly fetch?: typeof fetch | undefined;
}

const ALGORITHMS: Record<string, { hash: string | null; padding?: number; ieee?: boolean }> = {
  RS256: { hash: 'sha256' },
  RS384: { hash: 'sha384' },
  RS512: { hash: 'sha512' },
  PS256: { hash: 'sha256', padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
  PS384: { hash: 'sha384', padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
  PS512: { hash: 'sha512', padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
  ES256: { hash: 'sha256', ieee: true },
  ES384: { hash: 'sha384', ieee: true },
  ES512: { hash: 'sha512', ieee: true },
  EdDSA: { hash: null },
};

interface Jwk {
  readonly kid?: string;
  readonly kty: string;
  readonly use?: string;
  readonly alg?: string;
  readonly [key: string]: unknown;
}

/**
 * Verifies JWTs signed by an external identity provider (Auth0, Clerk, Cognito, Firebase, Azure AD,
 * Google, Keycloak, ...) using the provider's public JSON Web Key Set. Only asymmetric algorithms
 * are accepted, so a token can never be forged with a shared secret.
 */
export class JwksVerifier {
  private readonly options: JwksVerifierOptions;
  private keys = new Map<string, crypto.KeyObject>();
  private fetchedAt = 0;
  private attemptedAt = 0;
  private inflight: Promise<void> | undefined;

  public constructor(options: JwksVerifierOptions) {
    if (!options?.jwksUrl || !options.issuer) {
      throw new Error('JwksVerifier requires jwksUrl and issuer.');
    }
    if (options.audience === undefined) {
      throw new Error(
        'JwksVerifier requires audience (your API identifier / client id), or audience: false.'
      );
    }
    this.options = options;
  }

  private async load(force: boolean): Promise<void> {
    const ttl = (this.options.cacheSeconds ?? 600) * 1000;
    if (!force && this.keys.size > 0 && Date.now() - this.fetchedAt < ttl) return;
    // Rate-limit forced refreshes (unknown kid) to once every 30 seconds.
    if (force && Date.now() - this.attemptedAt < 30_000) return;
    this.inflight ??= (async () => {
      // Counts failed fetches too: a provider outage must not trigger a fetch per request.
      this.attemptedAt = Date.now();
      try {
        const res = await (this.options.fetch ?? fetch)(this.options.jwksUrl, {
          signal: AbortSignal.timeout(5_000), // a hanging provider must not hang every request
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { keys?: Jwk[] };
        const keys = new Map<string, crypto.KeyObject>();
        for (const jwk of body.keys ?? []) {
          if (jwk.use && jwk.use !== 'sig') continue;
          try {
            keys.set(
              jwk.kid ?? '',
              crypto.createPublicKey({
                key: jwk as unknown as crypto.JsonWebKeyInput['key'],
                format: 'jwk',
              })
            );
          } catch {
            // skip keys Node cannot import
          }
        }
        this.keys = keys;
        this.fetchedAt = Date.now();
      } finally {
        this.inflight = undefined;
      }
    })();
    await this.inflight;
  }

  public async verify<T extends JwtPayload = JwtPayload>(token: string): Promise<T> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new InvalidCredentialsError('Malformed JWT format.');
    const [h, p, s] = parts as [string, string, string];

    let header: { alg?: string; kid?: string };
    let payload: T;
    try {
      header = JSON.parse(Base64Url.decode(h));
      payload = JSON.parse(Base64Url.decode(p)) as T;
    } catch {
      throw new InvalidCredentialsError('Invalid JWT encoding.');
    }

    const alg = header.alg ? ALGORITHMS[header.alg] : undefined;
    if (!alg)
      throw new InvalidCredentialsError(`Disallowed JWT algorithm "${String(header.alg)}".`);

    let key: crypto.KeyObject | undefined;
    try {
      await this.load(false);
      key = this.keys.get(header.kid ?? '');
      if (!key) {
        await this.load(true); // the provider may have rotated its keys
        key = this.keys.get(header.kid ?? '');
      }
    } catch (err) {
      throw new InvalidCredentialsError(
        `Could not load signing keys: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (!key) throw new InvalidCredentialsError('Unknown JWT signing key.');

    const valid = crypto.verify(
      alg.hash,
      Buffer.from(`${h}.${p}`),
      {
        key,
        ...(alg.padding !== undefined
          ? { padding: alg.padding, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST }
          : {}),
        ...(alg.ieee ? { dsaEncoding: 'ieee-p1363' as const } : {}),
      },
      Base64Url.decodeToBuffer(s)
    );
    if (!valid) throw new InvalidCredentialsError('Invalid JWT signature.');

    const now = Math.floor(Date.now() / 1000);
    const tolerance = this.options.clockToleranceSeconds ?? 30;
    if (typeof payload.exp !== 'number')
      throw new InvalidCredentialsError('JWT has no expiry (exp).');
    if (now - tolerance >= payload.exp) throw new TokenExpiredError();
    if (typeof payload.nbf === 'number' && now + tolerance < payload.nbf) {
      throw new InvalidCredentialsError('JWT token is not active yet.');
    }
    const issuers =
      typeof this.options.issuer === 'string' ? [this.options.issuer] : this.options.issuer;
    if (!issuers.includes(String(payload.iss)))
      throw new InvalidCredentialsError('JWT issuer mismatch.');
    if (this.options.audience) {
      const expected =
        typeof this.options.audience === 'string' ? [this.options.audience] : this.options.audience;
      const actual = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!actual.some((a) => expected.includes(a as string))) {
        throw new InvalidCredentialsError('JWT audience mismatch.');
      }
    }
    return payload;
  }
}
