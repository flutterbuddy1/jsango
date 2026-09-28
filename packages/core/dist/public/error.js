export class JsangoError extends Error {
    code;
    metadata;
    statusCode;
    constructor(options) {
        super(options.message, { cause: options.cause });
        this.name = 'JsangoError';
        this.code = options.code;
        this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
        this.statusCode = options.statusCode ?? 500;
        Object.setPrototypeOf(this, new.target.prototype);
    }
    /**
     * Serializes the error safely for HTTP responses without exposing sensitive internal stack traces.
     */
    toSafeJSON(isProduction = true) {
        if (!isProduction) {
            return {
                code: this.code,
                message: this.message,
                ...(this.metadata ? { metadata: this.metadata } : {}),
            };
        }
        // In production, mask 5xx messages to prevent leaking internal error details
        const safeMessage = this.statusCode >= 500 ? 'An internal error occurred.' : this.message;
        return {
            code: this.code,
            message: safeMessage,
            ...(this.statusCode < 500 && this.metadata ? { metadata: this.metadata } : {}),
        };
    }
}
//# sourceMappingURL=error.js.map