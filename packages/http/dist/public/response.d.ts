import { HttpHeaders } from './headers.js';
import { type CookieOptions } from './cookies.js';
export type ResponseState = 'created' | 'configured' | 'committed' | 'completed';
export type ResponseBody = string | Uint8Array | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null;
export interface ResponseOptions {
    readonly status?: number | undefined;
    readonly headers?: HttpHeaders | Record<string, string | readonly string[] | undefined> | undefined;
}
export type IHttpResponse = HttpResponse;
export declare class HttpResponse {
    private _status;
    private readonly _headers;
    private _body;
    private _state;
    private readonly _cookies;
    constructor(body?: ResponseBody, options?: ResponseOptions);
    get state(): ResponseState;
    get statusCode(): number;
    set statusCode(code: number);
    get status(): number;
    set status(code: number);
    get statusText(): string;
    get headers(): HttpHeaders;
    get body(): ResponseBody;
    set body(newBody: ResponseBody);
    get cookies(): readonly string[];
    setCookie(name: string, value: string, options?: CookieOptions): this;
    deleteCookie(name: string, options?: Omit<CookieOptions, 'maxAge' | 'expires'>): this;
    markCommitted(): void;
    markCompleted(): void;
    private assertNotCommitted;
    static json(data: unknown, options?: ResponseOptions): HttpResponse;
    static text(text: string, options?: ResponseOptions): HttpResponse;
    static html(html: string, options?: ResponseOptions): HttpResponse;
    static redirect(url: string, status?: 302): HttpResponse;
    static created(data: unknown, options?: ResponseOptions): HttpResponse;
    static noContent(): HttpResponse;
    static badRequest(message?: string, code?: string, details?: unknown): HttpResponse;
    static unauthorized(message?: string): HttpResponse;
    static forbidden(message?: string): HttpResponse;
    static notFound(message?: string): HttpResponse;
    static serverError(message?: string): HttpResponse;
    static empty(status?: number): HttpResponse;
    static stream(stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>, options?: ResponseOptions): HttpResponse;
}
//# sourceMappingURL=response.d.ts.map