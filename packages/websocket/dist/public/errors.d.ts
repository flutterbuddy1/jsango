import { JsangoError } from '@jsango/core';
export declare class WebSocketError extends JsangoError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class WebSocketConnectionError extends WebSocketError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class WebSocketAuthenticationError extends WebSocketError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class WebSocketAuthorizationError extends WebSocketError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class WebSocketMessageError extends WebSocketError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class WebSocketLimitExceededError extends WebSocketError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
export declare class WebSocketRoomError extends WebSocketError {
    constructor(options: {
        readonly code?: string | undefined;
        readonly message: string;
        readonly cause?: unknown | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
//# sourceMappingURL=errors.d.ts.map