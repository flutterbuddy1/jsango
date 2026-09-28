import { JsangoError } from '@jsango/core';
export class EventError extends JsangoError {
    constructor(options) {
        super(options);
        this.name = 'EventError';
    }
}
export class EventRegistrationError extends EventError {
    constructor(options) {
        super({ ...options, statusCode: 500 });
        this.name = 'EventRegistrationError';
    }
}
export class EventHandlerError extends EventError {
    constructor(options) {
        super({ ...options, statusCode: 500 });
        this.name = 'EventHandlerError';
    }
}
export class EventSerializationError extends EventError {
    constructor(options) {
        super({ ...options, statusCode: 500 });
        this.name = 'EventSerializationError';
    }
}
export class EventDispatchError extends EventError {
    constructor(options) {
        super({
            ...options,
            statusCode: 500,
            metadata: { ...options.metadata, errors: options.errors },
        });
        this.name = 'EventDispatchError';
    }
}
//# sourceMappingURL=errors.js.map