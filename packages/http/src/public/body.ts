import { BadRequestError, PayloadAlreadyConsumedError, PayloadTooLargeError } from './errors.js';

export const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 Megabytes

export type BodySource =
  Uint8Array | string | AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | null;

export class HttpBody {
  private _consumed = false;
  private readonly source: BodySource;
  private readonly maxBodySize: number;

  constructor(source: BodySource, maxBodySize: number = DEFAULT_MAX_BODY_SIZE) {
    this.source = source;
    this.maxBodySize = maxBodySize;
  }

  public get isConsumed(): boolean {
    return this._consumed;
  }

  private markConsumed(): void {
    if (this._consumed) {
      throw new PayloadAlreadyConsumedError();
    }
    this._consumed = true;
  }

  public async bytes(): Promise<Uint8Array> {
    this.markConsumed();

    if (this.source === null) {
      return new Uint8Array(0);
    }

    if (this.source instanceof Uint8Array) {
      if (this.source.byteLength > this.maxBodySize) {
        throw new PayloadTooLargeError({
          message: `Request body exceeds maximum size of ${this.maxBodySize} bytes.`,
        });
      }
      return this.source;
    }

    if (typeof this.source === 'string') {
      const encoded = new TextEncoder().encode(this.source);
      if (encoded.byteLength > this.maxBodySize) {
        throw new PayloadTooLargeError({
          message: `Request body exceeds maximum size of ${this.maxBodySize} bytes.`,
        });
      }
      return encoded;
    }

    // Handle AsyncIterable or ReadableStream
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    const stream =
      'getReader' in this.source ? (this.source as ReadableStream<Uint8Array>) : this.source;

    if ('getReader' in stream) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > this.maxBodySize) {
              throw new PayloadTooLargeError({
                message: `Request body exceeds maximum size of ${this.maxBodySize} bytes.`,
              });
            }
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      for await (const chunk of stream) {
        totalBytes += chunk.byteLength;
        if (totalBytes > this.maxBodySize) {
          throw new PayloadTooLargeError({
            message: `Request body exceeds maximum size of ${this.maxBodySize} bytes.`,
          });
        }
        chunks.push(chunk);
      }
    }

    // Combine chunks
    const result = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  public async text(): Promise<string> {
    const rawBytes = await this.bytes();
    return new TextDecoder().decode(rawBytes);
  }

  public async json<T = unknown>(): Promise<T> {
    const rawText = await this.text();
    if (!rawText.trim()) {
      throw new BadRequestError({
        message: 'Empty request body where JSON was expected.',
        code: 'ERR_EMPTY_JSON_BODY',
      });
    }

    try {
      return JSON.parse(rawText) as T;
    } catch (cause) {
      throw new BadRequestError({
        message: 'Invalid JSON payload received in request body.',
        code: 'ERR_INVALID_JSON_BODY',
        cause,
      });
    }
  }

  public async formData(): Promise<Record<string, string | string[]>> {
    const rawText = await this.text();
    const params = new URLSearchParams(rawText);
    const result: Record<string, string | string[]> = {};

    for (const [key, val] of params.entries()) {
      const existing = result[key];
      if (typeof existing === 'undefined') {
        result[key] = val;
      } else if (Array.isArray(existing)) {
        existing.push(val);
      } else {
        result[key] = [existing, val];
      }
    }

    return result;
  }
}
