import { createServer } from 'node:http';
import { HttpRequest } from '../../public/request.js';
import { HttpResponse } from '../../public/response.js';
import { RequestContext } from '../../public/context.js';
import { formatHttpErrorResponse } from '../../public/errors.js';
import { NoopLogger } from '@jsango/core';
export class NodeHttpServer {
    handler;
    options;
    logger;
    server = null;
    activeRequests = 0;
    activeControllers = new Set();
    constructor(handler, options = {}) {
        this.handler = handler;
        this.options = options;
        this.logger = options.logger ?? new NoopLogger();
    }
    get isListening() {
        return this.server !== null && this.server.listening;
    }
    getUnderlyingServer() {
        return this.server;
    }
    get address() {
        if (!this.server)
            return null;
        const addr = this.server.address();
        if (!addr || typeof addr === 'string')
            return null;
        const info = addr;
        return {
            port: info.port,
            host: info.address,
            family: info.family,
        };
    }
    async listen(port = 3000, host = '127.0.0.1') {
        if (this.server) {
            throw new Error('Server is already running.');
        }
        return new Promise((resolve, reject) => {
            const srv = createServer((req, res) => {
                this.handleNodeRequest(req, res).catch((err) => {
                    this.logger.error('Unhandled request processing error', {
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
            });
            srv.on('error', (err) => {
                reject(err);
            });
            srv.listen(port, host, () => {
                this.server = srv;
                const addr = this.address;
                if (addr) {
                    resolve(addr);
                }
                else {
                    resolve({ port, host, family: 'IPv4' });
                }
            });
        });
    }
    async close(timeoutMs = 5000) {
        if (!this.server)
            return;
        const srv = this.server;
        this.server = null;
        return new Promise((resolve, reject) => {
            // Set timeout for in-flight requests
            const timer = setTimeout(() => {
                for (const controller of this.activeControllers) {
                    controller.abort();
                }
                srv.closeAllConnections?.();
                resolve();
            }, timeoutMs);
            srv.close((err) => {
                clearTimeout(timer);
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    async handleNodeRequest(req, res) {
        this.activeRequests++;
        const abortController = new AbortController();
        this.activeControllers.add(abortController);
        req.on('close', () => {
            if (!res.writableEnded) {
                abortController.abort();
            }
        });
        try {
            const httpRequest = this.translateRequest(req, abortController.signal);
            const ctx = new RequestContext({
                request: httpRequest,
                logger: this.logger,
                signal: abortController.signal,
            });
            let response;
            try {
                response = await this.handler(ctx);
            }
            catch (handlerError) {
                const isProd = this.options.isProduction ?? true;
                const formatted = formatHttpErrorResponse(handlerError, isProd);
                response = HttpResponse.json(formatted.body, { status: formatted.statusCode });
            }
            await this.sendResponse(response, res);
        }
        finally {
            this.activeControllers.delete(abortController);
            this.activeRequests--;
        }
    }
    translateRequest(req, signal) {
        const protocol = req.socket?.encrypted ? 'https' : 'http';
        const host = req.headers.host ?? 'localhost';
        const fullUrl = `${protocol}://${host}${req.url ?? '/'}`;
        const headersRecord = {};
        for (const [key, val] of Object.entries(req.headers)) {
            if (Array.isArray(val)) {
                headersRecord[key] = val;
            }
            else if (typeof val === 'string') {
                headersRecord[key] = val;
            }
        }
        // Convert IncomingMessage readable stream to AsyncIterable<Uint8Array>
        async function* toAsyncIterable(stream) {
            for await (const chunk of stream) {
                if (typeof chunk === 'string') {
                    yield new TextEncoder().encode(chunk);
                }
                else if (Buffer.isBuffer(chunk)) {
                    yield new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
                }
                else if (chunk instanceof Uint8Array) {
                    yield chunk;
                }
            }
        }
        return new HttpRequest({
            method: (req.method ?? 'GET').toUpperCase(),
            url: fullUrl,
            headers: headersRecord,
            body: toAsyncIterable(req),
            maxBodySize: this.options.maxBodySize,
            ip: req.socket.remoteAddress,
            protocol,
            signal,
        });
    }
    async sendResponse(response, res) {
        response.markCommitted();
        res.statusCode = response.statusCode;
        // Apply headers
        for (const [key, val] of response.headers.entries()) {
            res.setHeader(key, val);
        }
        // Apply cookies
        const cookies = response.cookies;
        if (cookies.length > 0) {
            res.setHeader('Set-Cookie', cookies.length === 1 ? cookies[0] : [...cookies]);
        }
        const body = response.body;
        if (body === null || typeof body === 'undefined') {
            res.end();
            response.markCompleted();
            return;
        }
        if (typeof body === 'string') {
            res.end(body);
            response.markCompleted();
            return;
        }
        if (body instanceof Uint8Array) {
            res.end(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
            response.markCompleted();
            return;
        }
        // Stream response
        if ('getReader' in body) {
            const reader = body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    if (value) {
                        res.write(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
            res.end();
            response.markCompleted();
            return;
        }
        // AsyncIterable stream
        for await (const chunk of body) {
            res.write(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        }
        res.end();
        response.markCompleted();
    }
}
export function createNodeHttpServer(handler, options) {
    return new NodeHttpServer(handler, options);
}
//# sourceMappingURL=node-server.js.map