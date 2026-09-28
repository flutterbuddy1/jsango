import { JsangoError, type ErrorMetadata, type SafeErrorResponse } from '@jsango/core';
import { type HttpStatusCode } from './status.js';
export interface HttpErrorOptions {
    readonly message?: string | undefined;
    readonly code?: string | undefined;
    readonly cause?: unknown;
    readonly metadata?: ErrorMetadata | undefined;
    readonly headers?: Record<string, string> | undefined;
}
export declare class HttpError extends JsangoError {
    readonly headers?: Readonly<Record<string, string>> | undefined;
    constructor(statusCode: HttpStatusCode, options?: HttpErrorOptions);
}
export declare class BadRequestError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class UnauthorizedError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class ForbiddenError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class NotFoundError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class MethodNotAllowedError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class ConflictError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class PayloadTooLargeError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class UnsupportedMediaTypeError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class UnprocessableEntityError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class TooManyRequestsError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class InternalServerError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class BadGatewayError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class ServiceUnavailableError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class GatewayTimeoutError extends HttpError {
    constructor(options?: HttpErrorOptions | string);
}
export declare class PayloadAlreadyConsumedError extends JsangoError {
    constructor(message?: string);
}
export declare class ResponseAlreadyCommittedError extends JsangoError {
    constructor(message?: string);
}
export interface HttpErrorResponseBody {
    readonly error: SafeErrorResponse;
}
export declare function formatHttpErrorResponse(error: unknown, isProduction?: boolean): {
    statusCode: number;
    body: HttpErrorResponseBody;
};
//# sourceMappingURL=errors.d.ts.map