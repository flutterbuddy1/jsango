import { HttpStatus } from './status.js';
import { getStatusText } from './status.js';
import { HttpHeaders } from './headers.js';
import { serializeCookie } from './cookies.js';
import { ContentType } from './content-type.js';
import { ResponseAlreadyCommittedError } from './errors.js';
export class HttpResponse {
    _status;
    _headers;
    _body;
    _state = 'created';
    _cookies = [];
    constructor(body = null, options = {}) {
        this._status = options.status ?? HttpStatus.OK;
        this._headers =
            options.headers instanceof HttpHeaders
                ? options.headers.clone()
                : new HttpHeaders(options.headers);
        this._body = body;
    }
    get state() {
        return this._state;
    }
    get statusCode() {
        return this._status;
    }
    set statusCode(code) {
        this.assertNotCommitted();
        this._status = code;
    }
    get status() {
        return this._status;
    }
    set status(code) {
        this.statusCode = code;
    }
    get statusText() {
        return getStatusText(this._status);
    }
    get headers() {
        return this._headers;
    }
    get body() {
        return this._body;
    }
    set body(newBody) {
        this.assertNotCommitted();
        this._body = newBody;
    }
    get cookies() {
        return Object.freeze([...this._cookies]);
    }
    setCookie(name, value, options = {}) {
        this.assertNotCommitted();
        const serialized = serializeCookie(name, value, options);
        this._cookies.push(serialized);
        return this;
    }
    deleteCookie(name, options = {}) {
        this.assertNotCommitted();
        const serialized = serializeCookie(name, '', {
            ...options,
            maxAge: 0,
            expires: new Date(0),
        });
        this._cookies.push(serialized);
        return this;
    }
    markCommitted() {
        if (this._state === 'committed' || this._state === 'completed') {
            return;
        }
        this._state = 'committed';
    }
    markCompleted() {
        this._state = 'completed';
    }
    assertNotCommitted() {
        if (this._state === 'committed' || this._state === 'completed') {
            throw new ResponseAlreadyCommittedError();
        }
    }
    // --- Static Factories ---
    static json(data, options = {}) {
        const payload = JSON.stringify(data);
        const headers = options.headers instanceof HttpHeaders
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
    static text(text, options = {}) {
        const headers = options.headers instanceof HttpHeaders
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
    static html(html, options = {}) {
        const headers = options.headers instanceof HttpHeaders
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
    static redirect(url, status = HttpStatus.FOUND) {
        const headers = new HttpHeaders({
            location: url,
        });
        return new HttpResponse(null, {
            status,
            headers,
        });
    }
    static created(data, options = {}) {
        return HttpResponse.json(data, {
            ...options,
            status: HttpStatus.CREATED,
        });
    }
    static noContent() {
        return new HttpResponse(null, { status: HttpStatus.NO_CONTENT });
    }
    static badRequest(message = 'Bad Request', code = 'ERR_BAD_REQUEST', details) {
        return HttpResponse.json({
            error: {
                code,
                message,
                ...(details !== undefined ? { details } : {}),
            },
        }, { status: HttpStatus.BAD_REQUEST });
    }
    static unauthorized(message = 'Unauthorized') {
        return HttpResponse.json({
            error: {
                code: 'ERR_UNAUTHORIZED',
                message,
            },
        }, { status: HttpStatus.UNAUTHORIZED });
    }
    static forbidden(message = 'Forbidden') {
        return HttpResponse.json({
            error: {
                code: 'ERR_FORBIDDEN',
                message,
            },
        }, { status: HttpStatus.FORBIDDEN });
    }
    static notFound(message = 'Not Found') {
        return HttpResponse.json({
            error: {
                code: 'ERR_NOT_FOUND',
                message,
            },
        }, { status: HttpStatus.NOT_FOUND });
    }
    static serverError(message = 'Internal Server Error') {
        return HttpResponse.json({
            error: {
                code: 'ERR_INTERNAL_SERVER_ERROR',
                message,
            },
        }, { status: HttpStatus.INTERNAL_SERVER_ERROR });
    }
    static empty(status = HttpStatus.NO_CONTENT) {
        return new HttpResponse(null, { status });
    }
    static stream(stream, options = {}) {
        const headers = options.headers instanceof HttpHeaders
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
//# sourceMappingURL=response.js.map