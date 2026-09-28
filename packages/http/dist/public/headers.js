import { JsangoError } from '@jsango/core';
export class HttpHeaders {
    // Store lowercased key -> original case preserved name + string array of values
    headers = new Map();
    constructor(initial) {
        if (initial instanceof HttpHeaders) {
            for (const [key, value] of initial.entries()) {
                this.append(key, value);
            }
        }
        else if (initial && typeof initial === 'object') {
            for (const [key, value] of Object.entries(initial)) {
                if (typeof value === 'undefined')
                    continue;
                if (Array.isArray(value)) {
                    for (const item of value) {
                        this.append(key, String(item));
                    }
                }
                else {
                    this.set(key, String(value));
                }
            }
        }
    }
    validateName(name) {
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
    validateValue(name, value) {
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
    get(name) {
        this.validateName(name);
        const entry = this.headers.get(name.toLowerCase());
        if (!entry || entry.values.length === 0)
            return null;
        return entry.values.join(', ');
    }
    getAll(name) {
        this.validateName(name);
        const entry = this.headers.get(name.toLowerCase());
        return entry ? Object.freeze([...entry.values]) : [];
    }
    has(name) {
        this.validateName(name);
        return this.headers.has(name.toLowerCase());
    }
    set(name, value) {
        this.validateName(name);
        this.validateValue(name, value);
        const lower = name.toLowerCase();
        this.headers.set(lower, {
            originalName: name,
            values: [value],
        });
    }
    append(name, value) {
        this.validateName(name);
        this.validateValue(name, value);
        const lower = name.toLowerCase();
        const existing = this.headers.get(lower);
        if (existing) {
            existing.values.push(value);
        }
        else {
            this.headers.set(lower, {
                originalName: name,
                values: [value],
            });
        }
    }
    delete(name) {
        this.validateName(name);
        this.headers.delete(name.toLowerCase());
    }
    *entries() {
        for (const entry of this.headers.values()) {
            yield [entry.originalName.toLowerCase(), entry.values.join(', ')];
        }
    }
    *rawEntries() {
        for (const entry of this.headers.values()) {
            yield [entry.originalName.toLowerCase(), Object.freeze([...entry.values])];
        }
    }
    toRecord() {
        const record = {};
        for (const [key, value] of this.entries()) {
            record[key] = value;
        }
        return record;
    }
    clone() {
        const cloned = new HttpHeaders();
        for (const entry of this.headers.values()) {
            for (const val of entry.values) {
                cloned.append(entry.originalName, val);
            }
        }
        return cloned;
    }
}
//# sourceMappingURL=headers.js.map