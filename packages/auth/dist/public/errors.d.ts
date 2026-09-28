import { JsangoError } from '@jsango/core';
export interface AuthErrorOptions {
    readonly code: string;
    readonly message: string;
    readonly cause?: unknown;
    readonly metadata?: Readonly<Record<string, unknown>> | undefined;
    readonly statusCode?: number | undefined;
}
export declare class AuthenticationError extends JsangoError {
    constructor(options: AuthErrorOptions);
}
export declare class UnauthenticatedError extends AuthenticationError {
    constructor(message?: string);
}
export declare class InvalidCredentialsError extends AuthenticationError {
    constructor(message?: string);
}
export declare class TokenExpiredError extends AuthenticationError {
    constructor(message?: string);
}
export declare class SessionExpiredError extends AuthenticationError {
    constructor(message?: string);
}
export declare class AuthorizationError extends JsangoError {
    constructor(options: AuthErrorOptions);
}
export declare class ForbiddenError extends AuthorizationError {
    constructor(message?: string);
}
export declare class PolicyError extends AuthorizationError {
    constructor(policyName: string, message?: string);
}
//# sourceMappingURL=errors.d.ts.map