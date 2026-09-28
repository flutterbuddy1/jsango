import { JsangoError } from '@jsango/core';
export class CacheError extends JsangoError {
    constructor(options) {
        super(options);
        this.name = 'CacheError';
    }
}
export class CacheSerializationError extends CacheError {
    constructor(message, cause) {
        super({
            code: 'ERR_CACHE_SERIALIZATION',
            message,
            cause,
            statusCode: 500,
        });
        this.name = 'CacheSerializationError';
    }
}
export class CacheConnectionError extends CacheError {
    constructor(message, cause) {
        super({
            code: 'ERR_CACHE_CONNECTION',
            message,
            cause,
            statusCode: 503,
        });
        this.name = 'CacheConnectionError';
    }
}
export class CacheCapabilityError extends CacheError {
    constructor(driverName, operation) {
        super({
            code: 'ERR_CACHE_UNSUPPORTED_CAPABILITY',
            message: `Driver "${driverName}" does not support operation "${operation}".`,
            metadata: { driverName, operation },
            statusCode: 500,
        });
        this.name = 'CacheCapabilityError';
    }
}
export class CacheKeyError extends CacheError {
    constructor(message, key) {
        super({
            code: 'ERR_CACHE_INVALID_KEY',
            message,
            metadata: key ? { key } : undefined,
            statusCode: 400,
        });
        this.name = 'CacheKeyError';
    }
}
//# sourceMappingURL=errors.js.map