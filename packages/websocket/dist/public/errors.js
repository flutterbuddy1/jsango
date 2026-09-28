import { JsangoError } from '@jsango/core';
export class WebSocketError extends JsangoError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WEBSOCKET',
            message: options.message,
            statusCode: 400,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class WebSocketConnectionError extends WebSocketError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WS_CONNECTION',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class WebSocketAuthenticationError extends WebSocketError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WS_AUTHENTICATION_FAILED',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class WebSocketAuthorizationError extends WebSocketError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WS_UNAUTHORIZED',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class WebSocketMessageError extends WebSocketError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WS_INVALID_MESSAGE',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class WebSocketLimitExceededError extends WebSocketError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WS_LIMIT_EXCEEDED',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class WebSocketRoomError extends WebSocketError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_WS_ROOM',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
//# sourceMappingURL=errors.js.map