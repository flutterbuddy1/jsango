import { JsangoError, type JsangoErrorOptions } from '@jsango/core';
export declare class CacheError extends JsangoError {
    constructor(options: JsangoErrorOptions);
}
export declare class CacheSerializationError extends CacheError {
    constructor(message: string, cause?: unknown);
}
export declare class CacheConnectionError extends CacheError {
    constructor(message: string, cause?: unknown);
}
export declare class CacheCapabilityError extends CacheError {
    constructor(driverName: string, operation: string);
}
export declare class CacheKeyError extends CacheError {
    constructor(message: string, key?: string);
}
//# sourceMappingURL=errors.d.ts.map