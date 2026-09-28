import { BadRequestError, PayloadAlreadyConsumedError, PayloadTooLargeError } from './errors.js';
export const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 Megabytes
export class HttpBody {
    _consumed = false;
    source;
    maxBodySize;
    constructor(source, maxBodySize = DEFAULT_MAX_BODY_SIZE) {
        this.source = source;
        this.maxBodySize = maxBodySize;
    }
    get isConsumed() {
        return this._consumed;
    }
    markConsumed() {
        if (this._consumed) {
            throw new PayloadAlreadyConsumedError();
        }
        this._consumed = true;
    }
    async bytes() {
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
        const chunks = [];
        let totalBytes = 0;
        const stream = 'getReader' in this.source ? this.source : this.source;
        if ('getReader' in stream) {
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
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
            }
            finally {
                reader.releaseLock();
            }
        }
        else {
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
    async text() {
        const rawBytes = await this.bytes();
        return new TextDecoder().decode(rawBytes);
    }
    async json() {
        const rawText = await this.text();
        if (!rawText.trim()) {
            throw new BadRequestError({
                message: 'Empty request body where JSON was expected.',
                code: 'ERR_EMPTY_JSON_BODY',
            });
        }
        try {
            return JSON.parse(rawText);
        }
        catch (cause) {
            throw new BadRequestError({
                message: 'Invalid JSON payload received in request body.',
                code: 'ERR_INVALID_JSON_BODY',
                cause,
            });
        }
    }
    async formData() {
        const rawText = await this.text();
        const params = new URLSearchParams(rawText);
        const result = {};
        for (const [key, val] of params.entries()) {
            const existing = result[key];
            if (typeof existing === 'undefined') {
                result[key] = val;
            }
            else if (Array.isArray(existing)) {
                existing.push(val);
            }
            else {
                result[key] = [existing, val];
            }
        }
        return result;
    }
}
//# sourceMappingURL=body.js.map