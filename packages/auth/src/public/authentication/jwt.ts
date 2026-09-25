import * as crypto from 'node:crypto';
import { Base64Url } from '../../internal/base64url.js';
import { InvalidCredentialsError, TokenExpiredError } from '../errors.js';

export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

export interface JwtHeader {
  readonly alg: JwtAlgorithm;
  readonly typ: 'JWT';
  readonly kid?: string | undefined;
}

export interface JwtPayload {
  readonly sub?: string | undefined;
  readonly iss?: string | undefined;
  readonly aud?: string | readonly string[] | undefined;
  readonly exp?: number | undefined;
  readonly nbf?: number | undefined;
  readonly iat?: number | undefined;
  readonly jti?: string | undefined;
  readonly [key: string]: unknown;
}

export interface JwtSignOptions {
  readonly algorithm?: JwtAlgorithm | undefined;
  readonly expiresInSeconds?: number | undefined;
  readonly notBeforeSeconds?: number | undefined;
  readonly issuer?: string | undefined;
  readonly audience?: string | readonly string[] | undefined;
  readonly jwtId?: string | undefined;
}

export interface JwtVerifyOptions {
  readonly allowedAlgorithms?: readonly JwtAlgorithm[] | undefined;
  readonly issuer?: string | undefined;
  readonly audience?: string | readonly string[] | undefined;
  readonly clockToleranceSeconds?: number | undefined;
}

export interface ITokenRevocationStore {
  isRevoked(tokenId: string): Promise<boolean>;
  revoke(tokenId: string, expiresAt: number): Promise<void>;
}

export class JwtService {
  private readonly secret: string;
  private readonly defaultAlgorithm: JwtAlgorithm;
  private readonly allowedAlgorithms: readonly JwtAlgorithm[];
  private readonly revocationStore?: ITokenRevocationStore | undefined;

  public constructor(
    secretOrOptions:
      | string
      | {
          secret: string;
          defaultAlgorithm?: JwtAlgorithm | undefined;
          allowedAlgorithms?: readonly JwtAlgorithm[] | undefined;
          revocationStore?: ITokenRevocationStore | undefined;
        },
    additionalOptions?: {
      defaultAlgorithm?: JwtAlgorithm | undefined;
      allowedAlgorithms?: readonly JwtAlgorithm[] | undefined;
      revocationStore?: ITokenRevocationStore | undefined;
    }
  ) {
    const options =
      typeof secretOrOptions === 'string'
        ? { secret: secretOrOptions, ...additionalOptions }
        : secretOrOptions;

    if (!options?.secret || options.secret.length < 16) {
      throw new Error('JWT secret must be at least 16 characters long for cryptographic safety.');
    }
    this.secret = options.secret;
    this.defaultAlgorithm = options.defaultAlgorithm ?? 'HS256';
    this.allowedAlgorithms = Object.freeze([
      ...(options.allowedAlgorithms ?? ['HS256', 'HS384', 'HS512']),
    ]);
    this.revocationStore = options.revocationStore;
  }

  public sign(payload: Record<string, unknown>, options: JwtSignOptions = {}): string {
    const algorithm = options.algorithm ?? this.defaultAlgorithm;
    if (!this.allowedAlgorithms.includes(algorithm)) {
      throw new Error(`Algorithm "${algorithm}" is not in the allowed algorithms list.`);
    }

    const now = Math.floor(Date.now() / 1000);
    const fullPayload: Record<string, unknown> = {
      ...payload,
      iat: payload['iat'] ?? now,
    };

    if (options.expiresInSeconds !== undefined) {
      fullPayload['exp'] = now + options.expiresInSeconds;
    }
    if (options.notBeforeSeconds !== undefined) {
      fullPayload['nbf'] = now + options.notBeforeSeconds;
    }
    if (options.issuer !== undefined) {
      fullPayload['iss'] = options.issuer;
    }
    if (options.audience !== undefined) {
      fullPayload['aud'] = options.audience;
    }
    if (options.jwtId !== undefined) {
      fullPayload['jti'] = options.jwtId;
    }

    const header: JwtHeader = {
      alg: algorithm,
      typ: 'JWT',
    };

    const encodedHeader = Base64Url.encode(JSON.stringify(header));
    const encodedPayload = Base64Url.encode(JSON.stringify(fullPayload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = this.createSignature(signingInput, algorithm);
    return `${signingInput}.${signature}`;
  }

  public async verify<T extends JwtPayload = JwtPayload>(
    token: string,
    options: JwtVerifyOptions = {}
  ): Promise<T> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new InvalidCredentialsError('Malformed JWT format.');
    }

    const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];

    // 1. Decode and validate header
    let header: JwtHeader;
    try {
      header = JSON.parse(Base64Url.decode(encodedHeader)) as JwtHeader;
    } catch {
      throw new InvalidCredentialsError('Invalid JWT header encoding.');
    }

    // Strict algorithm confusion defense
    const allowed = options.allowedAlgorithms ?? this.allowedAlgorithms;
    if (!header.alg || !allowed.includes(header.alg) || (header.alg as string) === 'none') {
      throw new InvalidCredentialsError(`Disallowed JWT algorithm "${header.alg}".`);
    }

    // 2. Constant-time signature verification
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.createSignature(signingInput, header.alg);

    const sigBuf = Base64Url.decodeToBuffer(signature);
    const expectedSigBuf = Base64Url.decodeToBuffer(expectedSignature);

    if (
      sigBuf.length !== expectedSigBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedSigBuf)
    ) {
      throw new InvalidCredentialsError('Invalid JWT signature.');
    }

    // 3. Decode and validate payload claims
    let payload: T;
    try {
      payload = JSON.parse(Base64Url.decode(encodedPayload)) as T;
    } catch {
      throw new InvalidCredentialsError('Invalid JWT payload encoding.');
    }

    const now = Math.floor(Date.now() / 1000);
    const tolerance = options.clockToleranceSeconds ?? 0;

    // Check expiration (exp)
    if (typeof payload.exp === 'number' && now - tolerance >= payload.exp) {
      throw new TokenExpiredError();
    }

    // Check not before (nbf)
    if (typeof payload.nbf === 'number' && now + tolerance < payload.nbf) {
      throw new InvalidCredentialsError('JWT token is not active yet.');
    }

    // Check issuer (iss)
    if (options.issuer && payload.iss !== options.issuer) {
      throw new InvalidCredentialsError(`JWT issuer mismatch: expected "${options.issuer}".`);
    }

    // Check audience (aud)
    if (options.audience) {
      const aud = payload.aud;
      const expectedAud = Array.isArray(options.audience) ? options.audience : [options.audience];
      const actualAud = Array.isArray(aud) ? aud : [aud];
      const match = actualAud.some((a) => expectedAud.includes(a as string));
      if (!match) {
        throw new InvalidCredentialsError('JWT audience mismatch.');
      }
    }

    // Check revocation (jti)
    if (this.revocationStore && payload.jti) {
      const isRevoked = await this.revocationStore.isRevoked(payload.jti);
      if (isRevoked) {
        throw new InvalidCredentialsError('JWT token has been revoked.');
      }
    }

    return payload;
  }

  private createSignature(signingInput: string, algorithm: JwtAlgorithm): string {
    const hmacAlgorithm =
      algorithm === 'HS256' ? 'sha256' : algorithm === 'HS384' ? 'sha384' : 'sha512';
    const hmac = crypto.createHmac(hmacAlgorithm, this.secret);
    hmac.update(signingInput);
    return Base64Url.encode(hmac.digest());
  }
}

export class MemoryTokenRevocationStore implements ITokenRevocationStore {
  private readonly revoked = new Map<string, number>();

  public async isRevoked(tokenId: string): Promise<boolean> {
    const expiresAt = this.revoked.get(tokenId);
    if (!expiresAt) {
      return false;
    }
    if (Date.now() / 1000 > expiresAt) {
      this.revoked.delete(tokenId);
      return false;
    }
    return true;
  }

  public async revoke(tokenId: string, expiresAt: number): Promise<void> {
    this.revoked.set(tokenId, expiresAt);
  }

  public clear(): void {
    this.revoked.clear();
  }
}
