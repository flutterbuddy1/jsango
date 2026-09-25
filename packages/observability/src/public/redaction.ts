import type { RedactionOptions } from './types.js';

const DEFAULT_SENSITIVE_PATTERN =
  /(password|token|secret|hash|salt|credential|authorization|cookie|session|ssn|cvv|api[-_]?key|private[-_]?key|^key$)/i;

const DEFAULT_MASK = '[REDACTED]';

export class Redactor {
  private readonly pattern: RegExp;
  private readonly mask: string;

  constructor(options: RedactionOptions = {}) {
    if (options.pattern) {
      this.pattern = options.pattern;
    } else if (options.keys && options.keys.length > 0) {
      const escaped = options.keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      this.pattern = new RegExp(`^(${escaped})$`, 'i');
    } else {
      this.pattern = DEFAULT_SENSITIVE_PATTERN;
    }
    this.mask = options.mask ?? DEFAULT_MASK;
  }

  /**
   * Returns a deeply redacted copy of the input object.
   * Safe against circular references and never mutates original inputs.
   */
  public redact<T>(input: T): T {
    const seen = new WeakSet<object>();
    return this.redactRecursive(input, seen) as T;
  }

  /**
   * Redacts sensitive HTTP headers.
   */
  public redactHeaders(
    headers: Record<string, string | readonly string[] | undefined>
  ): Record<string, string | readonly string[]> {
    const result: Record<string, string | readonly string[]> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      if (this.pattern.test(key)) {
        result[key] = this.mask;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private redactRecursive(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags);
    }

    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.redactRecursive(item, seen));
    }

    const output: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (this.pattern.test(k)) {
        output[k] = this.mask;
      } else {
        output[k] = this.redactRecursive(v, seen);
      }
    }

    return output;
  }
}
