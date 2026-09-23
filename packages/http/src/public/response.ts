import { HttpStatus } from './status.js';
import { getStatusText } from './status.js';
import { HttpHeaders } from './headers.js';
import { serializeCookie, type CookieOptions } from './cookies.js';
import { ContentType } from './content-type.js';
import { ResponseAlreadyCommittedError } from './errors.js';

export type ResponseState = 'created' | 'configured' | 'committed' | 'completed';

export type ResponseBody =
  string | Uint8Array | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null;

export interface ResponseOptions {
  readonly status?: number | undefined;
  readonly headers?:
    HttpHeaders | Record<string, string | readonly string[] | undefined> | undefined;
}

export type IHttpResponse = HttpResponse;

export class HttpResponse {
  private _status: number;
  private readonly _headers: HttpHeaders;
  private _body: ResponseBody;
  private _state: ResponseState = 'created';
  private readonly _cookies: string[] = [];

  constructor(body: ResponseBody = null, options: ResponseOptions = {}) {
    this._status = options.status ?? HttpStatus.OK;
    this._headers =
      options.headers instanceof HttpHeaders
        ? options.headers.clone()
        : new HttpHeaders(options.headers);
    this._body = body;
  }

  public get state(): ResponseState {
    return this._state;
  }

  public get statusCode(): number {
    return this._status;
  }

  public set statusCode(code: number) {
    this.assertNotCommitted();
    this._status = code;
  }

  public get statusText(): string {
    return getStatusText(this._status);
  }

  public get headers(): HttpHeaders {
    return this._headers;
  }

  public get body(): ResponseBody {
    return this._body;
  }

  public set body(newBody: ResponseBody) {
    this.assertNotCommitted();
    this._body = newBody;
  }

  public get cookies(): readonly string[] {
    return Object.freeze([...this._cookies]);
  }

  public setCookie(name: string, value: string, options: CookieOptions = {}): this {
    this.assertNotCommitted();
    const serialized = serializeCookie(name, value, options);
    this._cookies.push(serialized);
    return this;
  }

  public deleteCookie(name: string, options: Omit<CookieOptions, 'maxAge' | 'expires'> = {}): this {
    this.assertNotCommitted();
    const serialized = serializeCookie(name, '', {
      ...options,
      maxAge: 0,
      expires: new Date(0),
    });
    this._cookies.push(serialized);
    return this;
  }

  public markCommitted(): void {
    if (this._state === 'committed' || this._state === 'completed') {
      return;
    }
    this._state = 'committed';
  }

  public markCompleted(): void {
    this._state = 'completed';
  }

  private assertNotCommitted(): void {
    if (this._state === 'committed' || this._state === 'completed') {
      throw new ResponseAlreadyCommittedError();
    }
  }

  // --- Static Factories ---

  public static json(data: unknown, options: ResponseOptions = {}): HttpResponse {
    const payload = JSON.stringify(data);
    const headers =
      options.headers instanceof HttpHeaders
        ? options.headers.clone()
        : new HttpHeaders(options.headers);

    if (!headers.has('content-type')) {
      headers.set('content-type', `${ContentType.JSON}; charset=utf-8`);
    }

    return new HttpResponse(payload, {
      status: options.status ?? HttpStatus.OK,
      headers,
    });
  }

  public static text(text: string, options: ResponseOptions = {}): HttpResponse {
    const headers =
      options.headers instanceof HttpHeaders
        ? options.headers.clone()
        : new HttpHeaders(options.headers);

    if (!headers.has('content-type')) {
      headers.set('content-type', `${ContentType.TEXT}; charset=utf-8`);
    }

    return new HttpResponse(text, {
      status: options.status ?? HttpStatus.OK,
      headers,
    });
  }

  public static html(html: string, options: ResponseOptions = {}): HttpResponse {
    const headers =
      options.headers instanceof HttpHeaders
        ? options.headers.clone()
        : new HttpHeaders(options.headers);

    if (!headers.has('content-type')) {
      headers.set('content-type', `${ContentType.HTML}; charset=utf-8`);
    }

    return new HttpResponse(html, {
      status: options.status ?? HttpStatus.OK,
      headers,
    });
  }

  public static redirect(url: string, status = HttpStatus.FOUND): HttpResponse {
    const headers = new HttpHeaders({
      location: url,
    });
    return new HttpResponse(null, {
      status,
      headers,
    });
  }

  public static empty(status: number = HttpStatus.NO_CONTENT): HttpResponse {
    return new HttpResponse(null, { status });
  }

  public static stream(
    stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
    options: ResponseOptions = {}
  ): HttpResponse {
    const headers =
      options.headers instanceof HttpHeaders
        ? options.headers.clone()
        : new HttpHeaders(options.headers);

    if (!headers.has('content-type')) {
      headers.set('content-type', ContentType.OCTET_STREAM);
    }

    return new HttpResponse(stream, {
      status: options.status ?? HttpStatus.OK,
      headers,
    });
  }
}
