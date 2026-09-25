import { CacheSerializationError } from './errors.js';

export interface ICacheSerializer {
  serialize<T = unknown>(value: T): string;
  deserialize<T = unknown>(raw: string): T;
}

export interface SafeSerializerOptions {
  readonly maxValueBytes?: number | undefined;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Production-grade safe cache serializer.
 * Supports:
 * - Primitives (strings, numbers, booleans, null)
 * - Plain objects & arrays
 * - Explicit typed wrappers for Date and BigInt
 * - Defenses: Prototype pollution sanitization, bounded byte size, zero arbitrary code execution.
 */
export class SafeCacheSerializer implements ICacheSerializer {
  private readonly maxValueBytes: number;

  constructor(options: SafeSerializerOptions = {}) {
    this.maxValueBytes = options.maxValueBytes ?? 10 * 1024 * 1024; // 10MB default
  }

  public serialize<T = unknown>(value: T): string {
    if (value === undefined) {
      throw new CacheSerializationError('Cannot serialize undefined value into cache.');
    }

    let jsonString: string;
    try {
      jsonString = JSON.stringify(value, function (this: Record<string, unknown>, key, val) {
        const raw = key ? this[key] : val;
        if (typeof val === 'function' || typeof raw === 'function') {
          throw new Error('Executable functions and closures cannot be serialized into cache.');
        }
        if (typeof val === 'symbol' || typeof raw === 'symbol') {
          throw new Error('Symbols cannot be serialized into cache.');
        }
        if (typeof raw === 'bigint' || typeof val === 'bigint') {
          return {
            __type: 'bigint',
            value: ((raw as bigint | undefined) ?? (val as bigint)).toString(),
          };
        }
        if (raw instanceof Date) {
          return { __type: 'Date', value: raw.toISOString() };
        }
        return val;
      });
    } catch (err) {
      if (err instanceof CacheSerializationError) {
        throw err;
      }
      throw new CacheSerializationError(
        `Failed to serialize cache value: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    if (jsonString === undefined) {
      throw new CacheSerializationError('Value could not be serialized to valid JSON.');
    }

    if (this.maxValueBytes > 0 && Buffer.byteLength(jsonString, 'utf8') > this.maxValueBytes) {
      throw new CacheSerializationError(
        `Serialized cache value exceeds maximum allowed size of ${this.maxValueBytes} bytes.`
      );
    }

    return jsonString;
  }

  public deserialize<T = unknown>(raw: string): T {
    if (typeof raw !== 'string') {
      throw new CacheSerializationError('Expected serialized cache data to be a string.');
    }

    try {
      const parsed = JSON.parse(raw, (key, val) => {
        // Prototype pollution defense
        if (FORBIDDEN_KEYS.has(key)) {
          return undefined;
        }

        // Restore typed wrappers
        if (
          val !== null &&
          typeof val === 'object' &&
          '__type' in val &&
          typeof val.__type === 'string' &&
          'value' in val
        ) {
          if (val.__type === 'Date' && typeof val.value === 'string') {
            return new Date(val.value);
          }
          if (val.__type === 'bigint' && typeof val.value === 'string') {
            return BigInt(val.value);
          }
        }

        return val;
      });

      return parsed as T;
    } catch (err) {
      throw new CacheSerializationError(
        `Failed to deserialize cache payload: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }
}
