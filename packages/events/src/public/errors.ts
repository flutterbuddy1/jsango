import { JsangoError, type JsangoErrorOptions } from '@jsango/core';

export class EventError extends JsangoError {
  constructor(options: JsangoErrorOptions) {
    super(options);
    this.name = 'EventError';
  }
}

export class EventRegistrationError extends EventError {
  constructor(options: Omit<JsangoErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 500 });
    this.name = 'EventRegistrationError';
  }
}

export class EventHandlerError extends EventError {
  constructor(options: Omit<JsangoErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 500 });
    this.name = 'EventHandlerError';
  }
}

export class EventSerializationError extends EventError {
  constructor(options: Omit<JsangoErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 500 });
    this.name = 'EventSerializationError';
  }
}

export class EventDispatchError extends EventError {
  constructor(
    options: Omit<JsangoErrorOptions, 'statusCode'> & { readonly errors?: readonly unknown[] }
  ) {
    super({
      ...options,
      statusCode: 500,
      metadata: { ...options.metadata, errors: options.errors },
    });
    this.name = 'EventDispatchError';
  }
}
