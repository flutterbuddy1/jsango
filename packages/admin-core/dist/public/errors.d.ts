import { JsangoError } from '@jsango/core';
export declare class AdminError extends JsangoError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly statusCode?: number | undefined;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class AdminRegistrationError extends AdminError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class AdminResourceNotFoundError extends AdminError {
    constructor(resourceName: string);
}
export declare class AdminItemNotFoundError extends AdminError {
    constructor(resourceName: string, id: string | number);
}
export declare class AdminValidationError extends AdminError {
    constructor(options: {
        readonly message: string;
        readonly errors: readonly unknown[];
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class AdminAuthorizationError extends AdminError {
    constructor(options: {
        readonly message?: string | undefined;
        readonly resource?: string | undefined;
        readonly action?: string | undefined;
        readonly field?: string | undefined;
    });
}
export declare class AdminActionError extends AdminError {
    constructor(options: {
        readonly actionName: string;
        readonly message: string;
        readonly cause?: unknown | undefined;
    });
}
//# sourceMappingURL=errors.d.ts.map