import * as crypto from 'node:crypto';

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keyLength: number,
  options: crypto.ScryptOptions
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export interface ScryptOptions {
  readonly cost?: number | undefined; // N: CPU/memory cost (must be power of 2, default: 16384 = 2^14)
  readonly blockSize?: number | undefined; // r: block size (default: 8)
  readonly parallelization?: number | undefined; // p: parallelization (default: 1)
  readonly keyLength?: number | undefined; // derived key length in bytes (default: 32)
  readonly saltLength?: number | undefined; // salt length in bytes (default: 16)
}

export class ScryptPasswordHasher implements IPasswordHasher {
  public readonly cost: number;
  public readonly blockSize: number;
  public readonly parallelization: number;
  public readonly keyLength: number;
  public readonly saltLength: number;

  public constructor(options: ScryptOptions = {}) {
    this.cost = options.cost ?? 16384; // 2^14
    this.blockSize = options.blockSize ?? 8;
    this.parallelization = options.parallelization ?? 1;
    this.keyLength = options.keyLength ?? 32;
    this.saltLength = options.saltLength ?? 16;
  }

  public async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    const derivedKey = await scryptAsync(password, salt, this.keyLength, {
      N: this.cost,
      r: this.blockSize,
      p: this.parallelization,
      maxmem: 32 * 1024 * 1024,
    });

    const log2N = Math.log2(this.cost);
    return `$scrypt$ln=${log2N},r=${this.blockSize},p=${this.parallelization}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
  }

  public async verify(password: string, hash: string): Promise<boolean> {
    const parts = hash.split('$');
    // Expected format: $scrypt$ln=...,r=...,p=...$<salt>$<key> -> 5 elements when split by $
    if (parts.length !== 5 || parts[1] !== 'scrypt') {
      return false;
    }

    const paramsStr = parts[2]!;
    const saltB64 = parts[3]!;
    const keyB64 = parts[4]!;

    let cost = this.cost;
    let blockSize = this.blockSize;
    let parallelization = this.parallelization;

    for (const param of paramsStr.split(',')) {
      const [k, v] = param.split('=');
      if (k === 'ln') {
        cost = Math.pow(2, parseInt(v!, 10));
      } else if (k === 'r') {
        blockSize = parseInt(v!, 10);
      } else if (k === 'p') {
        parallelization = parseInt(v!, 10);
      }
    }

    const salt = Buffer.from(saltB64, 'base64');
    const expectedKey = Buffer.from(keyB64, 'base64');

    try {
      const actualKey = (await scryptAsync(password, salt, expectedKey.length, {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 32 * 1024 * 1024,
      })) as Buffer;

      if (actualKey.length !== expectedKey.length) {
        // Equalize time before failing
        crypto.timingSafeEqual(expectedKey, expectedKey);
        return false;
      }

      return crypto.timingSafeEqual(actualKey, expectedKey);
    } catch {
      return false;
    }
  }

  public needsRehash(hash: string): boolean {
    const parts = hash.split('$');
    if (parts.length !== 5 || parts[1] !== 'scrypt') {
      return true;
    }

    const paramsStr = parts[2]!;
    let hashCost = 0;
    let hashBlockSize = 0;
    let hashParallelization = 0;

    for (const param of paramsStr.split(',')) {
      const [k, v] = param.split('=');
      if (k === 'ln') {
        hashCost = Math.pow(2, parseInt(v!, 10));
      } else if (k === 'r') {
        hashBlockSize = parseInt(v!, 10);
      } else if (k === 'p') {
        hashParallelization = parseInt(v!, 10);
      }
    }

    return (
      hashCost < this.cost ||
      hashBlockSize < this.blockSize ||
      hashParallelization < this.parallelization
    );
  }
}
