import { JsangoError } from '@jsango/core';

export type HeaderValue = string | readonly string[];

export class HttpHeaders {
  // Store lowercased key -> original case preserved name + string array of values
  private readonly headers = new Map<string, { originalName: string; values: string[] }>();

  constructor(initial?: Record<string, string | readonly string[] | undefined> | HttpHeaders) {
    if (initial instanceof HttpHeaders) {
      for (const [key, value] of initial.entries()) {
        this.append(key, value);
      }
    } else if (initial && typeof initial === 'object') {
      for (const [key, value] of Object.entries(initial)) {
        if (typeof value === 'undefined') continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            this.append(key, String(item));
          }
        } else {
          this.set(key, String(value));
        }
      }
    }
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new JsangoError({
        code: 'ERR_INVALID_HEADER_NAME',
        message: 'Header name must be a non-empty string.',
        statusCode: 400,
      });
    }

    // RFC 7230 token characters validation (prevents CRLF and control character injection)
    for (let i = 0; i < name.length; i++) {
      const code = name.charCodeAt(i);
      if (code <= 31 || code === 127) {
        throw new JsangoError({
          code: 'ERR_HEADER_INJECTION',
          message: `Header name contains invalid control characters or CRLF: "${name}"`,
          statusCode: 400,
        });
      }
    }
  }

  private validateValue(name: string, value: string): void {
    if (typeof value !== 'string') {
      throw new JsangoError({
        code: 'ERR_INVALID_HEADER_VALUE',
        message: `Header value for "${name}" must be a string.`,
        statusCode: 400,
      });
    }

    // Prevents HTTP Response Splitting / CRLF injection
    if (/[\r\n]/.test(value)) {
      throw new JsangoError({
        code: 'ERR_HEADER_INJECTION',
        message: `Header value for "${name}" contains forbidden CRLF characters.`,
        statusCode: 400,
      });
    }
  }

  public get(name: string): string | null {
    this.validateName(name);
    const entry = this.headers.get(name.toLowerCase());
    if (!entry || entry.values.length === 0) return null;
    return entry.values.join(', ');
  }

  public getAll(name: string): readonly string[] {
    this.validateName(name);
    const entry = this.headers.get(name.toLowerCase());
    return entry ? Object.freeze([...entry.values]) : [];
  }

  public has(name: string): boolean {
    this.validateName(name);
    return this.headers.has(name.toLowerCase());
  }

  public set(name: string, value: string): void {
    this.validateName(name);
    this.validateValue(name, value);
    const lower = name.toLowerCase();
    this.headers.set(lower, {
      originalName: name,
      values: [value],
    });
  }

  public append(name: string, value: string): void {
    this.validateName(name);
    this.validateValue(name, value);
    const lower = name.toLowerCase();
    const existing = this.headers.get(lower);
    if (existing) {
      existing.values.push(value);
    } else {
      this.headers.set(lower, {
        originalName: name,
        values: [value],
      });
    }
  }

  public delete(name: string): void {
    this.validateName(name);
    this.headers.delete(name.toLowerCase());
  }

  public *entries(): IterableIterator<[string, string]> {
    for (const entry of this.headers.values()) {
      yield [entry.originalName.toLowerCase(), entry.values.join(', ')];
    }
  }

  public *rawEntries(): IterableIterator<[string, readonly string[]]> {
    for (const entry of this.headers.values()) {
      yield [entry.originalName.toLowerCase(), Object.freeze([...entry.values])];
    }
  }

  public toRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [key, value] of this.entries()) {
      record[key] = value;
    }
    return record;
  }

  public clone(): HttpHeaders {
    const cloned = new HttpHeaders();
    for (const entry of this.headers.values()) {
      for (const val of entry.values) {
        cloned.append(entry.originalName, val);
      }
    }
    return cloned;
  }
}
