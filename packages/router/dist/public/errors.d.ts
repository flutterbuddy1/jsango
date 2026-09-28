import { JsangoError, type ErrorMetadata } from '@jsango/core';
export declare class RouterError extends JsangoError {
    constructor(code: string, message: string, metadata?: ErrorMetadata);
}
export declare class DuplicateRouteError extends RouterError {
    constructor(method: string, path: string);
}
export declare class DuplicateRouteNameError extends RouterError {
    constructor(name: string, existingPath: string, newPath: string);
}
export declare class InvalidRoutePatternError extends RouterError {
    constructor(path: string, reason: string);
}
export declare class RouterLockedError extends RouterError {
    constructor(action?: string);
}
export declare class RouteNotFoundError extends RouterError {
    constructor(name: string);
}
//# sourceMappingURL=errors.d.ts.map