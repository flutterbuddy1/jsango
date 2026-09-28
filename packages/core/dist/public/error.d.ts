export interface ErrorMetadata {
    readonly [key: string]: unknown;
}
export interface SafeErrorResponse {
    readonly code: string;
    readonly message: string;
    readonly metadata?: ErrorMetadata | undefined;
}
export interface JsangoErrorOptions {
    readonly code: string;
    readonly message: string;
    readonly cause?: unknown;
    readonly metadata?: ErrorMetadata | undefined;
    readonly statusCode?: number | undefined;
}
export declare class JsangoError extends Error {
    readonly code: string;
    readonly metadata?: ErrorMetadata | undefined;
    readonly statusCode: number;
    constructor(options: JsangoErrorOptions);
    /**
     * Serializes the error safely for HTTP responses without exposing sensitive internal stack traces.
     */
    toSafeJSON(isProduction?: boolean): SafeErrorResponse;
}
//# sourceMappingURL=error.d.ts.map