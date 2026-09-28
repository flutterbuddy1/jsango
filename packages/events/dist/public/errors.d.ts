import { JsangoError, type JsangoErrorOptions } from '@jsango/core';
export declare class EventError extends JsangoError {
    constructor(options: JsangoErrorOptions);
}
export declare class EventRegistrationError extends EventError {
    constructor(options: Omit<JsangoErrorOptions, 'statusCode'>);
}
export declare class EventHandlerError extends EventError {
    constructor(options: Omit<JsangoErrorOptions, 'statusCode'>);
}
export declare class EventSerializationError extends EventError {
    constructor(options: Omit<JsangoErrorOptions, 'statusCode'>);
}
export declare class EventDispatchError extends EventError {
    constructor(options: Omit<JsangoErrorOptions, 'statusCode'> & {
        readonly errors?: readonly unknown[];
    });
}
//# sourceMappingURL=errors.d.ts.map