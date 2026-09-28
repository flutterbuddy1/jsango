import { HttpHeaders } from './headers.js';
import { HttpQuery } from './query.js';
import { parseCookies } from './cookies.js';
import { HttpBody, DEFAULT_MAX_BODY_SIZE } from './body.js';
import { parseContentType } from './content-type.js';
export class HttpRequest {
    method;
    url;
    pathname;
    query;
    headers;
    cookies;
    body;
    ip;
    protocol;
    requestId;
    signal;
    params;
    constructor(init) {
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
    get contentType() {
        return parseContentType(this.headers.get('content-type')).mediaType;
    }
    get contentLength() {
        const raw = this.headers.get('content-length');
        if (!raw)
            return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }
    async json() {
        return this.body.json();
    }
    async text() {
        return this.body.text();
    }
    async bytes() {
        return this.body.bytes();
    }
    async formData() {
        return this.body.formData();
    }
}
//# sourceMappingURL=request.js.map