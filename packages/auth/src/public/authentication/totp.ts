import { createHmac, randomBytes } from 'node:crypto';
import { timingSafeEqualString } from '../../internal/timing.js';

export interface TotpSecretResult {
  readonly secret: string;
  readonly uri: string;
  readonly qrCodeUrl: string;
}

export interface TotpSetupOptions {
  readonly issuer: string;
  readonly accountName: string;
  readonly secretLength?: number | undefined;
}

export interface TotpVerifyOptions {
  readonly window?: number | undefined; // number of steps before/after to check (default: 1)
  readonly stepSeconds?: number | undefined; // default: 30
  readonly digits?: number | undefined; // default: 6
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 encoder according to RFC 4648.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 decoder according to RFC 4648.
 */
export function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    if (idx === -1) {
      continue; // skip unknown chars
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * TOTP (Time-Based One-Time Password) Service implementing RFC 6238 and RFC 4226.
 */
export class TotpService {
  /**
   * Generates a new cryptographic TOTP secret and corresponding otpauth:// URI.
   */
  public generateSecret(options: TotpSetupOptions): TotpSecretResult {
    const length = options.secretLength ?? 20; // 160-bit key recommended by RFC 4226
    const randomBuffer = randomBytes(length);
    const secret = base32Encode(randomBuffer);

    const encodedIssuer = encodeURIComponent(options.issuer);
    const encodedAccount = encodeURIComponent(options.accountName);
    const uri = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

    // SVG / QR representation URL (standard compatible format)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;

    return {
      secret,
      uri,
      qrCodeUrl,
    };
  }

  /**
   * Generates a TOTP code for the given secret at a specific timestamp.
   */
  public generateToken(secret: string, timestampMs = Date.now(), options?: TotpVerifyOptions): string {
    const step = options?.stepSeconds ?? 30;
    const digits = options?.digits ?? 6;
    const counter = Math.floor(timestampMs / 1000 / step);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const key = base32Decode(secret);
    const hmac = createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1]! & 0x0f;
    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);

    const otp = binary % 10 ** digits;
    return otp.toString().padStart(digits, '0');
  }

  /**
   * Verifies a user-provided 6-digit TOTP code against the secret, allowing clock drift.
   */
  public verifyToken(token: string, secret: string, options?: TotpVerifyOptions): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const cleanToken = token.trim().replace(/\s+/g, '');
    if (cleanToken.length !== (options?.digits ?? 6)) {
      return false;
    }

    const window = options?.window ?? 1;
    const step = options?.stepSeconds ?? 30;
    const now = Date.now();

    for (let i = -window; i <= window; i++) {
      const checkTime = now + i * step * 1000;
      const expectedToken = this.generateToken(secret, checkTime, options);
      if (timingSafeEqualString(cleanToken, expectedToken)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generates a set of cryptographically secure emergency backup recovery codes.
   */
  public generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const part1 = randomBytes(2).toString('hex').toUpperCase();
      const part2 = randomBytes(2).toString('hex').toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  /**
   * Verifies and burns a backup recovery code.
   */
  public verifyAndConsumeBackupCode(
    providedCode: string,
    storedCodes: string[]
  ): { valid: boolean; remainingCodes: string[] } {
    const clean = providedCode.trim().toUpperCase();
    const index = storedCodes.findIndex((c) => timingSafeEqualString(c.toUpperCase(), clean));

    if (index === -1) {
      return { valid: false, remainingCodes: storedCodes };
    }

    const remaining = [...storedCodes];
    remaining.splice(index, 1);
    return { valid: true, remainingCodes: remaining };
  }
}
