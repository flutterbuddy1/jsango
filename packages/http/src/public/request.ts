import type { HttpMethod } from './methods.js';
import { HttpHeaders } from './headers.js';
import { HttpQuery } from './query.js';
import { parseCookies } from './cookies.js';
import { HttpBody, type BodySource, DEFAULT_MAX_BODY_SIZE } from './body.js';
import { parseContentType } from './content-type.js';

export interface HttpRequestInit {
  readonly method: HttpMethod;
  readonly url: string | URL;
  readonly headers?:
    HttpHeaders | Record<string, string | readonly string[] | undefined> | undefined;
  readonly body?: BodySource | undefined;
  readonly maxBodySize?: number | undefined;
  readonly ip?: string | undefined;
  readonly protocol?: string | undefined;
  readonly requestId?: string | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly params?: Record<string, string> | undefined;
}

export type IHttpRequest = HttpRequest;

export class HttpRequest {
  public readonly method: HttpMethod;
  public readonly url: URL;
  public readonly pathname: string;
  public readonly query: HttpQuery;
  public readonly headers: HttpHeaders;
  public readonly cookies: Readonly<Record<string, string>>;
  public readonly body: HttpBody;
  public readonly ip?: string | undefined;
  public readonly protocol: string;
  public readonly requestId: string;
  public readonly signal: AbortSignal;
  public readonly params: Readonly<Record<string, string>>;

  constructor(init: HttpRequestInit) {
    this.method = init.method;
    this.url = typeof init.url === 'string' ? new URL(init.url, 'http://localhost') : init.url;
    this.pathname = this.url.pathname;
    this.query = new HttpQuery(this.url.searchParams);
    this.headers =
      init.headers instanceof HttpHeaders ? init.headers.clone() : new HttpHeaders(init.headers);
    this.cookies = parseCookies(this.headers.get('cookie'));
    this.body = new HttpBody(init.body ?? null, init.maxBodySize ?? DEFAULT_MAX_BODY_SIZE);
    this.ip = init.ip;
    this.protocol = init.protocol ?? (this.url.protocol.replace(':', '') || 'http');
    this.requestId = init.requestId ?? this.headers.get('x-request-id') ?? crypto.randomUUID();
    this.signal = init.signal ?? new AbortController().signal;
    this.params = Object.freeze({ ...(init.params ?? {}) });

    Object.freeze(this.cookies);
  }

  public get contentType(): string {
    return parseContentType(this.headers.get('content-type')).mediaType;
  }

  public get contentLength(): number | null {
    const raw = this.headers.get('content-length');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  public async json<T = unknown>(): Promise<T> {
    return this.body.json<T>();
  }

  public async text(): Promise<string> {
    return this.body.text();
  }

  public async bytes(): Promise<Uint8Array> {
    return this.body.bytes();
  }

  public async formData(): Promise<Record<string, string | string[]>> {
    return this.body.formData();
  }
}
