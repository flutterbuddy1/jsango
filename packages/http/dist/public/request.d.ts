import type { HttpMethod } from './methods.js';
import { HttpHeaders } from './headers.js';
import { HttpQuery } from './query.js';
import { HttpBody, type BodySource } from './body.js';
export interface HttpRequestInit {
    readonly method: HttpMethod;
    readonly url: string | URL;
    readonly headers?: HttpHeaders | Record<string, string | readonly string[] | undefined> | undefined;
    readonly body?: BodySource | undefined;
    readonly maxBodySize?: number | undefined;
    readonly ip?: string | undefined;
    readonly protocol?: string | undefined;
    readonly requestId?: string | undefined;
    readonly signal?: AbortSignal | undefined;
    readonly params?: Record<string, string> | undefined;
}
export type IHttpRequest = HttpRequest;
export declare class HttpRequest {
    readonly method: HttpMethod;
    readonly url: URL;
    readonly pathname: string;
    readonly query: HttpQuery;
    readonly headers: HttpHeaders;
    readonly cookies: Readonly<Record<string, string>>;
    readonly body: HttpBody;
    readonly ip?: string | undefined;
    readonly protocol: string;
    readonly requestId: string;
    readonly signal: AbortSignal;
    readonly params: Readonly<Record<string, string>>;
    constructor(init: HttpRequestInit);
    get contentType(): string;
    get contentLength(): number | null;
    json<T = unknown>(): Promise<T>;
    text(): Promise<string>;
    bytes(): Promise<Uint8Array>;
    formData(): Promise<Record<string, string | string[]>>;
}
//# sourceMappingURL=request.d.ts.map